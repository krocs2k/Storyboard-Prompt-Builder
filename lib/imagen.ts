import { GoogleGenAI } from '@google/genai';
import { cached } from './redis';
import { prisma } from '@/lib/db';
import { trackUsage } from '@/lib/usage-tracker';
import { type ApiProvider } from '@/lib/llm';
import { ALL_HYBRID_CONFIG_KEYS, FUNCTION_CONFIG_KEYS } from '@/lib/data/provider-models';
import {
  getImageModelRegistry,
  activeModelNames,
  cheapestActiveModel,
  fetchLiveGeminiImageModels,
  isInvalidModelError,
  type ImageModelEntry,
} from '@/lib/image-model-registry';

/**
 * Thrown when image generation failed because the configured model name was no
 * longer valid on the provider, and the app has AUTOMATICALLY reconciled the
 * registry and updated the stored model name to a current, valid, CHEAPEST
 * option. API routes translate this into a "please retry" response so the user
 * can re-run the same render with the corrected model. Never an upgrade: the
 * replacement is always the cheapest valid model to protect margin.
 */
export class ImageModelUpdatedError extends Error {
  previousModel: string;
  newModel: string;
  constructor(previousModel: string, newModel: string) {
    super(`Image model "${previousModel}" was no longer valid and has been updated to "${newModel}". Please retry.`);
    this.name = 'ImageModelUpdatedError';
    this.previousModel = previousModel;
    this.newModel = newModel;
  }
}

// Cache the DB-fetched config for 60 seconds to avoid hitting DB on every call
let cachedDbConfig: {
  geminiKey: string | null;
  openaiKey: string | null;
  abacusKey: string | null;
  provider: ApiProvider;
  imagenModel: string | null;
  abacusImageModel: string | null;
  // Per-function image config
  fnImageProvider: string;
  fnImageModel: string;
  fetchedAt: number;
} = { geminiKey: null, openaiKey: null, abacusKey: null, provider: 'gemini', imagenModel: null, abacusImageModel: null, fnImageProvider: '', fnImageModel: '', fetchedAt: 0 };
const DB_KEY_CACHE_TTL = 60_000;

/** Immediately bust the in-memory image config cache so next call re-reads from DB */
export function invalidateImagenCache() {
  cachedDbConfig.fetchedAt = 0;
}

async function loadImageConfig() {
  const now = Date.now();
  if (now - cachedDbConfig.fetchedAt < DB_KEY_CACHE_TTL && (cachedDbConfig.geminiKey || cachedDbConfig.openaiKey || cachedDbConfig.abacusKey)) {
    return cachedDbConfig;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ALL_HYBRID_CONFIG_KEYS } }
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));

    const imgKeys = FUNCTION_CONFIG_KEYS.image;

    cachedDbConfig = {
      geminiKey: configMap['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY || null,
      openaiKey: configMap['OPENAI_API_KEY'] || process.env.OPENAI_API_KEY || null,
      abacusKey: configMap['ABACUS_API_KEY'] || process.env.ABACUSAI_API_KEY || null,
      provider: (configMap['API_PROVIDER'] as ApiProvider) || 'gemini',
      imagenModel: configMap['IMAGEN_MODEL'] || null,
      abacusImageModel: configMap['ABACUS_IMAGE_MODEL'] || null,
      fnImageProvider: configMap[imgKeys.providerKey] || '',
      fnImageModel: configMap[imgKeys.modelKey] || '',
      fetchedAt: now,
    };
  } catch (e) {
    console.warn('Failed to load image config from DB:', e);
    cachedDbConfig = {
      geminiKey: process.env.GEMINI_API_KEY || null,
      openaiKey: process.env.OPENAI_API_KEY || null,
      abacusKey: process.env.ABACUSAI_API_KEY || null,
      provider: 'gemini',
      imagenModel: null,
      abacusImageModel: null,
      fnImageProvider: '',
      fnImageModel: '',
      fetchedAt: now,
    };
  }

  return cachedDbConfig;
}

async function getGeminiClient(apiKey?: string): Promise<GoogleGenAI> {
  const key = apiKey || (await loadImageConfig()).geminiKey;
  if (!key) throw new Error('GEMINI_API_KEY is not configured. Set it in Admin > API Configuration.');
  return new GoogleGenAI({ apiKey: key });
}

// Models that use the legacy Imagen generateImages (predict) API.
// NOTE: The Imagen 3/4 families have been decommissioned on the Gemini API
// (the generateImages/predict endpoint returns 404 NOT_FOUND for them). They
// are kept here only so legacy selections can be detected and rerouted.
const IMAGEN_MODELS = [
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-ultra-generate-001',
  'imagen-3.0-generate-002',
];

// Models that use the Gemini generateContent API (Nano Banana family)
const GEMINI_IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3-pro-image',
];

// Current default Gemini-native image model (GA "Nano Banana").
const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

// The Imagen 3/4 families no longer exist on the Gemini API. Any legacy
// imagen-* selection (from stale config or old defaults) is transparently
// rerouted to the current Gemini-native image model so generation keeps working.
function normalizeGeminiImageModel(model?: string | null): string {
  if (!model || /^imagen[-.]/i.test(model)) return DEFAULT_GEMINI_IMAGE_MODEL;
  return model;
}

type ImageConfig = Awaited<ReturnType<typeof loadImageConfig>>;

/**
 * Resolve the Gemini image model to actually call. A legacy imagen-* selection
 * is rerouted, and any model that is NOT an active entry in the managed registry
 * falls back to the CHEAPEST active model (margin-safe — never an upgrade).
 */
function resolveRegistryModel(registry: ImageModelEntry[], requestedRaw?: string | null): string {
  const requested = normalizeGeminiImageModel(requestedRaw);
  const active = activeModelNames(registry);
  if (active.includes(requested)) return requested;
  const cheapest = cheapestActiveModel(registry);
  return cheapest?.apiName || requested || DEFAULT_GEMINI_IMAGE_MODEL;
}

/**
 * Attempt to automatically recover from an "invalid/unknown model name" error:
 * pull the live list of valid image models from the provider, then pick the
 * CHEAPEST active registry model that the provider currently serves and persist
 * it as the stored model name (no redeploy needed). Returns the new model name
 * when a *different*, valid, cheaper-or-equal replacement was applied, else null
 * (caller then rethrows the original error).
 */
async function autoRecoverImageModel(
  config: ImageConfig,
  registry: ImageModelEntry[],
  attemptedModel: string,
): Promise<string | null> {
  if (!config.geminiKey) return null;
  const { ids } = await fetchLiveGeminiImageModels(config.geminiKey);
  const validNames = new Set(ids);
  const newEntry = cheapestActiveModel(registry, validNames.size > 0 ? validNames : undefined);
  if (!newEntry) return null;
  // If the cheapest valid model is the one we just tried, the failure is not a
  // model-name problem we can fix — don't claim an update; let the caller rethrow.
  if (newEntry.apiName === attemptedModel) return null;
  try {
    await prisma.systemConfig.upsert({
      where: { key: 'IMAGEN_MODEL' },
      update: { value: newEntry.apiName },
      create: { key: 'IMAGEN_MODEL', value: newEntry.apiName },
    });
    if (config.fnImageModel) {
      const imgKeys = FUNCTION_CONFIG_KEYS.image;
      await prisma.systemConfig.upsert({
        where: { key: imgKeys.modelKey },
        update: { value: newEntry.apiName },
        create: { key: imgKeys.modelKey, value: newEntry.apiName },
      });
    }
  } catch (e) {
    console.warn('[imagen] Failed to persist auto-recovered model name:', e);
  }
  invalidateImagenCache();
  console.warn(`[imagen] Auto-recovered invalid image model "${attemptedModel}" -> "${newEntry.apiName}" (cheapest valid).`);
  return newEntry.apiName;
}

/**
 * Run a Gemini image generation with registry-based model resolution and
 * automatic model-name recovery. On an invalid-model error, reconciles the
 * registry against the provider, updates the stored model to the cheapest valid
 * option, and throws ImageModelUpdatedError so the route can prompt a retry.
 */
async function generateGeminiImagesWithRecovery(
  config: ImageConfig,
  key: string,
  prompt: string,
  options: Parameters<typeof generateWithGeminiMultiRef>[3],
  requestedRaw: string | null,
  needsMultimodal: boolean,
): Promise<{ results: ImageGenerationResult[]; usedModel: string }> {
  const registry = await getImageModelRegistry();
  const model = resolveRegistryModel(registry, requestedRaw);
  const ai = await getGeminiClient(key);
  try {
    const results = needsMultimodal
      ? await generateWithGeminiMultiRef(ai, model, prompt, options)
      : await generateWithGemini(ai, model, prompt, options);
    return { results, usedModel: model };
  } catch (err) {
    if (isInvalidModelError(err)) {
      const recovered = await autoRecoverImageModel(config, registry, model);
      if (recovered) throw new ImageModelUpdatedError(model, recovered);
    }
    throw err;
  }
}

import { IMAGE_GENERATION_MODELS } from '@/lib/data/abacus-models';

export interface ImageGenerationResult {
  imageBytes: string; // base64
  mimeType: string;
}

export interface ReferenceImage {
  base64: string;
  mimeType: string;
  role: 'character' | 'environment' | 'style';
  label: string; // e.g. "Sarah", "Dark Alley"
}

// ── Gemini-specific generation functions ──

async function generateWithGemini(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  options: { aspectRatio?: string; numberOfImages?: number }
): Promise<ImageGenerationResult[]> {
  const results: ImageGenerationResult[] = [];
  const count = options.numberOfImages || 1;

  for (let i = 0; i < count; i++) {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'] as any,
        imageConfig: {
          aspectRatio: options.aspectRatio || '16:9',
        } as any,
      } as any,
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).inlineData?.data) {
          results.push({
            imageBytes: (part as any).inlineData.data,
            mimeType: (part as any).inlineData.mimeType || 'image/png',
          });
        }
      }
    }
  }

  return results;
}

async function generateWithImagen(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  options: { aspectRatio?: string; numberOfImages?: number }
): Promise<ImageGenerationResult[]> {
  const response = await ai.models.generateImages({
    model,
    prompt,
    config: {
      numberOfImages: options.numberOfImages || 1,
      aspectRatio: options.aspectRatio || '16:9',
      personGeneration: 'ALLOW_ADULT' as any,
    },
  });

  const results: ImageGenerationResult[] = [];
  if (response.generatedImages) {
    for (const img of response.generatedImages) {
      if (img.image?.imageBytes) {
        results.push({
          imageBytes: img.image.imageBytes,
          mimeType: 'image/png',
        });
      }
    }
  }
  return results;
}

async function generateWithGeminiStyleRef(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  styleImageBase64: string,
  styleMimeType: string,
  options: { aspectRatio?: string; numberOfImages?: number }
): Promise<ImageGenerationResult[]> {
  const results: ImageGenerationResult[] = [];
  const count = options.numberOfImages || 1;

  for (let i = 0; i < count; i++) {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: styleImageBase64,
                mimeType: styleMimeType,
              },
            },
            {
              text: `Use the above image as a visual style reference. Generate a new image matching that visual aesthetic and style. ${prompt}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ['IMAGE'] as any,
        imageConfig: {
          aspectRatio: options.aspectRatio || '16:9',
        } as any,
      } as any,
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).inlineData?.data) {
          results.push({
            imageBytes: (part as any).inlineData.data,
            mimeType: (part as any).inlineData.mimeType || 'image/png',
          });
        }
      }
    }
  }

  return results;
}

/**
 * Gemini multimodal generation with character/environment/style reference images.
 * Combines all reference images into a single multimodal request.
 */
async function generateWithGeminiMultiRef(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  options: {
    aspectRatio?: string;
    numberOfImages?: number;
    styleReferenceImage?: { base64: string; mimeType: string } | null;
    referenceImages?: ReferenceImage[];
  }
): Promise<ImageGenerationResult[]> {
  const results: ImageGenerationResult[] = [];
  const count = options.numberOfImages || 1;
  const refs = options.referenceImages || [];

  for (let i = 0; i < count; i++) {
    const parts: Array<Record<string, unknown>> = [];

    // Add style reference image first
    if (options.styleReferenceImage) {
      parts.push({
        inlineData: {
          data: options.styleReferenceImage.base64,
          mimeType: options.styleReferenceImage.mimeType,
        },
      });
    }

    // Add character/environment reference images
    for (const ref of refs) {
      parts.push({
        inlineData: {
          data: ref.base64,
          mimeType: ref.mimeType,
        },
      });
    }

    // Build text instruction
    const textParts: string[] = [];
    if (options.styleReferenceImage) {
      textParts.push('Use the first image as a visual style reference. Generate a new image matching that visual aesthetic and style.');
    }
    if (refs.length > 0) {
      textParts.push(buildRefImagePreamble(refs));
    }
    textParts.push(prompt);
    parts.push({ text: textParts.join(' ') });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: parts as any }],
      config: {
        responseModalities: ['IMAGE'] as any,
        imageConfig: {
          aspectRatio: options.aspectRatio || '16:9',
        } as any,
      } as any,
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).inlineData?.data) {
          results.push({
            imageBytes: (part as any).inlineData.data,
            mimeType: (part as any).inlineData.mimeType || 'image/png',
          });
        }
      }
    }
  }

  return results;
}

// ── Abacus AI generation function ──

/**
 * Sanitize prompts for content safety compliance with image generation APIs.
 * Replaces terms describing minors with adult-equivalent descriptions.
 */
function sanitizePromptForSafety(text: string): string {
  // Replace terms that describe minors with adult equivalents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replacements: [RegExp, any][] = [
    [/\byoung boy\b/gi, 'young man'],
    [/\byoung girl\b/gi, 'young woman'],
    [/\blittle boy\b/gi, 'young man'],
    [/\blittle girl\b/gi, 'young woman'],
    [/\bteen(?:age)? boy\b/gi, 'young man'],
    [/\bteen(?:age)? girl\b/gi, 'young woman'],
    [/\bteenager\b/gi, 'young adult'],
    [/\bteenagers\b/gi, 'young adults'],
    [/\bteen\b/gi, 'young adult'],
    [/\bteens\b/gi, 'young adults'],
    [/\btoddler\b/gi, 'small adult'],
    [/\btoddlers\b/gi, 'small adults'],
    [/\binfant\b/gi, 'young person'],
    [/\binfants\b/gi, 'young people'],
    [/\bbaby\b/gi, 'young person'],
    [/\bbabies\b/gi, 'young people'],
    [/\bchildren\b/gi, 'young adults'],
    [/\bchild\b/gi, 'young adult'],
    [/\bkids\b/gi, 'young adults'],
    [/\bkid\b/gi, 'young adult'],
    [/\bminor\b/gi, 'young adult'],
    [/\bminors\b/gi, 'young adults'],
    [/\bjuvenile\b/gi, 'young adult'],
    [/\bjuveniles\b/gi, 'young adults'],
    [/\b(\d{1,2})[- ]?year[- ]?old\b/gi, (match: string, age: string) => {
      const ageNum = parseInt(age, 10);
      return ageNum < 18 ? '21-year-old' : match;
    }],
  ];

  let sanitized = text;
  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

async function generateWithAbacus(
  apiKey: string,
  model: string,
  prompt: string,
  options: {
    aspectRatio?: string;
    numberOfImages?: number;
    styleReferenceImage?: { base64: string; mimeType: string } | null;
    referenceImages?: ReferenceImage[];
  }
): Promise<ImageGenerationResult[]> {
  // Sanitize prompt for content safety before sending to API
  const safePrompt = sanitizePromptForSafety(prompt);
  
  const count = options.numberOfImages || 1;
  const results: ImageGenerationResult[] = [];
  const refs = options.referenceImages || [];
  const hasAnyImages = !!options.styleReferenceImage || refs.length > 0;

  for (let i = 0; i < count; i++) {
    let messageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = safePrompt;

    // If any reference images, use multimodal message
    if (hasAnyImages) {
      const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

      // Style reference first
      if (options.styleReferenceImage) {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${options.styleReferenceImage.mimeType};base64,${options.styleReferenceImage.base64}`,
          },
        });
      }

      // Character/environment references
      for (const ref of refs) {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${ref.mimeType};base64,${ref.base64}`,
          },
        });
      }

      // Build text
      const textParts: string[] = [];
      if (options.styleReferenceImage) {
        textParts.push('Use the first image as a visual style reference. Generate a new image matching that visual aesthetic and style.');
      }
      if (refs.length > 0) {
        textParts.push(buildRefImagePreamble(refs));
      }
      textParts.push(safePrompt);

      contentParts.push({ type: 'text', text: textParts.join(' ') });
      messageContent = contentParts;
    }

    // Abacus supports: 1:1, 2:3, 3:2, 3:4, 4:3 (16:9 and 9:16 are Gemini-only)
    const ABACUS_ASPECT_MAP: Record<string, string> = {
      '16:9': '3:2',
      '9:16': '2:3',
      '1:1': '1:1',
      '3:4': '3:4',
      '4:3': '4:3',
    };
    const abacusAspect = ABACUS_ASPECT_MAP[options.aspectRatio || '16:9'] || '3:2';

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: messageContent }],
      modalities: ['image'],
      image_config: {
        aspect_ratio: abacusAspect,
      },
    };

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Abacus image API error: ${response.status} ${response.statusText} ${errText}`);
    }

    const data = await response.json();

    // Abacus returns images in choices[].message.images
    // Format can be: plain data URL string OR {type: "image_url", image_url: {url: "data:..."}}
    if (data.choices) {
      for (const choice of data.choices) {
        const images = choice.message?.images || [];
        for (const img of images) {
          let dataUrl: string | null = null;
          if (typeof img === 'string') {
            dataUrl = img;
          } else if (img?.image_url?.url) {
            dataUrl = img.image_url.url;
          } else if (img?.url) {
            dataUrl = img.url;
          }
          if (dataUrl) {
            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              results.push({
                imageBytes: match[2],
                mimeType: match[1],
              });
            }
          }
        }
      }
    }
  }

  return results;
}

/**
 * Build a text preamble describing the reference images for the model.
 */
function buildRefImagePreamble(refs: ReferenceImage[]): string {
  const parts: string[] = [];
  const chars = refs.filter(r => r.role === 'character');
  const envs = refs.filter(r => r.role === 'environment');
  if (chars.length > 0) {
    parts.push(`The following ${chars.length === 1 ? 'image is a character reference' : 'images are character references'}: ${chars.map(c => `"${c.label}"`).join(', ')}. Use ${chars.length === 1 ? 'this' : 'these'} as the visual reference for ${chars.length === 1 ? 'that character' : 'those characters'} in the generated image.`);
  }
  if (envs.length > 0) {
    parts.push(`The following ${envs.length === 1 ? 'image is an environment/location reference' : 'images are environment/location references'}: ${envs.map(e => `"${e.label}"`).join(', ')}. Use ${envs.length === 1 ? 'this' : 'these'} as the visual reference for the setting/location in the generated image.`);
  }
  return parts.join(' ');
}

// ── OpenAI image generation ──

async function generateWithOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  options: {
    aspectRatio?: string;
    numberOfImages?: number;
  }
): Promise<ImageGenerationResult[]> {
  const count = options.numberOfImages || 1;
  const results: ImageGenerationResult[] = [];

  // Map aspect ratios to OpenAI sizes
  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
    '3:4': '1024x1536',
    '4:3': '1536x1024',
  };
  const size = sizeMap[options.aspectRatio || '16:9'] || '1792x1024';

  // Use the images/generations endpoint for DALL-E, or chat completions for gpt-image-1
  if (model === 'gpt-image-1') {
    // GPT Image uses the images/generations endpoint with response_format b64_json
    const body: Record<string, unknown> = {
      model: 'gpt-image-1',
      prompt: sanitizePromptForSafety(prompt),
      n: count,
      size,
    };

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`OpenAI image API error: ${res.status} ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    for (const item of data.data || []) {
      if (item.b64_json) {
        results.push({ imageBytes: item.b64_json, mimeType: 'image/png' });
      } else if (item.url) {
        // Download the image
        try {
          const imgRes = await fetch(item.url);
          const buf = await imgRes.arrayBuffer();
          results.push({ imageBytes: Buffer.from(buf).toString('base64'), mimeType: 'image/png' });
        } catch { /* skip */ }
      }
    }
  } else {
    // DALL-E 3 - one image at a time
    for (let i = 0; i < count; i++) {
      const body: Record<string, unknown> = {
        model: model || 'dall-e-3',
        prompt: sanitizePromptForSafety(prompt),
        n: 1,
        size,
        response_format: 'b64_json',
      };

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`OpenAI DALL-E API error: ${res.status} ${err.slice(0, 300)}`);
      }

      const data = await res.json();
      for (const item of data.data || []) {
        if (item.b64_json) {
          results.push({ imageBytes: item.b64_json, mimeType: 'image/png' });
        }
      }
    }
  }

  return results;
}

/**
 * Generate images using the configured provider and model.
 * Uses per-function config (FN_IMAGE_PROVIDER/MODEL) first, then legacy config.
 */
export async function generateImage(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
    numberOfImages?: number;
    styleReferenceImage?: { base64: string; mimeType: string } | null;
    referenceImages?: ReferenceImage[];
  } = {}
): Promise<ImageGenerationResult[]> {
  const config = await loadImageConfig();

  let results: ImageGenerationResult[];
  let usedModel: string;
  let usedProvider: ApiProvider;

  const hasRefImages = options.referenceImages && options.referenceImages.length > 0;
  const hasStyleRef = !!options.styleReferenceImage;
  const needsMultimodal = hasRefImages || hasStyleRef;

  // Priority 1: Per-function image config
  if (config.fnImageProvider) {
    const prov = config.fnImageProvider as ApiProvider;
    const key = prov === 'gemini' ? config.geminiKey : prov === 'openai' ? config.openaiKey : config.abacusKey;
    if (key) {
      if (prov === 'openai') {
        usedProvider = 'openai';
        usedModel = config.fnImageModel || 'dall-e-3';
        results = await generateWithOpenAI(key, usedModel, prompt, options);
      } else if (prov === 'gemini') {
        usedProvider = 'gemini';
        const gen = await generateGeminiImagesWithRecovery(
          config, key, prompt, options, config.fnImageModel || config.imagenModel, needsMultimodal,
        );
        results = gen.results;
        usedModel = gen.usedModel;
      } else {
        // Abacus
        usedProvider = 'abacus';
        usedModel = config.fnImageModel || config.abacusImageModel || 'gpt-5.1';
        results = await generateWithAbacus(key, usedModel, prompt, options);
      }

      trackUsage({ eventType: 'image_generate', apiModel: usedModel, apiType: 'imagen', provider: usedProvider, count: results.length, metadata: { aspectRatio: options.aspectRatio || '16:9', styleReference: !!options.styleReferenceImage } });
      if (results.length === 0) throw new Error('No images generated - the prompt may have been filtered');
      return results;
    }
  }

  // Priority 2: Legacy routing
  // ── Abacus AI path ──
  if (config.provider === 'abacus' && config.abacusKey) {
    usedProvider = 'abacus';
    usedModel = config.abacusImageModel || 'gpt-5.1';
    results = await generateWithAbacus(config.abacusKey, usedModel, prompt, options);
  }
  // ── Gemini path ──
  else if (config.geminiKey) {
    usedProvider = 'gemini';
    const gen = await generateGeminiImagesWithRecovery(
      config, config.geminiKey, prompt, options, config.imagenModel, needsMultimodal,
    );
    results = gen.results;
    usedModel = gen.usedModel;
  }
  // ── OpenAI fallback ──
  else if (config.openaiKey) {
    usedProvider = 'openai';
    usedModel = 'dall-e-3';
    results = await generateWithOpenAI(config.openaiKey, usedModel, prompt, options);
  }
  // ── Abacus fallback ──
  else if (config.abacusKey) {
    usedProvider = 'abacus';
    usedModel = config.abacusImageModel || 'gpt-5.1';
    results = await generateWithAbacus(config.abacusKey, usedModel, prompt, options);
  } else {
    throw new Error('No API key configured. Set your API key in Admin > API Configuration.');
  }

  if (results.length === 0) {
    throw new Error('No images generated - the prompt may have been filtered');
  }

  trackUsage({
    eventType: 'image_generate',
    apiModel: usedModel,
    apiType: 'imagen',
    provider: usedProvider,
    count: results.length,
    metadata: { aspectRatio: options.aspectRatio || '16:9', styleReference: !!options.styleReferenceImage },
  });

  return results;
}

/**
 * Generate image with caching. Cache key is based on prompt + options.
 */
export async function generateImageCached(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  } = {}
): Promise<ImageGenerationResult> {
  const result = await generateImage(prompt, { ...options, numberOfImages: 1 });
  return result[0];
}

/**
 * Get available Abacus image models for the admin UI.
 */
export function getAbacusImageModels() {
  return IMAGE_GENERATION_MODELS.map(m => ({ id: m.id, label: m.name }));
}
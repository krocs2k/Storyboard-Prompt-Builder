import { GoogleGenAI } from '@google/genai';
import { cached } from './redis';
import { prisma } from '@/lib/db';
import { trackUsage } from '@/lib/usage-tracker';
import { type ApiProvider } from '@/lib/llm';

// Cache the DB-fetched config for 60 seconds to avoid hitting DB on every call
let cachedDbConfig: {
  geminiKey: string | null;
  abacusKey: string | null;
  provider: ApiProvider;
  imagenModel: string | null;
  abacusImageModel: string | null;
  fetchedAt: number;
} = { geminiKey: null, abacusKey: null, provider: 'gemini', imagenModel: null, abacusImageModel: null, fetchedAt: 0 };
const DB_KEY_CACHE_TTL = 60_000;

/** Immediately bust the in-memory image config cache so next call re-reads from DB */
export function invalidateImagenCache() {
  cachedDbConfig.fetchedAt = 0;
}

async function loadImageConfig() {
  const now = Date.now();
  if (now - cachedDbConfig.fetchedAt < DB_KEY_CACHE_TTL && (cachedDbConfig.geminiKey || cachedDbConfig.abacusKey)) {
    return cachedDbConfig;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['GEMINI_API_KEY', 'ABACUS_API_KEY', 'API_PROVIDER', 'IMAGEN_MODEL', 'ABACUS_IMAGE_MODEL'] } }
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));

    cachedDbConfig = {
      geminiKey: configMap['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY || null,
      abacusKey: configMap['ABACUS_API_KEY'] || process.env.ABACUSAI_API_KEY || null,
      provider: (configMap['API_PROVIDER'] as ApiProvider) || 'gemini',
      imagenModel: configMap['IMAGEN_MODEL'] || null,
      abacusImageModel: configMap['ABACUS_IMAGE_MODEL'] || null,
      fetchedAt: now,
    };
  } catch (e) {
    console.warn('Failed to load image config from DB:', e);
    cachedDbConfig = {
      geminiKey: process.env.GEMINI_API_KEY || null,
      abacusKey: process.env.ABACUSAI_API_KEY || null,
      provider: 'gemini',
      imagenModel: null,
      abacusImageModel: null,
      fetchedAt: now,
    };
  }

  return cachedDbConfig;
}

async function getGeminiClient(): Promise<GoogleGenAI> {
  const config = await loadImageConfig();
  const apiKey = config.geminiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Set it in Admin > API Configuration.');
  return new GoogleGenAI({ apiKey });
}

// Models that use the Imagen generateImages API
const IMAGEN_MODELS = [
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
];

// Models that use the Gemini generateContent API (Nano Banana family)
const GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
];

// Default Abacus image models (exact API model IDs — use underscores, not hyphens)
const ABACUS_IMAGE_MODELS = [
  'gpt-5.1',
  'flux2_pro',
  'flux_pro_ultra',
  'seedream',
  'ideogram',
  'recraft',
  'dalle',
  'nano_banana_pro',
  'nano_banana2',
  'imagen',
];

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
  const count = options.numberOfImages || 1;
  const results: ImageGenerationResult[] = [];
  const refs = options.referenceImages || [];
  const hasAnyImages = !!options.styleReferenceImage || refs.length > 0;

  for (let i = 0; i < count; i++) {
    let messageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = prompt;

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
      textParts.push(prompt);

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

/**
 * Generate images using the configured provider and model.
 * Automatically routes to Gemini SDK or Abacus AI API based on admin settings.
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

  // ── Abacus AI path ──
  if (config.provider === 'abacus' && config.abacusKey) {
    usedProvider = 'abacus';
    usedModel = config.abacusImageModel || 'gpt-5.1';
    results = await generateWithAbacus(config.abacusKey, usedModel, prompt, options);
  }
  // ── Gemini path ──
  else if (config.geminiKey) {
    usedProvider = 'gemini';
    const ai = await getGeminiClient();
    const model = config.imagenModel || 'imagen-4.0-generate-001';

    if (needsMultimodal) {
      // Use Gemini multimodal model when any reference images are present
      const geminiModel = GEMINI_IMAGE_MODELS[0] || 'gemini-3.1-flash-image-preview';
      usedModel = geminiModel;
      results = await generateWithGeminiMultiRef(ai, geminiModel, prompt, options);
    } else if (GEMINI_IMAGE_MODELS.includes(model)) {
      usedModel = model;
      results = await generateWithGemini(ai, model, prompt, options);
    } else {
      usedModel = model;
      results = await generateWithImagen(ai, model, prompt, options);
    }
  }
  // ── Fallback to Abacus if Gemini key missing ──
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
  return ABACUS_IMAGE_MODELS.map(m => ({ id: m, label: m }));
}
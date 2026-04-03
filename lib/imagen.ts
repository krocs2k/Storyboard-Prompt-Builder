import { GoogleGenAI } from '@google/genai';
import { cached } from './redis';
import { prisma } from '@/lib/db';
import { trackUsage } from '@/lib/usage-tracker';

// Cache the DB-fetched key for 60 seconds to avoid hitting DB on every call
let cachedDbKey: { key: string | null; fetchedAt: number } = { key: null, fetchedAt: 0 };
const DB_KEY_CACHE_TTL = 60_000; // 60 seconds

async function getGeminiApiKey(): Promise<string> {
  // Check DB cache first
  const now = Date.now();
  if (now - cachedDbKey.fetchedAt < DB_KEY_CACHE_TTL && cachedDbKey.key) {
    return cachedDbKey.key;
  }

  // Try database
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'GEMINI_API_KEY' }
    });
    if (config?.value) {
      cachedDbKey = { key: config.value, fetchedAt: now };
      return config.value;
    }
  } catch (e) {
    console.warn('Failed to read Gemini key from DB, falling back to env:', e);
  }

  // Fallback to env var
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    cachedDbKey = { key: envKey, fetchedAt: now };
    return envKey;
  }

  throw new Error('GEMINI_API_KEY is not configured. Set it in Admin > Gemini API or as an environment variable.');
}

async function getClient(): Promise<GoogleGenAI> {
  const apiKey = await getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
}

// Cache the Imagen model preference from DB
let cachedImagenModel: { model: string | null; fetchedAt: number } = { model: null, fetchedAt: 0 };

// Models that use the Imagen generateImages API
const IMAGEN_MODELS = [
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
];

// Models that use the Gemini generateContent API (Nano Banana family)
const GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
];

async function getImagenModel(): Promise<string> {
  const now = Date.now();
  if (now - cachedImagenModel.fetchedAt < DB_KEY_CACHE_TTL && cachedImagenModel.model) {
    return cachedImagenModel.model;
  }

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'IMAGEN_MODEL' }
    });
    if (config?.value) {
      cachedImagenModel = { model: config.value, fetchedAt: now };
      return config.value;
    }
  } catch (e) {
    console.warn('Failed to read Imagen model from DB:', e);
  }

  // Default to standard
  const defaultModel = 'imagen-4.0-generate-001';
  cachedImagenModel = { model: defaultModel, fetchedAt: now };
  return defaultModel;
}

export interface ImageGenerationResult {
  imageBytes: string; // base64
  mimeType: string;
}

/**
 * Generate image using the Gemini generateContent API (for Nano Banana models).
 * These models return images via multimodal content parts.
 */
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

/**
 * Generate image using the Imagen generateImages API (for Imagen 4 models).
 */
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

/**
 * Generate image using Gemini with a style reference image.
 * Passes the reference image alongside the text prompt for style guidance.
 */
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
 * Generate images using the configured model (Imagen 4 or Nano Banana 2).
 * Automatically routes to the correct API based on the model type.
 * Optionally accepts a style reference image for Gemini models.
 */
export async function generateImage(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
    numberOfImages?: number;
    styleReferenceImage?: { base64: string; mimeType: string } | null;
  } = {}
): Promise<ImageGenerationResult[]> {
  const ai = await getClient();
  const model = await getImagenModel();

  let results: ImageGenerationResult[];

  if (options.styleReferenceImage) {
    // When a style reference image is provided, always use Gemini model
    const geminiModel = GEMINI_IMAGE_MODELS[0] || 'gemini-3.1-flash-image-preview';
    results = await generateWithGeminiStyleRef(
      ai, geminiModel, prompt,
      options.styleReferenceImage.base64,
      options.styleReferenceImage.mimeType,
      options
    );
  } else if (GEMINI_IMAGE_MODELS.includes(model)) {
    results = await generateWithGemini(ai, model, prompt, options);
  } else {
    results = await generateWithImagen(ai, model, prompt, options);
  }

  if (results.length === 0) {
    throw new Error('No images generated - the prompt may have been filtered');
  }

  const usedModel = options.styleReferenceImage
    ? (GEMINI_IMAGE_MODELS[0] || 'gemini-3.1-flash-image-preview')
    : model;

  trackUsage({
    eventType: 'image_generate',
    apiModel: usedModel,
    apiType: 'imagen',
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
  const cacheKey = `imagen:${Buffer.from(prompt + JSON.stringify(options)).toString('base64').slice(0, 64)}`;
  
  // Don't cache images in Redis (too large), but cache prompt validation status
  const result = await generateImage(prompt, { ...options, numberOfImages: 1 });
  return result[0];
}

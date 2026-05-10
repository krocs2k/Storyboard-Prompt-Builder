/**
 * Video Generation Module — Gemini Veo + OpenAI Sora
 * 
 * Uses per-function config from FN_VIDEO_PROVIDER / FN_VIDEO_MODEL.
 * Falls back to first available video-capable provider.
 * 
 * Gemini: Uses @google/genai SDK generateVideos (async polling)
 * OpenAI: Uses /v1/video/generations API (async polling) — deprecated Sept 2026
 */

import { GoogleGenAI } from '@google/genai';
import { getProviderKeys, type ApiProvider } from '@/lib/llm';
import { trackUsage } from '@/lib/usage-tracker';
import { PROVIDERS, getProviderModels } from '@/lib/data/provider-models';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const VIDEO_DIR = path.join(DATA_DIR, 'videos');

// Ensure video directory exists
if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

export interface VideoGenerationResult {
  videoUrl: string;
  provider: ApiProvider;
  model: string;
}

export interface VideoGenerationOptions {
  prompt: string;
  startFrameUrl?: string | null;
  endFrameUrl?: string | null;
  aspectRatio?: '16:9' | '9:16';
}

// ────────────────────────────────────────────────────────────
// Prompt Scrubbing — sanitize prompts that might be filtered
// ────────────────────────────────────────────────────────────

/**
 * Scrub a prompt to make it more likely to pass provider content filters.
 * Expands terse/generic prompts and removes potentially problematic terms.
 */
function scrubPrompt(rawPrompt: string, attempt: number = 0): string {
  let p = rawPrompt.trim();

  // Expansion map for overly terse / generic prompts
  const expansions: Record<string, string> = {
    'establishing sequence': 'A sweeping cinematic establishing shot showing a wide landscape panorama with dramatic natural lighting, golden hour atmosphere, and smooth camera movement revealing the scene',
    'establishing shot': 'A wide cinematic establishing shot of a scenic landscape with dramatic lighting and atmospheric depth, camera slowly panning across the scene',
    'transition': 'A smooth cinematic transition with gentle camera movement, soft lighting shifts, and atmospheric visual flow between scenes',
    'montage': 'A dynamic cinematic montage sequence with varied angles, rhythmic editing pace, and visually compelling compositions',
    'close up': 'A detailed cinematic close-up shot with shallow depth of field, dramatic lighting, and rich visual texture',
    'wide shot': 'A grand cinematic wide shot capturing the full scope of the environment with atmospheric depth and dramatic natural lighting',
    'opening': 'A captivating cinematic opening shot with dramatic lighting, atmospheric depth, and a slow revealing camera movement',
    'finale': 'A dramatic cinematic finale shot with sweeping camera movement, rich atmospheric lighting, and visual grandeur',
  };

  // Check if the prompt is very short/generic and expand it
  const lower = p.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (expansions[lower]) {
    p = expansions[lower];
  } else if (p.length < 20) {
    // Very short prompt — add cinematic context
    p = `A cinematic shot depicting: ${p}. Professional filmmaking quality with dramatic lighting and atmospheric depth.`;
  }

  // On retry attempts, add more descriptive context to avoid repeated filtering
  if (attempt > 0) {
    const retryEnhancements = [
      ' The scene features rich visual detail, natural color grading, and professional cinematography.',
      ' Shot with anamorphic lenses, featuring gentle camera movement and atmospheric haze.',
      ' Beautifully composed frame with leading lines, natural textures, and cinematic color palette.',
    ];
    p += retryEnhancements[Math.min(attempt - 1, retryEnhancements.length - 1)];
  }

  // Remove any potentially problematic words/phrases (content filter triggers)
  const problematicPatterns = [
    /\b(gore|gory|bloody|blood|violent|violence|weapon|gun|knife|kill|murder|death|dead|corpse)\b/gi,
    /\b(nude|naked|nsfw|explicit|sexual|erotic)\b/gi,
    /\b(drug|cocaine|heroin|meth|overdose)\b/gi,
    /\b(suicide|self.?harm|cutting)\b/gi,
    /\b(terrorist|terrorism|bomb|explosive)\b/gi,
  ];

  for (const pattern of problematicPatterns) {
    p = p.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
  }

  return p;
}

/**
 * Resolve which provider+model+key to use for video generation.
 * Only gemini and openai support video.
 */
async function resolveVideoConfig(): Promise<{
  provider: ApiProvider;
  model: string;
  apiKey: string;
}> {
  const keys = await getProviderKeys();
  const fnCfg = keys.fnConfig['video'];

  // Priority 1: Explicit per-function config
  if (fnCfg?.provider) {
    const prov = fnCfg.provider as ApiProvider;
    if (prov !== 'gemini' && prov !== 'openai') {
      throw new Error('Video generation only supports Gemini and OpenAI providers.');
    }
    const key = prov === 'gemini' ? keys.geminiKey : keys.openaiKey;
    if (!key) throw new Error(`No API key found for ${PROVIDERS[prov].name}. Configure it in Admin > API Configuration.`);

    const model = fnCfg.model || getDefaultVideoModel(prov);
    return { provider: prov, model, apiKey: key };
  }

  // Priority 2: First available video-capable provider
  if (keys.geminiKey) {
    return { provider: 'gemini', model: getDefaultVideoModel('gemini'), apiKey: keys.geminiKey };
  }
  if (keys.openaiKey) {
    return { provider: 'openai', model: getDefaultVideoModel('openai'), apiKey: keys.openaiKey };
  }

  throw new Error('No video-capable API key configured. Add a Gemini or OpenAI key in Admin > API Configuration.');
}

function getDefaultVideoModel(prov: ApiProvider): string {
  const models = getProviderModels(prov, 'video');
  return models[0]?.id || (prov === 'gemini' ? 'veo-3.1-generate-preview' : 'sora-2');
}

/**
 * Get the video model info for the currently configured model.
 */
export async function getVideoModelInfo(): Promise<{
  provider: string;
  model: string;
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
} | null> {
  try {
    const cfg = await resolveVideoConfig();
    const models = getProviderModels(cfg.provider, 'video');
    const modelInfo = models.find(m => m.id === cfg.model);
    return {
      provider: cfg.provider,
      model: cfg.model,
      supportsStartFrame: !!modelInfo?.supportsStartFrame,
      supportsEndFrame: !!modelInfo?.supportsEndFrame,
    };
  } catch {
    return null;
  }
}

/**
 * Persist a video from a URL or base64 data to local disk and return a serving URL.
 */
async function persistVideo(videoUrl: string): Promise<string> {
  const videoId = randomUUID();
  const fileName = `${videoId}.mp4`;
  const filePath = path.join(VIDEO_DIR, fileName);

  if (videoUrl.startsWith('data:video/')) {
    // Base64 data URL
    const base64Match = videoUrl.match(/^data:video\/[^;]+;base64,(.+)$/);
    if (base64Match) {
      fs.writeFileSync(filePath, Buffer.from(base64Match[1], 'base64'));
      console.log(`[video-gen] Persisted base64 video to ${filePath} (${fs.statSync(filePath).size} bytes)`);
      return `/api/director/video-file/${fileName}`;
    }
  }

  if (videoUrl.startsWith('http')) {
    // Download from URL
    try {
      const res = await fetch(videoUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 1000) { // Sanity check: at least 1KB
          fs.writeFileSync(filePath, buffer);
          console.log(`[video-gen] Persisted remote video to ${filePath} (${buffer.length} bytes)`);
          return `/api/director/video-file/${fileName}`;
        }
      }
    } catch (e) {
      console.warn(`[video-gen] Failed to download video for persistence:`, e);
    }
  }

  // Can't persist — return original URL
  return videoUrl;
}

/**
 * Generate a video using the configured provider.
 * Includes prompt scrubbing and retry logic (up to 3 attempts).
 * Videos are persisted locally for reliable playback.
 */
export async function generateVideo(options: VideoGenerationOptions): Promise<VideoGenerationResult> {
  const config = await resolveVideoConfig();
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const scrubbedPrompt = scrubPrompt(options.prompt, attempt);
    console.log(`[video-gen] Attempt ${attempt + 1}/${MAX_RETRIES} with prompt: "${scrubbedPrompt.slice(0, 100)}..."`);

    try {
      const optionsWithScrub = { ...options, prompt: scrubbedPrompt };
      let result: VideoGenerationResult;

      if (config.provider === 'gemini') {
        result = await generateWithGeminiVeo(config.apiKey, config.model, optionsWithScrub);
      } else if (config.provider === 'openai') {
        result = await generateWithOpenAISora(config.apiKey, config.model, optionsWithScrub);
      } else {
        throw new Error(`Unsupported video provider: ${config.provider}`);
      }

      // Persist the video locally for reliable playback
      const persistedUrl = await persistVideo(result.videoUrl);
      result.videoUrl = persistedUrl;

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isFilterError = lastError.message.includes('filtered') ||
        lastError.message.includes('No video generated') ||
        lastError.message.includes('SAFETY') ||
        lastError.message.includes('blocked');

      if (isFilterError && attempt < MAX_RETRIES - 1) {
        console.warn(`[video-gen] Attempt ${attempt + 1} filtered/blocked, retrying with enhanced prompt...`);
        // Brief pause before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      // Non-filter error or last attempt — throw
      throw lastError;
    }
  }

  throw lastError || new Error('Video generation failed after all retries');
}

// ────────────────────────────────────────────────────────────
// Gemini Veo via @google/genai SDK
// ────────────────────────────────────────────────────────────

async function generateWithGeminiVeo(
  apiKey: string,
  model: string,
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const ai = new GoogleGenAI({ apiKey });

  const generateConfig: Record<string, unknown> = {
    aspectRatio: options.aspectRatio || '16:9',
  };

  // Build request params
  const params: Record<string, unknown> = {
    model,
    prompt: options.prompt,
    config: generateConfig,
  };

  // Handle start/end frame images
  if (options.startFrameUrl || options.endFrameUrl) {
    const image = await prepareGeminiFrameImage(options.startFrameUrl || options.endFrameUrl || '');
    if (image) {
      params.image = image;
    }
  }

  console.log(`[video-gen] Starting Gemini Veo generation with model ${model}...`);

  // generateVideos is async — returns an operation to poll
  let operation = await (ai.models as any).generateVideos(params);

  // Poll until done (max 5 minutes)
  const maxPolls = 60;
  let pollCount = 0;
  while (!operation.done && pollCount < maxPolls) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5s between polls
    operation = await (ai.operations as any).getVideosOperation({ operation });
    pollCount++;
    if (pollCount % 6 === 0) {
      console.log(`[video-gen] Polling... (${pollCount * 5}s elapsed)`);
    }
  }

  if (!operation.done) {
    throw new Error('Video generation timed out after 5 minutes');
  }

  // Extract video URL from response
  const generatedVideos = operation.response?.generatedVideos || [];
  if (generatedVideos.length === 0) {
    throw new Error('No video generated — the prompt may have been filtered');
  }

  const video = generatedVideos[0];
  let videoUrl = '';

  // The video object may have a uri or we may need to save it
  if (video.video?.uri) {
    videoUrl = video.video.uri;
  } else if (video.video?.videoBytes) {
    // Convert bytes to data URL as fallback
    videoUrl = `data:video/mp4;base64,${video.video.videoBytes}`;
  } else {
    // Try to download and get a URI
    try {
      // Save to a temp location and serve
      const fileResult = video.video;
      if (fileResult && typeof fileResult === 'object') {
        // Check for download URI in the file metadata
        const uri = (fileResult as any).uri || (fileResult as any).downloadUri;
        if (uri) videoUrl = uri;
      }
    } catch (e) {
      console.error('[video-gen] Failed to extract video URL:', e);
    }
  }

  if (!videoUrl) {
    console.error('[video-gen] Full response:', JSON.stringify(operation.response).slice(0, 1000));
    throw new Error('Could not extract video URL from Gemini response');
  }

  console.log(`[video-gen] Gemini Veo generation complete. URL length: ${videoUrl.length}`);

  return {
    videoUrl,
    provider: 'gemini',
    model,
  };
}

async function prepareGeminiFrameImage(imageUrl: string): Promise<Record<string, unknown> | null> {
  if (!imageUrl) return null;

  try {
    // If it's a data URL, extract base64
    const dataMatch = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) {
      return {
        imageBytes: dataMatch[2],
        mimeType: dataMatch[1],
      };
    }

    // If it's a regular URL, fetch and convert
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = res.headers.get('content-type') || 'image/png';
    return { imageBytes: base64, mimeType };
  } catch (e) {
    console.warn('[video-gen] Failed to prepare frame image:', e);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// OpenAI Sora (deprecated September 2026)
// ────────────────────────────────────────────────────────────

async function generateWithOpenAISora(
  apiKey: string,
  model: string,
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  console.log(`[video-gen] Starting OpenAI Sora generation with model ${model}...`);
  console.warn('[video-gen] ⚠️ OpenAI Sora API is deprecated and will shut down September 24, 2026');

  // Step 1: Create video generation job
  const createBody: Record<string, unknown> = {
    model,
    input: [
      { type: 'text', text: options.prompt },
    ],
  };

  // Add start frame if provided
  if (options.startFrameUrl) {
    (createBody.input as Array<Record<string, unknown>>).unshift({
      type: 'image_url',
      image_url: { url: options.startFrameUrl },
    });
  }

  const createRes = await fetch('https://api.openai.com/v1/video/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`OpenAI Sora API error: ${createRes.status} ${errText.slice(0, 300)}`);
  }

  const createData = await createRes.json();
  const videoId = createData.id;
  if (!videoId) {
    throw new Error('No video ID returned from OpenAI Sora');
  }

  // Step 2: Poll until complete
  const maxPolls = 60;
  let pollCount = 0;
  let videoUrl = '';

  while (pollCount < maxPolls) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    pollCount++;

    const statusRes = await fetch(`https://api.openai.com/v1/video/generations/${videoId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!statusRes.ok) {
      throw new Error(`OpenAI status poll failed: ${statusRes.status}`);
    }

    const statusData = await statusRes.json();

    if (statusData.status === 'completed') {
      // Extract video URL
      if (statusData.output?.url) {
        videoUrl = statusData.output.url;
      } else if (statusData.output?.download_url) {
        videoUrl = statusData.output.download_url;
      } else if (statusData.data?.[0]?.url) {
        videoUrl = statusData.data[0].url;
      }
      break;
    } else if (statusData.status === 'failed') {
      throw new Error(`Video generation failed: ${statusData.error?.message || 'Unknown error'}`);
    }

    if (pollCount % 6 === 0) {
      console.log(`[video-gen] OpenAI polling... (${pollCount * 5}s elapsed, status: ${statusData.status})`);
    }
  }

  if (!videoUrl) {
    throw new Error('Video generation timed out or no URL returned');
  }

  console.log(`[video-gen] OpenAI Sora generation complete.`);

  return {
    videoUrl,
    provider: 'openai',
    model,
  };
}

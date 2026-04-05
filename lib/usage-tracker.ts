/**
 * Usage Tracking Utility
 * Tracks API calls, content creation, and estimated costs for the reporting dashboard.
 * All tracking is fire-and-forget to avoid impacting request latency.
 */

import { prisma } from '@/lib/db';

export type EventType =
  | 'story_idea'
  | 'story_concept'
  | 'screenplay_generate'
  | 'screenplay_convert'
  | 'screenplay_analyze'
  | 'storyboard_generate'
  | 'prompt_generate'
  | 'image_generate'
  | 'image_grid_detect';

export type ApiType = 'llm' | 'imagen';
export type Provider = 'gemini' | 'abacus';

interface TrackOptions {
  userId?: string;
  eventType: EventType;
  apiModel?: string;
  apiType?: ApiType;
  provider?: Provider;
  count?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Track a usage event. Fire-and-forget — errors are logged but never thrown.
 */
export function trackUsage(options: TrackOptions): void {
  prisma.usageEvent.create({
    data: {
      userId: options.userId || null,
      eventType: options.eventType,
      apiModel: options.apiModel || null,
      apiType: options.apiType || null,
      provider: options.provider || null,
      count: options.count ?? 1,
      metadata: options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : undefined,
    },
  }).catch((err) => {
    console.warn('[UsageTracker] Failed to record event:', err?.message || err);
  });
}

/**
 * Gemini API cost rates (per call or per image) — direct Gemini usage.
 */
export const GEMINI_COST_RATES: Record<string, { label: string; costPerUnit: number; unit: string }> = {
  'gemini-3-flash-preview': {
    label: 'Gemini 3 Flash',
    costPerUnit: 0.0065,
    unit: 'call',
  },
  'imagen-4.0-generate-001': {
    label: 'Imagen 4 Standard',
    costPerUnit: 0.04,
    unit: 'image',
  },
  'imagen-4.0-fast-generate-001': {
    label: 'Imagen 4 Fast',
    costPerUnit: 0.02,
    unit: 'image',
  },
  'gemini-3.1-flash-image-preview': {
    label: 'Nano Banana 2',
    costPerUnit: 0.067,
    unit: 'image',
  },
};

/**
 * Abacus AI API cost rates — auto-generated from the centralized model registry.
 * Rates sourced from /v1/models API endpoint (credits ≈ USD).
 * Image/video models use per-unit rate; text models use per-call estimate.
 */
import {
  IMAGE_GENERATION_MODELS,
  TEXT_GENERATION_MODELS,
  VIDEO_GENERATION_MODELS,
  AUDIO_GENERATION_MODELS,
} from '@/lib/data/abacus-models';

function buildAbacusCostRates(): Record<string, { label: string; costPerUnit: number; unit: string }> {
  const rates: Record<string, { label: string; costPerUnit: number; unit: string }> = {};

  // Image generation models — rate = credits per image
  for (const m of IMAGE_GENERATION_MODELS) {
    if (m.rate) {
      rates[m.id] = { label: m.name, costPerUnit: m.rate, unit: 'image' };
    }
  }

  // Video generation models — rate = credits per video
  for (const m of VIDEO_GENERATION_MODELS) {
    if (m.rate) {
      rates[m.id] = { label: m.name, costPerUnit: m.rate, unit: 'video' };
    }
  }

  // Text generation models — estimate per-call cost assuming ~2K tokens in + 1K tokens out
  for (const m of TEXT_GENERATION_MODELS) {
    if (m.inputTokenRate && m.outputTokenRate) {
      const perCall = (m.inputTokenRate * 2000) + (m.outputTokenRate * 1000);
      rates[m.id] = { label: m.name, costPerUnit: Math.round(perCall * 100000) / 100000, unit: 'call' };
    }
  }

  // Audio generation models
  for (const m of AUDIO_GENERATION_MODELS) {
    if (m.inputTokenRate && m.outputTokenRate) {
      const perCall = (m.inputTokenRate * 2000) + (m.outputTokenRate * 1000);
      rates[m.id] = { label: m.name, costPerUnit: Math.round(perCall * 100000) / 100000, unit: 'call' };
    }
  }

  return rates;
}

export const ABACUS_COST_RATES = buildAbacusCostRates();

/**
 * Unified cost rates map combining both providers.
 */
export const ALL_COST_RATES: Record<string, Record<string, { label: string; costPerUnit: number; unit: string }>> = {
  gemini: GEMINI_COST_RATES,
  abacus: ABACUS_COST_RATES,
};

/**
 * Get cost rate for a model, optionally scoped to a provider.
 */
export function getCostRate(model: string, provider?: string): { label: string; costPerUnit: number; unit: string } | null {
  if (provider && ALL_COST_RATES[provider]?.[model]) {
    return ALL_COST_RATES[provider][model];
  }
  // Fallback: check both providers
  return GEMINI_COST_RATES[model] || ABACUS_COST_RATES[model] || null;
}
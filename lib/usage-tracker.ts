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
 * Gemini API cost rates (per call or per image).
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
 * Abacus AI API cost rates (approximate per-image estimates).
 * Model IDs use exact Abacus API names (underscores, not hyphens).
 * Actual costs depend on your Abacus.AI plan — these are estimates.
 */
export const ABACUS_COST_RATES: Record<string, { label: string; costPerUnit: number; unit: string }> = {
  'gemini-3-flash-preview': {
    label: 'Gemini 3 Flash (via Abacus)',
    costPerUnit: 0.0065,
    unit: 'call',
  },
  'gpt-5.1': {
    label: 'GPT-5.1 Image Gen',
    costPerUnit: 0.04,
    unit: 'image',
  },
  'flux2_pro': {
    label: 'Flux 2 Pro',
    costPerUnit: 0.05,
    unit: 'image',
  },
  'flux_pro_ultra': {
    label: 'Flux Pro Ultra',
    costPerUnit: 0.06,
    unit: 'image',
  },
  'seedream': {
    label: 'Seedream',
    costPerUnit: 0.03,
    unit: 'image',
  },
  'ideogram': {
    label: 'Ideogram',
    costPerUnit: 0.04,
    unit: 'image',
  },
  'recraft': {
    label: 'Recraft',
    costPerUnit: 0.04,
    unit: 'image',
  },
  'dalle': {
    label: 'DALL-E',
    costPerUnit: 0.04,
    unit: 'image',
  },
  'nano_banana_pro': {
    label: 'Nano Banana Pro',
    costPerUnit: 0.03,
    unit: 'image',
  },
  'nano_banana2': {
    label: 'Nano Banana 2',
    costPerUnit: 0.03,
    unit: 'image',
  },
  'imagen': {
    label: 'Imagen (via Abacus)',
    costPerUnit: 0.04,
    unit: 'image',
  },
};

/**
 * Unified cost rates map combining both providers.
 * Provider-prefixed keys for disambiguation when same model name exists in both.
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
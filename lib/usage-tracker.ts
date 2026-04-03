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

interface TrackOptions {
  userId?: string;
  eventType: EventType;
  apiModel?: string;
  apiType?: ApiType;
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
      count: options.count ?? 1,
      metadata: options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : undefined,
    },
  }).catch((err) => {
    console.warn('[UsageTracker] Failed to record event:', err?.message || err);
  });
}

/**
 * Gemini API cost rates (per call or per image).
 * Based on published Google Gemini API pricing as of March 2026.
 */
export const GEMINI_COST_RATES: Record<string, { label: string; costPerUnit: number; unit: string }> = {
  // LLM text models — estimated average cost per call
  // gemini-3-flash-preview: ~1K input tokens + ~2K output tokens ≈ $0.0065/call
  'gemini-3-flash-preview': {
    label: 'Gemini 3 Flash',
    costPerUnit: 0.0065,
    unit: 'call',
  },
  // Image generation models
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
  // Nano Banana 2 (Gemini 3.1 Flash Image) — ~$0.067/image at 1K resolution
  'gemini-3.1-flash-image-preview': {
    label: 'Nano Banana 2',
    costPerUnit: 0.067,
    unit: 'image',
  },
};

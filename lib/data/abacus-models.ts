/**
 * Abacus AI RouteLLM API - Complete Model Registry
 * 
 * All models available through the Abacus AI /v1/chat/completions and /v1/models endpoints.
 * Organized by category with both Model IDs (for API calls) and Display Names (for UI).
 * Pricing sourced from the /v1/models API endpoint (rates in USD, not credits).
 * 
 * Source: https://abacus.ai/help/developer-platform/route-llm/
 * Last synced: October 2026 (text models); other categories April 2026
 */

export interface AbacusModel {
  /** The exact model ID used in API requests (e.g. 'gpt-5.1', 'claude-sonnet-4-20250514') */
  id: string;
  /** Human-readable display name (e.g. 'GPT-5.1', 'Claude Sonnet 4') */
  name: string;
  /** Brief description of the model's capabilities */
  description?: string;
  /** Provider/vendor name */
  provider: string;
  /** Model category */
  category: ModelCategory;
  /** Human-readable cost summary (e.g. '$2.50/$10.00 per 1M tokens' or '$4/image') */
  cost?: string;
  /** Input token rate in USD (per token) — for text/audio models */
  inputTokenRate?: number;
  /** Output token rate in USD (per token) — for text/audio models */
  outputTokenRate?: number;
  /** Cached input token rate in USD (per token) — when available */
  cachedInputTokenRate?: number;
  /** Per-image/per-video rate in credits — for image/video models */
  rate?: number;
  /** Input modalities supported */
  inputModalities?: string[];
  /** Output modalities supported */
  outputModalities?: string[];
  /** Image gen: supports reference/input images for style or subject guidance */
  supportsRefImage?: boolean;
  /** Video gen: supports a start-frame image input */
  supportsStartFrame?: boolean;
  /** Video gen: supports an end-frame image input */
  supportsEndFrame?: boolean;
}

export type ModelCategory = 
  | 'text_generation'
  | 'image_generation'
  | 'video_generation'
  | 'audio_generation';

/** Format token rate as $/1M tokens for readability */
function fmtTokenCost(inputRate: number, outputRate: number, cachedRate?: number): string {
  const inp = (inputRate * 1_000_000).toFixed(2).replace(/\.?0+$/, '');
  const out = (outputRate * 1_000_000).toFixed(2).replace(/\.?0+$/, '');
  let s = `$${inp}/$${out} per 1M tok`;
  if (cachedRate) {
    const c = (cachedRate * 1_000_000).toFixed(2).replace(/\.?0+$/, '');
    s += ` (cached: $${c})`;
  }
  return s;
}

// ────────────────────────────────────────────────────────────
// TEXT GENERATION MODELS
// ────────────────────────────────────────────────────────────

export const TEXT_GENERATION_MODELS: AbacusModel[] = [
  // Synced from the live Abacus /v1/models endpoint (October 2026). Rates are USD per token.

  // ── Abacus AI ──
  { id: 'route-llm', name: 'RouteLLM', provider: 'Abacus AI', category: 'text_generation', description: 'Smart router — auto-selects the best model', cost: fmtTokenCost(0.000002, 0.00001, 0.0000002), inputTokenRate: 0.000002, outputTokenRate: 0.00001, cachedInputTokenRate: 0.0000002 },
  { id: 'route-llm-code', name: 'RouteLLM (Code)', provider: 'Abacus AI', category: 'text_generation', description: 'Smart router tuned for code', cost: fmtTokenCost(0.000002, 0.00001), inputTokenRate: 0.000002, outputTokenRate: 0.00001 },
  { id: 'route-llm-code-low', name: 'RouteLLM (Code, Low)', provider: 'Abacus AI', category: 'text_generation', description: 'Low-cost code router', cost: fmtTokenCost(0.00000022, 0.00000066, 0.000000007), inputTokenRate: 0.00000022, outputTokenRate: 0.00000066, cachedInputTokenRate: 0.000000007 },
  { id: 'abacusai/Smaug-Flash', name: 'Smaug Flash', provider: 'Abacus AI', category: 'text_generation', description: 'Fast, low-cost Abacus model', cost: fmtTokenCost(0.0000001, 0.0000004, 0.000000005), inputTokenRate: 0.0000001, outputTokenRate: 0.0000004, cachedInputTokenRate: 0.000000005 },

  // ── OpenAI ──
  { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', provider: 'OpenAI', category: 'text_generation', description: 'Latest GPT-6.1 flagship', cost: fmtTokenCost(0.000002, 0.00001, 0.0000001), inputTokenRate: 0.000002, outputTokenRate: 0.00001, cachedInputTokenRate: 0.0000001 },
  { id: 'gpt-6-astra', name: 'GPT-6 Astra', provider: 'OpenAI', category: 'text_generation', description: 'Premium GPT-6 tier', cost: fmtTokenCost(0.00001, 0.00005, 0.000001), inputTokenRate: 0.00001, outputTokenRate: 0.00005, cachedInputTokenRate: 0.000001 },
  { id: 'gpt-6-sol', name: 'GPT-6 Sol', provider: 'OpenAI', category: 'text_generation', description: 'Balanced GPT-6 model', cost: fmtTokenCost(0.000002, 0.00001, 0.0000002), inputTokenRate: 0.000002, outputTokenRate: 0.00001, cachedInputTokenRate: 0.0000002 },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna', provider: 'OpenAI', category: 'text_generation', description: 'Ultra-low-cost GPT-6', cost: fmtTokenCost(0.0000001, 0.0000005, 0.00000001), inputTokenRate: 0.0000001, outputTokenRate: 0.0000005, cachedInputTokenRate: 0.00000001 },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'OpenAI', category: 'text_generation', description: 'High-quality GPT-5.6', cost: fmtTokenCost(0.000004, 0.00002, 0.0000004), inputTokenRate: 0.000004, outputTokenRate: 0.00002, cachedInputTokenRate: 0.0000004 },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', provider: 'OpenAI', category: 'text_generation', description: 'Balanced GPT-5.6', cost: fmtTokenCost(0.000002, 0.000012, 0.0000002), inputTokenRate: 0.000002, outputTokenRate: 0.000012, cachedInputTokenRate: 0.0000002 },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'OpenAI', category: 'text_generation', description: 'Low-cost GPT-5.6', cost: fmtTokenCost(0.0000002, 0.0000012, 0.00000002), inputTokenRate: 0.0000002, outputTokenRate: 0.0000012, cachedInputTokenRate: 0.00000002 },
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'OpenAI', category: 'text_generation', description: 'GPT-5.5 flagship', cost: fmtTokenCost(0.000005, 0.00003, 0.0000005), inputTokenRate: 0.000005, outputTokenRate: 0.00003, cachedInputTokenRate: 0.0000005 },
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', category: 'text_generation', description: 'GPT-5.4 flagship', cost: fmtTokenCost(0.0000025, 0.000015, 0.00000025), inputTokenRate: 0.0000025, outputTokenRate: 0.000015, cachedInputTokenRate: 0.00000025 },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Compact GPT-5.4', cost: fmtTokenCost(0.00000075, 0.0000045, 0.000000075), inputTokenRate: 0.00000075, outputTokenRate: 0.0000045, cachedInputTokenRate: 0.000000075 },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', provider: 'OpenAI', category: 'text_generation', description: 'Ultra-lightweight GPT-5.4', cost: fmtTokenCost(0.0000002, 0.00000125, 0.00000002), inputTokenRate: 0.0000002, outputTokenRate: 0.00000125, cachedInputTokenRate: 0.00000002 },
  { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', provider: 'OpenAI', category: 'text_generation', description: 'Code-specialized GPT-5.3', cost: fmtTokenCost(0.00000175, 0.000014, 0.000000175), inputTokenRate: 0.00000175, outputTokenRate: 0.000014, cachedInputTokenRate: 0.000000175 },
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', category: 'text_generation', description: 'High-quality reasoning and generation', cost: fmtTokenCost(0.00000175, 0.000014, 0.000000175), inputTokenRate: 0.00000175, outputTokenRate: 0.000014, cachedInputTokenRate: 0.000000175 },
  { id: 'gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI', category: 'text_generation', description: 'Versatile GPT-5.1', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', category: 'text_generation', description: 'Advanced reasoning and generation', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Lightweight GPT-5', cost: fmtTokenCost(0.00000025, 0.000002, 0.000000025), inputTokenRate: 0.00000025, outputTokenRate: 0.000002, cachedInputTokenRate: 0.000000025 },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI', category: 'text_generation', description: 'Fastest and cheapest GPT-5', cost: fmtTokenCost(0.00000005, 0.0000004, 0.000000005), inputTokenRate: 0.00000005, outputTokenRate: 0.0000004, cachedInputTokenRate: 0.000000005 },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', category: 'text_generation', description: 'Fast and reliable', cost: fmtTokenCost(0.000002, 0.000008, 0.0000005), inputTokenRate: 0.000002, outputTokenRate: 0.000008, cachedInputTokenRate: 0.0000005 },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Smaller, faster GPT-4.1', cost: fmtTokenCost(0.0000004, 0.0000016, 0.0000001), inputTokenRate: 0.0000004, outputTokenRate: 0.0000016, cachedInputTokenRate: 0.0000001 },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI', category: 'text_generation', description: 'Cheapest GPT-4.1', cost: fmtTokenCost(0.0000001, 0.0000004, 0.000000025), inputTokenRate: 0.0000001, outputTokenRate: 0.0000004, cachedInputTokenRate: 0.000000025 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', category: 'text_generation', description: 'Multimodal GPT-4o', cost: fmtTokenCost(0.0000025, 0.00001, 0.00000125), inputTokenRate: 0.0000025, outputTokenRate: 0.00001, cachedInputTokenRate: 0.00000125 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', category: 'text_generation', description: 'Efficient small model', cost: fmtTokenCost(0.00000015, 0.0000006), inputTokenRate: 0.00000015, outputTokenRate: 0.0000006 },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'OpenAI', category: 'text_generation', description: 'Open-weight 120B model', cost: fmtTokenCost(0.000000037, 0.00000017), inputTokenRate: 0.000000037, outputTokenRate: 0.00000017 },
  { id: 'o4-mini', name: 'o4 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Compact reasoning model', cost: fmtTokenCost(0.0000011, 0.0000044), inputTokenRate: 0.0000011, outputTokenRate: 0.0000044 },
  { id: 'o3-pro', name: 'o3 Pro', provider: 'OpenAI', category: 'text_generation', description: 'Premium reasoning model', cost: fmtTokenCost(0.00002, 0.00008), inputTokenRate: 0.00002, outputTokenRate: 0.00008 },
  { id: 'o3', name: 'o3', provider: 'OpenAI', category: 'text_generation', description: 'Advanced reasoning model', cost: fmtTokenCost(0.000002, 0.000008, 0.0000005), inputTokenRate: 0.000002, outputTokenRate: 0.000008, cachedInputTokenRate: 0.0000005 },
  { id: 'o3-mini', name: 'o3 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Compact o3 reasoning', cost: fmtTokenCost(0.0000011, 0.0000044, 0.00000055), inputTokenRate: 0.0000011, outputTokenRate: 0.0000044, cachedInputTokenRate: 0.00000055 },

  // ── Anthropic Claude ──
  { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', provider: 'Anthropic', category: 'text_generation', description: 'Top-tier Claude (premium)', cost: fmtTokenCost(0.00001, 0.00005, 0.00000025), inputTokenRate: 0.00001, outputTokenRate: 0.00005, cachedInputTokenRate: 0.00000025 },
  { id: 'claude-fable-5', name: 'Claude Fable 5', provider: 'Anthropic', category: 'text_generation', description: 'Top-tier Claude (premium)', cost: fmtTokenCost(0.00001, 0.00005), inputTokenRate: 0.00001, outputTokenRate: 0.00005 },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', provider: 'Anthropic', category: 'text_generation', description: 'Latest premium Claude Opus', cost: fmtTokenCost(0.000004, 0.00002, 0.0000002), inputTokenRate: 0.000004, outputTokenRate: 0.00002, cachedInputTokenRate: 0.0000002 },
  { id: 'claude-opus-5', name: 'Claude Opus 5', provider: 'Anthropic', category: 'text_generation', description: 'Premium Claude Opus 5', cost: fmtTokenCost(0.000005, 0.000025), inputTokenRate: 0.000005, outputTokenRate: 0.000025 },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', provider: 'Anthropic', category: 'text_generation', description: 'Latest balanced Claude', cost: fmtTokenCost(0.000002, 0.00001, 0.0000002), inputTokenRate: 0.000002, outputTokenRate: 0.00001, cachedInputTokenRate: 0.0000002 },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'Anthropic', category: 'text_generation', description: 'Balanced Claude 5', cost: fmtTokenCost(0.000002, 0.00001), inputTokenRate: 0.000002, outputTokenRate: 0.00001 },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', provider: 'Anthropic', category: 'text_generation', description: 'Fast, low-cost Claude', cost: fmtTokenCost(0.0000001, 0.0000005, 0.00000001), inputTokenRate: 0.0000001, outputTokenRate: 0.0000005, cachedInputTokenRate: 0.00000001 },
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'Anthropic', category: 'text_generation', description: 'Premium Claude 4.8', cost: fmtTokenCost(0.000005, 0.000025), inputTokenRate: 0.000005, outputTokenRate: 0.000025 },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'Anthropic', category: 'text_generation', description: 'Premium Claude 4.7', cost: fmtTokenCost(0.000005, 0.000025), inputTokenRate: 0.000005, outputTokenRate: 0.000025 },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', category: 'text_generation', description: 'Premium Claude 4.6', cost: fmtTokenCost(0.000005, 0.000025), inputTokenRate: 0.000005, outputTokenRate: 0.000025 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', category: 'text_generation', description: 'Balanced Claude 4.6', cost: fmtTokenCost(0.000003, 0.000015), inputTokenRate: 0.000003, outputTokenRate: 0.000015 },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'Anthropic', category: 'text_generation', description: 'Premium Claude 4.5', cost: fmtTokenCost(0.000005, 0.000025), inputTokenRate: 0.000005, outputTokenRate: 0.000025 },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic', category: 'text_generation', description: 'Balanced Claude 4.5', cost: fmtTokenCost(0.000003, 0.000015), inputTokenRate: 0.000003, outputTokenRate: 0.000015 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', category: 'text_generation', description: 'Fast and affordable Claude 4.5', cost: fmtTokenCost(0.000001, 0.000005), inputTokenRate: 0.000001, outputTokenRate: 0.000005 },

  // ── Google Gemini ──
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'Google', category: 'text_generation', description: 'Latest Gemini Flash', cost: fmtTokenCost(0.00000075, 0.00000375, 0.000000075), inputTokenRate: 0.00000075, outputTokenRate: 0.00000375, cachedInputTokenRate: 0.000000075 },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', provider: 'Google', category: 'text_generation', description: 'Fast Gemini 3.7', cost: fmtTokenCost(0.00000075, 0.00000375, 0.000000075), inputTokenRate: 0.00000075, outputTokenRate: 0.00000375, cachedInputTokenRate: 0.000000075 },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'Google', category: 'text_generation', description: 'Fast Gemini 3.6', cost: fmtTokenCost(0.00000075, 0.00000375, 0.000000075), inputTokenRate: 0.00000075, outputTokenRate: 0.00000375, cachedInputTokenRate: 0.000000075 },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'Google', category: 'text_generation', description: 'Gemini 3.5 Flash', cost: fmtTokenCost(0.0000015, 0.000009, 0.00000015), inputTokenRate: 0.0000015, outputTokenRate: 0.000009, cachedInputTokenRate: 0.00000015 },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', provider: 'Google', category: 'text_generation', description: 'Lightweight Gemini 3.5', cost: fmtTokenCost(0.0000003, 0.0000025, 0.00000003), inputTokenRate: 0.0000003, outputTokenRate: 0.0000025, cachedInputTokenRate: 0.00000003 },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google', category: 'text_generation', description: 'Pro-tier Gemini', cost: fmtTokenCost(0.000002, 0.000012, 0.0000002), inputTokenRate: 0.000002, outputTokenRate: 0.000012, cachedInputTokenRate: 0.0000002 },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', provider: 'Google', category: 'text_generation', description: 'Ultra-lightweight Gemini', cost: fmtTokenCost(0.00000025, 0.0000015, 0.000000025), inputTokenRate: 0.00000025, outputTokenRate: 0.0000015, cachedInputTokenRate: 0.000000025 },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', category: 'text_generation', description: 'Fast, cost-efficient Gemini', cost: fmtTokenCost(0.0000005, 0.000003, 0.00000005), inputTokenRate: 0.0000005, outputTokenRate: 0.000003, cachedInputTokenRate: 0.00000005 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', category: 'text_generation', description: 'High-quality Gemini reasoning', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', category: 'text_generation', description: 'Fast Gemini 2.5', cost: fmtTokenCost(0.0000003, 0.0000025, 0.00000003), inputTokenRate: 0.0000003, outputTokenRate: 0.0000025, cachedInputTokenRate: 0.00000003 },
  { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B IT', provider: 'Google', category: 'text_generation', description: 'Open-weight Gemma 4', cost: fmtTokenCost(0.00000014, 0.0000004), inputTokenRate: 0.00000014, outputTokenRate: 0.0000004 },

  // ── Google Gemini (Image-capable text models) ──
  { id: 'gemini-nano-banana-2.1', name: 'Nano Banana 2.1', provider: 'Google', category: 'text_generation', description: 'Gemini with native image generation', cost: fmtTokenCost(0.0000015, 0.0000075), inputTokenRate: 0.0000015, outputTokenRate: 0.0000075 },
  { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2 (Gemini 3.1 Flash Image)', provider: 'Google', category: 'text_generation', description: 'Gemini 3.1 Flash with image generation', cost: fmtTokenCost(0.0000005, 0.000003, 0.00000005), inputTokenRate: 0.0000005, outputTokenRate: 0.000003, cachedInputTokenRate: 0.00000005 },
  { id: 'gemini-3-pro-image', name: 'Nano Banana (Gemini 3 Pro Image)', provider: 'Google', category: 'text_generation', description: 'Gemini 3 Pro with image generation', cost: fmtTokenCost(0.000002, 0.000012, 0.0000002), inputTokenRate: 0.000002, outputTokenRate: 0.000012, cachedInputTokenRate: 0.0000002 },
  { id: 'gemini-2.5-flash-image', name: 'Nano Banana (Gemini 2.5 Flash Image)', provider: 'Google', category: 'text_generation', description: 'Gemini 2.5 Flash with image generation', cost: fmtTokenCost(0.0000003, 0.00003), inputTokenRate: 0.0000003, outputTokenRate: 0.00003 },

  // ── xAI Grok ──
  { id: 'grok-4.7', name: 'Grok 4.7', provider: 'xAI', category: 'text_generation', description: 'Latest Grok model', cost: fmtTokenCost(0.000002, 0.000006, 0.0000005), inputTokenRate: 0.000002, outputTokenRate: 0.000006, cachedInputTokenRate: 0.0000005 },
  { id: 'grok-4.6', name: 'Grok 4.6', provider: 'xAI', category: 'text_generation', description: 'Grok 4.6', cost: fmtTokenCost(0.000002, 0.000006, 0.0000005), inputTokenRate: 0.000002, outputTokenRate: 0.000006, cachedInputTokenRate: 0.0000005 },
  { id: 'grok-4.5', name: 'Grok 4.5', provider: 'xAI', category: 'text_generation', description: 'Grok 4.5', cost: fmtTokenCost(0.000002, 0.000006, 0.0000003), inputTokenRate: 0.000002, outputTokenRate: 0.000006, cachedInputTokenRate: 0.0000003 },
  { id: 'grok-4.3', name: 'Grok 4.3', provider: 'xAI', category: 'text_generation', description: 'Lower-cost Grok', cost: fmtTokenCost(0.00000125, 0.0000025, 0.0000002), inputTokenRate: 0.00000125, outputTokenRate: 0.0000025, cachedInputTokenRate: 0.0000002 },

  // ── Meta Muse ──
  { id: 'muse-spark-1.3', name: 'Muse Spark 1.3', provider: 'Meta', category: 'text_generation', description: 'Latest Meta Muse model', cost: fmtTokenCost(0.00000125, 0.00000425, 0.00000015), inputTokenRate: 0.00000125, outputTokenRate: 0.00000425, cachedInputTokenRate: 0.00000015 },
  { id: 'muse-spark-1.3-contributor', name: 'Muse Spark 1.3 Contributor', provider: 'Meta', category: 'text_generation', description: 'Low-cost Muse variant', cost: fmtTokenCost(0.0000001, 0.0000002, 0.000000002), inputTokenRate: 0.0000001, outputTokenRate: 0.0000002, cachedInputTokenRate: 0.000000002 },
  { id: 'muse-spark-1.2', name: 'Muse Spark 1.2', provider: 'Meta', category: 'text_generation', description: 'Meta Muse 1.2', cost: fmtTokenCost(0.00000125, 0.00000425, 0.00000015), inputTokenRate: 0.00000125, outputTokenRate: 0.00000425, cachedInputTokenRate: 0.00000015 },
  { id: 'muse-spark-1.1', name: 'Muse Spark 1.1', provider: 'Meta', category: 'text_generation', description: 'Meta Muse 1.1', cost: fmtTokenCost(0.00000125, 0.00000425, 0.00000015), inputTokenRate: 0.00000125, outputTokenRate: 0.00000425, cachedInputTokenRate: 0.00000015 },

  // ── DeepSeek ──
  { id: 'deepseek-ai/DeepSeek-V4-Pro-0813', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', category: 'text_generation', description: 'Latest DeepSeek Pro', cost: fmtTokenCost(0.00000132, 0.00000396, 0.000000044), inputTokenRate: 0.00000132, outputTokenRate: 0.00000396, cachedInputTokenRate: 0.000000044 },
  { id: 'deepseek-ai/DeepSeek-V4.1-Flash', name: 'DeepSeek V4.1 Flash', provider: 'DeepSeek', category: 'text_generation', description: 'Fast, very low-cost DeepSeek', cost: fmtTokenCost(0.00000022, 0.00000066, 0.000000007), inputTokenRate: 0.00000022, outputTokenRate: 0.00000066, cachedInputTokenRate: 0.000000007 },
  { id: 'deepseek-ai/DeepSeek-V4-Flash-0731', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', category: 'text_generation', description: 'Fast DeepSeek V4', cost: fmtTokenCost(0.00000044, 0.00000132, 0.000000028), inputTokenRate: 0.00000044, outputTokenRate: 0.00000132, cachedInputTokenRate: 0.000000028 },
  { id: 'deepseek-ai/DeepSeek-V4-Flash-Vision-Exp', name: 'DeepSeek V4 Flash Vision (Exp)', provider: 'DeepSeek', category: 'text_generation', description: 'Experimental vision-capable DeepSeek', cost: fmtTokenCost(0.00000044, 0.00000132, 0.000000028), inputTokenRate: 0.00000044, outputTokenRate: 0.00000132, cachedInputTokenRate: 0.000000028 },

  // ── Qwen (Alibaba) ──
  { id: 'qwen3.8-max', name: 'Qwen3.8 Max', provider: 'Qwen', category: 'text_generation', description: 'Latest flagship Qwen', cost: fmtTokenCost(0.000002, 0.000006, 0.00000025), inputTokenRate: 0.000002, outputTokenRate: 0.000006, cachedInputTokenRate: 0.00000025 },
  { id: 'Qwen/Qwen3.8-Flash-Next', name: 'Qwen3.8 Flash Next', provider: 'Qwen', category: 'text_generation', description: 'Fast, low-cost Qwen', cost: fmtTokenCost(0.00000015, 0.00000047, 0.000000016), inputTokenRate: 0.00000015, outputTokenRate: 0.00000047, cachedInputTokenRate: 0.000000016 },
  { id: 'Qwen/Qwen3.8-27B', name: 'Qwen3.8 27B', provider: 'Qwen', category: 'text_generation', description: 'Mid-size Qwen3.8', cost: fmtTokenCost(0.00000045, 0.0000032), inputTokenRate: 0.00000045, outputTokenRate: 0.0000032 },
  { id: 'qwen3.7-max', name: 'Qwen3.7 Max', provider: 'Qwen', category: 'text_generation', description: 'Qwen3.7 flagship', cost: fmtTokenCost(0.0000025, 0.0000075), inputTokenRate: 0.0000025, outputTokenRate: 0.0000075 },
  { id: 'Qwen/Qwen3.6-27B', name: 'Qwen3.6 27B', provider: 'Qwen', category: 'text_generation', description: 'Mid-size Qwen3.6', cost: fmtTokenCost(0.00000032, 0.0000032), inputTokenRate: 0.00000032, outputTokenRate: 0.0000032 },
  { id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', name: 'Qwen3 Coder', provider: 'Qwen', category: 'text_generation', description: 'Code-specialized Qwen3', cost: fmtTokenCost(0.00000038, 0.00000155), inputTokenRate: 0.00000038, outputTokenRate: 0.00000155 },
  { id: 'Qwen/Qwen3-32B', name: 'Qwen3 32B', provider: 'Qwen', category: 'text_generation', description: 'Mid-size Qwen3', cost: fmtTokenCost(0.00000008, 0.00000028), inputTokenRate: 0.00000008, outputTokenRate: 0.00000028 },

  // ── Kimi (Moonshot AI) ──
  { id: 'moonshotai/Kimi-K3', name: 'Kimi K3', provider: 'Moonshot AI', category: 'text_generation', description: 'Latest Kimi model', cost: fmtTokenCost(0.000003, 0.000015, 0.0000003), inputTokenRate: 0.000003, outputTokenRate: 0.000015, cachedInputTokenRate: 0.0000003 },
  { id: 'moonshotai/Kimi-K2.7-Code', name: 'Kimi K2.7 Code', provider: 'Moonshot AI', category: 'text_generation', description: 'Code-specialized Kimi', cost: fmtTokenCost(0.00000095, 0.000004, 0.00000019), inputTokenRate: 0.00000095, outputTokenRate: 0.000004, cachedInputTokenRate: 0.00000019 },
  { id: 'moonshotai/Kimi-K2.6', name: 'Kimi K2.6', provider: 'Moonshot AI', category: 'text_generation', description: 'Kimi K2.6', cost: fmtTokenCost(0.00000095, 0.000004, 0.00000016), inputTokenRate: 0.00000095, outputTokenRate: 0.000004, cachedInputTokenRate: 0.00000016 },
  { id: 'moonshotai/Kimi-K2-Instruct', name: 'Kimi K2 Turbo', provider: 'Moonshot AI', category: 'text_generation', description: 'Fast Kimi model', cost: fmtTokenCost(0.00000057, 0.0000023), inputTokenRate: 0.00000057, outputTokenRate: 0.0000023 },

  // ── ZhipuAI GLM ──
  { id: 'zai-org/GLM-5.3', name: 'GLM 5.3', provider: 'ZhipuAI', category: 'text_generation', description: 'Latest GLM model', cost: fmtTokenCost(0.0000014, 0.0000044, 0.00000026), inputTokenRate: 0.0000014, outputTokenRate: 0.0000044, cachedInputTokenRate: 0.00000026 },
  { id: 'zai-org/GLM-5.3-Flash', name: 'GLM 5.3 Flash', provider: 'ZhipuAI', category: 'text_generation', description: 'Fast, low-cost GLM', cost: fmtTokenCost(0.00000015, 0.0000005, 0.00000003), inputTokenRate: 0.00000015, outputTokenRate: 0.0000005, cachedInputTokenRate: 0.00000003 },
  { id: 'zai-org/GLM-5.2', name: 'GLM 5.2', provider: 'ZhipuAI', category: 'text_generation', description: 'GLM 5.2', cost: fmtTokenCost(0.0000014, 0.0000044, 0.00000026), inputTokenRate: 0.0000014, outputTokenRate: 0.0000044, cachedInputTokenRate: 0.00000026 },
  { id: 'zai-org/GLM-5.1', name: 'GLM 5.1', provider: 'ZhipuAI', category: 'text_generation', description: 'GLM 5.1', cost: fmtTokenCost(0.00000138, 0.0000044, 0.00000026), inputTokenRate: 0.00000138, outputTokenRate: 0.0000044, cachedInputTokenRate: 0.00000026 },
  { id: 'zai-org/GLM-5', name: 'GLM 5', provider: 'ZhipuAI', category: 'text_generation', description: 'GLM 5', cost: fmtTokenCost(0.000001, 0.0000032), inputTokenRate: 0.000001, outputTokenRate: 0.0000032 },
  { id: 'zai-org/GLM-4.7', name: 'GLM 4.7', provider: 'ZhipuAI', category: 'text_generation', description: 'GLM 4.7', cost: fmtTokenCost(0.0000006, 0.0000022), inputTokenRate: 0.0000006, outputTokenRate: 0.0000022 },
  { id: 'zai-org/GLM-4.6', name: 'GLM 4.6', provider: 'ZhipuAI', category: 'text_generation', description: 'GLM 4.6', cost: fmtTokenCost(0.00000055, 0.0000022), inputTokenRate: 0.00000055, outputTokenRate: 0.0000022 },

  // ── MiniMax ──
  { id: 'MiniMaxAI/MiniMax-M3', name: 'MiniMax M3', provider: 'MiniMax', category: 'text_generation', description: 'Latest MiniMax model', cost: fmtTokenCost(0.0000003, 0.0000012), inputTokenRate: 0.0000003, outputTokenRate: 0.0000012 },
  { id: 'MiniMaxAI/MiniMax-M2.7', name: 'MiniMax M2.7', provider: 'MiniMax', category: 'text_generation', description: 'MiniMax M2.7', cost: fmtTokenCost(0.0000003, 0.0000012), inputTokenRate: 0.0000003, outputTokenRate: 0.0000012 },

  // ── Xiaomi MiMo ──
  { id: 'mimo-v2.6-pro', name: 'MiMo V2.6 Pro', provider: 'Xiaomi', category: 'text_generation', description: 'Low-cost Xiaomi model', cost: fmtTokenCost(0.000000435, 0.00000087, 0.0000000036), inputTokenRate: 0.000000435, outputTokenRate: 0.00000087, cachedInputTokenRate: 0.0000000036 },
  { id: 'mimo-v2-pro', name: 'MiMo V2 Pro', provider: 'Xiaomi', category: 'text_generation', description: 'Xiaomi MiMo V2', cost: fmtTokenCost(0.000001, 0.000003, 0.0000002), inputTokenRate: 0.000001, outputTokenRate: 0.000003, cachedInputTokenRate: 0.0000002 },

  // ── Thinking Machines ──
  { id: 'thinkingmachines/Inkling', name: 'Tinker Inkling', provider: 'Thinking Machines', category: 'text_generation', description: 'Thinking Machines model', cost: fmtTokenCost(0.00000374, 0.00000936, 0.000000748), inputTokenRate: 0.00000374, outputTokenRate: 0.00000936, cachedInputTokenRate: 0.000000748 },
];

// ────────────────────────────────────────────────────────────
// IMAGE GENERATION MODELS
// ────────────────────────────────────────────────────────────

export const IMAGE_GENERATION_MODELS: AbacusModel[] = [
  // ── GPT Image ──
  { id: 'gpt_image15', name: 'GPT Image 1.5', provider: 'OpenAI', category: 'image_generation', description: 'OpenAI image generation model', cost: 'Token-based pricing', supportsRefImage: true },
  { id: 'gpt_image_edit', name: 'GPT Image [Edit]', provider: 'OpenAI', category: 'image_generation', description: 'OpenAI image editing model', cost: 'Token-based pricing', supportsRefImage: true },

  // ── FLUX (Black Forest Labs) ──
  { id: 'flux2', name: 'FLUX.2', provider: 'Black Forest Labs', category: 'image_generation', description: 'Next-gen Flux model', cost: '~$0.0096/image', rate: 0.0096 },
  { id: 'flux2_pro', name: 'FLUX.2 [Pro]', provider: 'Black Forest Labs', category: 'image_generation', description: 'Pro-tier Flux 2 generation', cost: '~$0.03/image', rate: 0.03 },
  { id: 'flux_pro', name: 'FLUX 1.1 [Pro]', provider: 'Black Forest Labs', category: 'image_generation', description: 'High-fidelity image generation', cost: '~$0.04/image', rate: 0.04 },
  { id: 'flux_pro_ultra', name: 'FLUX 1.1 [Pro] Ultra', provider: 'Black Forest Labs', category: 'image_generation', description: 'Premium quality Flux generation', cost: '~$0.06/image', rate: 0.06 },
  { id: 'flux_kontext', name: 'FLUX.1 Kontext', provider: 'Black Forest Labs', category: 'image_generation', description: 'Context-aware Flux generation', cost: '~$0.04–$0.08/image', supportsRefImage: true },
  { id: 'flux_kontext_edit', name: 'FLUX.1 Kontext [Edit]', provider: 'Black Forest Labs', category: 'image_generation', description: 'Context-aware Flux editing', cost: '~$0.04–$0.08/image', supportsRefImage: true },
  { id: 'flux_pro_canny', name: 'FLUX 1.1 [Pro] Canny [Edit]', provider: 'Black Forest Labs', category: 'image_generation', description: 'Edge-guided Flux editing', cost: '~$0.05/image', rate: 0.05, supportsRefImage: true },
  { id: 'flux_pro_depth', name: 'FLUX 1.1 [Pro] Depth [Edit]', provider: 'Black Forest Labs', category: 'image_generation', description: 'Depth-guided Flux editing', cost: '~$0.05/image', rate: 0.05, supportsRefImage: true },

  // ── Google ──
  { id: 'imagen', name: 'Imagen 4', provider: 'Google', category: 'image_generation', description: 'Google Imagen via Abacus', cost: '~$0.05/image', rate: 0.05, supportsRefImage: true },
  { id: 'seedream', name: 'Seedream 4.5', provider: 'Google', category: 'image_generation', description: 'Creative and artistic generation', cost: '~$0.04/image', rate: 0.04 },

  // ── Ideogram ──
  { id: 'ideogram', name: 'Ideogram 3.0', provider: 'Ideogram', category: 'image_generation', description: 'Excellent text rendering in images', cost: '~$0.06/image', rate: 0.06 },
  { id: 'ideogram_character', name: 'Ideogram Character', provider: 'Ideogram', category: 'image_generation', description: 'Character-focused generation', cost: '~$0.10–$0.20/image', supportsRefImage: true },

  // ── Recraft ──
  { id: 'recraft', name: 'Recraft', provider: 'Recraft', category: 'image_generation', description: 'Design-oriented image generation', cost: '~$0.04/image', rate: 0.04 },
  { id: 'recraft_svg', name: 'Recraft SVG', provider: 'Recraft', category: 'image_generation', description: 'SVG vector image generation', cost: '~$0.08/image', rate: 0.08 },

  // ── OpenAI ──
  { id: 'dalle', name: 'DALL-E', provider: 'OpenAI', category: 'image_generation', description: 'OpenAI DALL-E image generation', cost: '~$0.04–$0.12/image (varies by quality/res)' },

  // ── Midjourney ──
  { id: 'midjourney', name: 'Midjourney', provider: 'Midjourney', category: 'image_generation', description: 'Artistic image generation', cost: '~$0.04–$0.14/image (varies by speed)', supportsRefImage: true },

  // ── Nano Banana (Google Gemini-based) ──
  { id: 'nano_banana', name: 'Nano Banana', provider: 'Google', category: 'image_generation', description: 'Fast multimodal image generation', cost: '~$0.039/image', rate: 0.039, supportsRefImage: true },
  { id: 'nano_banana_pro', name: 'Nano Banana Pro', provider: 'Google', category: 'image_generation', description: 'Enhanced multimodal generation', cost: '~$0.15/image', rate: 0.15, supportsRefImage: true },
  { id: 'nano_banana2', name: 'Nano Banana 2', provider: 'Google', category: 'image_generation', description: 'Latest Nano Banana with text rendering', cost: '~$0.06/image', rate: 0.06, supportsRefImage: true },

  // ── Qwen ──
  { id: 'qwen_image_edit', name: 'Qwen Image Edit', provider: 'Qwen', category: 'image_generation', description: 'Qwen image editing model', cost: '~$0.03/megapixel', rate: 0.03, supportsRefImage: true },

  // ── Hunyuan ──
  { id: 'hunyuan_image', name: 'Hunyuan Image 3.0', provider: 'Tencent', category: 'image_generation', description: 'Hunyuan image generation', cost: '~$0.10/image', rate: 0.10 },

  // ── ImagineArt ──
  { id: 'imagine_art', name: 'ImagineArt 1.5', provider: 'ImagineArt', category: 'image_generation', description: 'Artistic image generation', cost: '~$0.03/image', rate: 0.03 },

  // ── Dreamina ──
  { id: 'dreamina', name: 'Dreamina', provider: 'ByteDance', category: 'image_generation', description: 'ByteDance image generation', cost: '~$0.03/image', rate: 0.03 },

  // ── xAI ──
  { id: 'grok_imagine_image', name: 'Grok Imagine Image', provider: 'xAI', category: 'image_generation', description: 'Grok image generation', cost: '~$0.02/image', rate: 0.02 },

  // ── Wan ──
  { id: 'wan27', name: 'Wan 2.7', provider: 'Alibaba', category: 'image_generation', description: 'Wan image generation', cost: '~$0.03/image', rate: 0.03 },

  // ── Magnific ──
  { id: 'magnific', name: 'Magnific Upscaler', provider: 'Magnific', category: 'image_generation', description: 'AI image upscaling', cost: '~$0.11–$1.32 (varies by resolution)', supportsRefImage: true },
];

// ────────────────────────────────────────────────────────────
// VIDEO GENERATION MODELS
// ────────────────────────────────────────────────────────────

export const VIDEO_GENERATION_MODELS: AbacusModel[] = [
  // ── Google ──
  { id: 'veo31', name: 'Veo 3.1', provider: 'Google', category: 'video_generation', description: 'Latest Google video generation', cost: '~$1.20–$3.20/video', supportsStartFrame: true, supportsEndFrame: true },
  { id: 'veo31_lite', name: 'Veo 3.1 Lite', provider: 'Google', category: 'video_generation', description: 'Lightweight Veo 3.1', cost: '~$0.07/video', rate: 0.07, supportsStartFrame: true },
  { id: 'veo3', name: 'Veo 3', provider: 'Google', category: 'video_generation', description: 'Veo 3 with audio support', cost: '~$2.00–$6.00/video', supportsStartFrame: true, supportsEndFrame: true },
  { id: 'veo', name: 'Veo 2', provider: 'Google', category: 'video_generation', description: 'Google Veo 2 video generation', cost: '~$2.50–$4.00/video', supportsStartFrame: true },
  { id: 'seedance15_pro', name: 'Seedance 1.5 Pro', provider: 'Google', category: 'video_generation', description: 'Pro video generation', cost: '~$0.26/video', rate: 0.26, supportsStartFrame: true, supportsEndFrame: true },
  { id: 'seedance_pro', name: 'Seedance Pro', provider: 'Google', category: 'video_generation', description: 'Professional Seedance video', cost: '~$0.74/video', rate: 0.74, supportsStartFrame: true, supportsEndFrame: true },
  { id: 'seedance', name: 'Seedance', provider: 'Google', category: 'video_generation', description: 'Google video generation', cost: '~$0.18/video', rate: 0.18, supportsStartFrame: true },

  // ── OpenAI ──
  { id: 'sora', name: 'Sora 2', provider: 'OpenAI', category: 'video_generation', description: 'OpenAI video generation', cost: '~$0.10–$0.30/video', supportsStartFrame: true },

  // ── Runway ──
  { id: 'runway', name: 'Runway', provider: 'Runway', category: 'video_generation', description: 'Runway video generation', cost: '~$0.25–$0.50/video', supportsStartFrame: true, supportsEndFrame: true },

  // ── Luma Labs ──
  { id: 'luma_labs', name: 'Luma Labs', provider: 'Luma Labs', category: 'video_generation', description: 'Luma Labs video generation', cost: '~$0.40/video', rate: 0.40, supportsStartFrame: true },

  // ── Kling AI ──
  { id: 'kling_ai_o3', name: 'Kling AI O3', provider: 'Kuaishou', category: 'video_generation', description: 'Latest Kling reasoning video', cost: '~$0.17–$0.28/video', supportsStartFrame: true, supportsEndFrame: true },
  { id: 'kling_ai_o1', name: 'Kling AI O1', provider: 'Kuaishou', category: 'video_generation', description: 'Kling reasoning video', cost: '~$0.42–$1.12/video', supportsStartFrame: true, supportsEndFrame: true },
  { id: 'kling_ai_v3', name: 'Kling AI v3', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v3 video generation', cost: '~$0.17–$0.34/video', supportsStartFrame: true, supportsEndFrame: true },
  { id: 'kling_ai_v26', name: 'Kling AI v2.6', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v2.6 video', cost: '~$0.07–$0.14/video', rate: 0.07, supportsStartFrame: true, supportsEndFrame: true },
  { id: 'kling_ai_v26_motion', name: 'Kling v2.6 Motion Control', provider: 'Kuaishou', category: 'video_generation', description: 'Motion-controlled video generation', cost: '~$0.112/video', rate: 0.112, supportsStartFrame: true },
  { id: 'kling_ai_v25', name: 'Kling AI v2.5', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v2.5 video', cost: '~$0.21–$0.70/video', supportsStartFrame: true, supportsEndFrame: true },
  { id: 'kling_ai_v21', name: 'Kling AI v2.1', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v2.1 video', cost: '~$1.40–$2.80/video', supportsStartFrame: true, supportsEndFrame: true },
  { id: 'kling_ai_v2', name: 'Kling AI v2', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v2 video', cost: '~$1.40–$2.80/video', supportsStartFrame: true, supportsEndFrame: true },
  { id: 'kling_ai', name: 'Kling AI v1.6', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v1.6 video', cost: '~$0.23–$0.95/video', supportsStartFrame: true, supportsEndFrame: true },

  // ── Hailuo / MiniMax ──
  { id: 'minimax', name: 'Hailuo 2', provider: 'MiniMax', category: 'video_generation', description: 'MiniMax Hailuo video generation', cost: '~$0.27–$0.80/video', supportsStartFrame: true, supportsEndFrame: true },

  // ── Hunyuan ──
  { id: 'hunyuan', name: 'Hunyuan Video', provider: 'Tencent', category: 'video_generation', description: 'Tencent video generation', cost: '~$0.40/video', rate: 0.40, supportsStartFrame: true },

  // ── Wan ──
  { id: 'wan25', name: 'Wan 2.5', provider: 'Alibaba', category: 'video_generation', description: 'Alibaba Wan 2.5 video', cost: '~$0.05–$0.15/video', supportsStartFrame: true },
  { id: 'wan', name: 'Wan 2.2', provider: 'Alibaba', category: 'video_generation', description: 'Alibaba Wan 2.2 video', cost: '~$0.0125–$0.08/video', rate: 0.08, supportsStartFrame: true },

  // ── xAI ──
  { id: 'grok_imagine_video', name: 'Grok Imagine Video', provider: 'xAI', category: 'video_generation', description: 'Grok video generation', cost: '~$0.05/video', rate: 0.05, supportsStartFrame: true },

  // ── Topaz ──
  { id: 'topaz', name: 'Topaz Upscaler', provider: 'Topaz', category: 'video_generation', description: 'AI video upscaling', cost: '~$0.10/video', rate: 0.10 },
];

// ────────────────────────────────────────────────────────────
// AUDIO GENERATION MODELS
// ────────────────────────────────────────────────────────────

export const AUDIO_GENERATION_MODELS: AbacusModel[] = [
  { id: 'gpt-4o-audio-preview-2025-06-03', name: 'GPT-4o Audio Preview', provider: 'OpenAI', category: 'audio_generation', description: 'Audio input + output in one call', cost: fmtTokenCost(0.0000025, 0.00001), inputTokenRate: 0.0000025, outputTokenRate: 0.00001, inputModalities: ['text', 'image', 'audio'], outputModalities: ['text', 'audio'] },
  { id: 'gpt-4o-mini-audio-preview-2024-12-17', name: 'GPT-4o Mini Audio Preview', provider: 'OpenAI', category: 'audio_generation', description: 'Cost-efficient audio model', cost: fmtTokenCost(0.00000015, 0.0000006), inputTokenRate: 0.00000015, outputTokenRate: 0.0000006, inputModalities: ['text', 'image', 'audio'], outputModalities: ['text', 'audio'] },
  { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash TTS', provider: 'Google', category: 'audio_generation', description: 'Text-to-speech via Gemini Flash', cost: fmtTokenCost(0.0000005, 0.000002), inputTokenRate: 0.0000005, outputTokenRate: 0.000002, inputModalities: ['text'], outputModalities: ['audio'] },
  { id: 'gemini-2.5-pro-preview-tts', name: 'Gemini 2.5 Pro TTS', provider: 'Google', category: 'audio_generation', description: 'Text-to-speech via Gemini Pro', cost: fmtTokenCost(0.000001, 0.000005), inputTokenRate: 0.000001, outputTokenRate: 0.000005, inputModalities: ['text'], outputModalities: ['audio'] },
];

// ────────────────────────────────────────────────────────────
// COMBINED / HELPER EXPORTS
// ────────────────────────────────────────────────────────────

/** All models across all categories */
export const ALL_ABACUS_MODELS: AbacusModel[] = [
  ...TEXT_GENERATION_MODELS,
  ...IMAGE_GENERATION_MODELS,
  ...VIDEO_GENERATION_MODELS,
  ...AUDIO_GENERATION_MODELS,
];

/** Get all models for a specific category */
export function getModelsByCategory(category: ModelCategory): AbacusModel[] {
  return ALL_ABACUS_MODELS.filter(m => m.category === category);
}

/** Get all models for a specific provider */
export function getModelsByProvider(provider: string): AbacusModel[] {
  return ALL_ABACUS_MODELS.filter(m => m.provider.toLowerCase() === provider.toLowerCase());
}

/** Look up a model by its ID */
export function getModelById(id: string): AbacusModel | undefined {
  return ALL_ABACUS_MODELS.find(m => m.id === id);
}

/** Get display name for a model ID, returns the ID itself if not found */
export function getModelDisplayName(id: string): string {
  const model = getModelById(id);
  return model ? model.name : id;
}

/** Get unique provider names across all models */
export function getAllProviders(): string[] {
  return [...new Set(ALL_ABACUS_MODELS.map(m => m.provider))].sort();
}

/** Get unique provider names for a specific category */
export function getProvidersByCategory(category: ModelCategory): string[] {
  return [...new Set(
    ALL_ABACUS_MODELS
      .filter(m => m.category === category)
      .map(m => m.provider)
  )].sort();
}

// ── Convenience: Arrays of just the IDs (for quick validation) ──

export const TEXT_MODEL_IDS = TEXT_GENERATION_MODELS.map(m => m.id);
export const IMAGE_MODEL_IDS = IMAGE_GENERATION_MODELS.map(m => m.id);
export const VIDEO_MODEL_IDS = VIDEO_GENERATION_MODELS.map(m => m.id);
export const AUDIO_MODEL_IDS = AUDIO_GENERATION_MODELS.map(m => m.id);

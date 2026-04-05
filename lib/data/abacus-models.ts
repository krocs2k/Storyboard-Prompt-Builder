/**
 * Abacus AI RouteLLM API - Complete Model Registry
 * 
 * All models available through the Abacus AI /v1/chat/completions and /v1/models endpoints.
 * Organized by category with both Model IDs (for API calls) and Display Names (for UI).
 * Pricing sourced from the /v1/models API endpoint.
 * 
 * Source: https://abacus.ai/help/developer-platform/route-llm/
 * Last synced: April 2026
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
  // ── RouteLLM (Smart Router) ──
  { id: 'route-llm', name: 'RouteLLM', provider: 'Abacus AI', category: 'text_generation', description: 'Smart router — auto-selects the best model', cost: fmtTokenCost(0.000003, 0.000015), inputTokenRate: 0.000003, outputTokenRate: 0.000015 },

  // ── OpenAI GPT ──
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', category: 'text_generation', description: 'Latest flagship GPT model', cost: fmtTokenCost(0.0000025, 0.000015, 0.00000025), inputTokenRate: 0.0000025, outputTokenRate: 0.000015, cachedInputTokenRate: 0.00000025 },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Compact GPT-5.4 variant', cost: fmtTokenCost(0.00000075, 0.0000045, 0.000000075), inputTokenRate: 0.00000075, outputTokenRate: 0.0000045, cachedInputTokenRate: 0.000000075 },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', provider: 'OpenAI', category: 'text_generation', description: 'Ultra-lightweight GPT-5.4', cost: fmtTokenCost(0.0000002, 0.00000125, 0.00000002), inputTokenRate: 0.0000002, outputTokenRate: 0.00000125, cachedInputTokenRate: 0.00000002 },
  { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', provider: 'OpenAI', category: 'text_generation', description: 'Code-specialized GPT-5.3', cost: fmtTokenCost(0.00000175, 0.000014, 0.00000018), inputTokenRate: 0.00000175, outputTokenRate: 0.000014, cachedInputTokenRate: 0.00000018 },
  { id: 'gpt-5.3-codex-xhigh', name: 'GPT-5.3 Codex XHigh', provider: 'OpenAI', category: 'text_generation', description: 'Extended-compute code generation', cost: fmtTokenCost(0.00000175, 0.000014, 0.00000018), inputTokenRate: 0.00000175, outputTokenRate: 0.000014, cachedInputTokenRate: 0.00000018 },
  { id: 'gpt-5.3-chat-latest', name: 'GPT-5.3 Instant', provider: 'OpenAI', category: 'text_generation', description: 'Fast GPT-5.3 chat model', cost: fmtTokenCost(0.00000175, 0.000014, 0.000000175), inputTokenRate: 0.00000175, outputTokenRate: 0.000014, cachedInputTokenRate: 0.000000175 },
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', category: 'text_generation', description: 'High-quality reasoning and generation', cost: fmtTokenCost(0.00000175, 0.000014, 0.000000175), inputTokenRate: 0.00000175, outputTokenRate: 0.000014, cachedInputTokenRate: 0.000000175 },
  { id: 'gpt-5.2-chat-latest', name: 'GPT-5.2 Instant', provider: 'OpenAI', category: 'text_generation', description: 'Fast GPT-5.2 chat model', cost: fmtTokenCost(0.00000175, 0.000014, 0.000000175), inputTokenRate: 0.00000175, outputTokenRate: 0.000014, cachedInputTokenRate: 0.000000175 },
  { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', provider: 'OpenAI', category: 'text_generation', description: 'Code-specialized GPT-5.2', cost: fmtTokenCost(0.00000175, 0.000014, 0.000000175), inputTokenRate: 0.00000175, outputTokenRate: 0.000014, cachedInputTokenRate: 0.000000175 },
  { id: 'gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI', category: 'text_generation', description: 'Versatile flagship model', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', provider: 'OpenAI', category: 'text_generation', description: 'Code-specialized GPT-5.1', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', provider: 'OpenAI', category: 'text_generation', description: 'Max-compute GPT-5.1 code generation', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gpt-5.1-chat-latest', name: 'GPT-5.1 Instant', provider: 'OpenAI', category: 'text_generation', description: 'Fast GPT-5.1 chat model', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', category: 'text_generation', description: 'Advanced reasoning and code generation', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Lightweight GPT-5 variant', cost: fmtTokenCost(0.00000025, 0.000002, 0.000000025), inputTokenRate: 0.00000025, outputTokenRate: 0.000002, cachedInputTokenRate: 0.000000025 },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI', category: 'text_generation', description: 'Fastest and cheapest GPT-5', cost: fmtTokenCost(0.00000005, 0.0000004, 0.000000005), inputTokenRate: 0.00000005, outputTokenRate: 0.0000004, cachedInputTokenRate: 0.000000005 },
  { id: 'gpt-5-codex', name: 'GPT-5 Codex', provider: 'OpenAI', category: 'text_generation', description: 'Code-specialized GPT-5', cost: fmtTokenCost(0.00000125, 0.00001, 0.000000125), inputTokenRate: 0.00000125, outputTokenRate: 0.00001, cachedInputTokenRate: 0.000000125 },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', category: 'text_generation', description: 'Fast and reliable for coding tasks', cost: fmtTokenCost(0.000002, 0.000008, 0.0000005), inputTokenRate: 0.000002, outputTokenRate: 0.000008, cachedInputTokenRate: 0.0000005 },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Smaller, faster GPT-4.1', cost: fmtTokenCost(0.0000004, 0.0000016, 0.0000001), inputTokenRate: 0.0000004, outputTokenRate: 0.0000016, cachedInputTokenRate: 0.0000001 },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI', category: 'text_generation', description: 'Cheapest GPT-4.1 variant', cost: fmtTokenCost(0.0000001, 0.0000004, 0.000000025), inputTokenRate: 0.0000001, outputTokenRate: 0.0000004, cachedInputTokenRate: 0.000000025 },
  { id: 'gpt-4o-2024-11-20', name: 'GPT-4o', provider: 'OpenAI', category: 'text_generation', description: 'Advanced multimodal AI model', cost: fmtTokenCost(0.0000025, 0.00001, 0.00000125), inputTokenRate: 0.0000025, outputTokenRate: 0.00001, cachedInputTokenRate: 0.00000125 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', category: 'text_generation', description: 'Efficient small model', cost: fmtTokenCost(0.00000015, 0.0000006), inputTokenRate: 0.00000015, outputTokenRate: 0.0000006 },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'OpenAI', category: 'text_generation', description: 'Open-source 120B parameter model', cost: fmtTokenCost(0.00000008, 0.00000044), inputTokenRate: 0.00000008, outputTokenRate: 0.00000044 },

  // ── OpenAI Reasoning (o-series) ──
  { id: 'o4-mini', name: 'o4 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Compact reasoning model', cost: fmtTokenCost(0.0000011, 0.0000044), inputTokenRate: 0.0000011, outputTokenRate: 0.0000044 },
  { id: 'o3-pro', name: 'o3 Pro', provider: 'OpenAI', category: 'text_generation', description: 'Premium reasoning model', cost: fmtTokenCost(0.00002, 0.00004), inputTokenRate: 0.00002, outputTokenRate: 0.00004 },
  { id: 'o3', name: 'o3', provider: 'OpenAI', category: 'text_generation', description: 'Advanced reasoning model', cost: fmtTokenCost(0.000002, 0.000008, 0.0000005), inputTokenRate: 0.000002, outputTokenRate: 0.000008, cachedInputTokenRate: 0.0000005 },
  { id: 'o3-mini', name: 'o3 Mini', provider: 'OpenAI', category: 'text_generation', description: 'Compact o3 reasoning', cost: fmtTokenCost(0.0000011, 0.0000044, 0.00000055), inputTokenRate: 0.0000011, outputTokenRate: 0.0000044, cachedInputTokenRate: 0.00000055 },

  // ── Anthropic Claude ──
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', category: 'text_generation', description: 'Latest premium Claude model', cost: fmtTokenCost(0.000005, 0.000025), inputTokenRate: 0.000005, outputTokenRate: 0.000025 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', category: 'text_generation', description: 'Latest balanced Claude model', cost: fmtTokenCost(0.000003, 0.000015), inputTokenRate: 0.000003, outputTokenRate: 0.000015 },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'Anthropic', category: 'text_generation', description: 'Premium Claude 4.5 model', cost: fmtTokenCost(0.000005, 0.000025), inputTokenRate: 0.000005, outputTokenRate: 0.000025 },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic', category: 'text_generation', description: 'Balanced Claude 4.5 model', cost: fmtTokenCost(0.000003, 0.000015), inputTokenRate: 0.000003, outputTokenRate: 0.000015 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', category: 'text_generation', description: 'Fast and affordable Claude 4.5', cost: fmtTokenCost(0.000001, 0.000005), inputTokenRate: 0.000001, outputTokenRate: 0.000005 },
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', provider: 'Anthropic', category: 'text_generation', description: 'Premium Claude 4.1 model', cost: fmtTokenCost(0.000015, 0.000075), inputTokenRate: 0.000015, outputTokenRate: 0.000075 },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'Anthropic', category: 'text_generation', description: 'Premium Claude 4 model', cost: fmtTokenCost(0.000015, 0.000075), inputTokenRate: 0.000015, outputTokenRate: 0.000075 },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', category: 'text_generation', description: 'Balanced Claude 4 model', cost: fmtTokenCost(0.000003, 0.000015), inputTokenRate: 0.000003, outputTokenRate: 0.000015 },
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7', provider: 'Anthropic', category: 'text_generation', description: 'Previous gen Claude Sonnet', cost: fmtTokenCost(0.000003, 0.000015), inputTokenRate: 0.000003, outputTokenRate: 0.000015 },

  // ── Google Gemini ──
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google', category: 'text_generation', description: 'Latest pro-tier Gemini model', cost: fmtTokenCost(0.000002, 0.000012), inputTokenRate: 0.000002, outputTokenRate: 0.000012 },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', provider: 'Google', category: 'text_generation', description: 'Ultra-lightweight Gemini', cost: fmtTokenCost(0.00000025, 0.0000015), inputTokenRate: 0.00000025, outputTokenRate: 0.0000015 },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', category: 'text_generation', description: 'Fast, cost-efficient Gemini', cost: fmtTokenCost(0.0000005, 0.000003), inputTokenRate: 0.0000005, outputTokenRate: 0.000003 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', category: 'text_generation', description: 'High-quality Gemini reasoning', cost: fmtTokenCost(0.00000125, 0.00001), inputTokenRate: 0.00000125, outputTokenRate: 0.00001 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', category: 'text_generation', description: 'Fast Gemini 2.5 variant', cost: fmtTokenCost(0.0000003, 0.0000025), inputTokenRate: 0.0000003, outputTokenRate: 0.0000025 },

  // ── Google Gemini (Image-capable text models) ──
  { id: 'gemini-2.5-flash-image', name: 'Nano Banana (Gemini 2.5 Flash Image)', provider: 'Google', category: 'text_generation', description: 'Gemini 2.5 Flash with image generation', cost: fmtTokenCost(0.0000003, 0.00003), inputTokenRate: 0.0000003, outputTokenRate: 0.00003 },
  { id: 'gemini-3-pro-image-preview', name: 'Nano Banana (Gemini 3 Pro Image)', provider: 'Google', category: 'text_generation', description: 'Gemini 3 Pro with image generation', cost: fmtTokenCost(0.000002, 0.000012), inputTokenRate: 0.000002, outputTokenRate: 0.000012 },
  { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2 (Gemini 3.1 Flash Image)', provider: 'Google', category: 'text_generation', description: 'Gemini 3.1 Flash with image generation', cost: fmtTokenCost(0.0000005, 0.000003), inputTokenRate: 0.0000005, outputTokenRate: 0.000003 },

  // ── xAI Grok ──
  { id: 'grok-4-0709', name: 'Grok 4', provider: 'xAI', category: 'text_generation', description: 'xAI flagship model', cost: fmtTokenCost(0.000003, 0.000015), inputTokenRate: 0.000003, outputTokenRate: 0.000015 },
  { id: 'grok-4-fast-non-reasoning', name: 'Grok 4 Fast', provider: 'xAI', category: 'text_generation', description: 'Fast Grok variant', cost: fmtTokenCost(0.0000002, 0.0000005), inputTokenRate: 0.0000002, outputTokenRate: 0.0000005 },
  { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast', provider: 'xAI', category: 'text_generation', description: 'Updated fast Grok', cost: fmtTokenCost(0.0000002, 0.0000005), inputTokenRate: 0.0000002, outputTokenRate: 0.0000005 },
  { id: 'grok-4.20-beta-0309-non-reasoning', name: 'Grok 4.2', provider: 'xAI', category: 'text_generation', description: 'Latest Grok model', cost: fmtTokenCost(0.000002, 0.000006), inputTokenRate: 0.000002, outputTokenRate: 0.000006 },
  { id: 'grok-code-fast-1', name: 'Grok Code Fast', provider: 'xAI', category: 'text_generation', description: 'Code-specialized Grok', cost: fmtTokenCost(0.0000002, 0.0000015), inputTokenRate: 0.0000002, outputTokenRate: 0.0000015 },

  // ── Meta Llama ──
  { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', name: 'Llama 4 Maverick', provider: 'Meta', category: 'text_generation', description: 'Meta open-weight model', cost: fmtTokenCost(0.00000014, 0.00000059), inputTokenRate: 0.00000014, outputTokenRate: 0.00000059 },
  { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B', provider: 'Meta', category: 'text_generation', description: 'Large-scale Llama model', cost: fmtTokenCost(0.0000035, 0.0000035), inputTokenRate: 0.0000035, outputTokenRate: 0.0000035 },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', provider: 'Meta', category: 'text_generation', description: 'Lightweight Llama model', cost: fmtTokenCost(0.00000002, 0.00000005), inputTokenRate: 0.00000002, outputTokenRate: 0.00000005 },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Meta', category: 'text_generation', description: 'Versatile 70B parameter model', cost: fmtTokenCost(0.00000059, 0.00000079), inputTokenRate: 0.00000059, outputTokenRate: 0.00000079 },

  // ── DeepSeek ──
  { id: 'deepseek-ai/DeepSeek-V3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', category: 'text_generation', description: 'Latest DeepSeek model', cost: fmtTokenCost(0.00000027, 0.0000004), inputTokenRate: 0.00000027, outputTokenRate: 0.0000004 },
  { id: 'deepseek/deepseek-v3.1', name: 'DeepSeek V3.1', provider: 'DeepSeek', category: 'text_generation', description: 'Strong reasoning at low cost', cost: fmtTokenCost(0.00000055, 0.00000166), inputTokenRate: 0.00000055, outputTokenRate: 0.00000166 },
  { id: 'deepseek-ai/DeepSeek-V3.1-Terminus', name: 'DeepSeek V3.1 Terminus', provider: 'DeepSeek', category: 'text_generation', description: 'Extended DeepSeek variant', cost: fmtTokenCost(0.00000027, 0.000001), inputTokenRate: 0.00000027, outputTokenRate: 0.000001 },
  { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', provider: 'DeepSeek', category: 'text_generation', description: 'DeepSeek reasoning model', cost: fmtTokenCost(0.000003, 0.000007), inputTokenRate: 0.000003, outputTokenRate: 0.000007 },

  // ── Qwen (Alibaba) ──
  { id: 'Qwen/Qwen3-235B-A22B-Instruct-2507', name: 'Qwen3 235B', provider: 'Qwen', category: 'text_generation', description: 'Large Qwen3 model', cost: fmtTokenCost(0.00000013, 0.0000006), inputTokenRate: 0.00000013, outputTokenRate: 0.0000006 },
  { id: 'qwen3-max', name: 'Qwen3 Max', provider: 'Qwen', category: 'text_generation', description: 'Maximum capability Qwen3', cost: fmtTokenCost(0.0000012, 0.000006), inputTokenRate: 0.0000012, outputTokenRate: 0.000006 },
  { id: 'qwen/qwen3-coder-480b-a35b-instruct', name: 'Qwen3 Coder', provider: 'Qwen', category: 'text_generation', description: 'Code-specialized Qwen3', cost: fmtTokenCost(0.00000029, 0.0000012), inputTokenRate: 0.00000029, outputTokenRate: 0.0000012 },
  { id: 'Qwen/Qwen3-32B', name: 'Qwen3 32B', provider: 'Qwen', category: 'text_generation', description: 'Mid-size Qwen3 model', cost: fmtTokenCost(0.00000009, 0.00000029), inputTokenRate: 0.00000009, outputTokenRate: 0.00000029 },
  { id: 'Qwen/QwQ-32B', name: 'QWQ 32B', provider: 'Qwen', category: 'text_generation', description: 'Qwen reasoning model', cost: fmtTokenCost(0.0000004, 0.0000004), inputTokenRate: 0.0000004, outputTokenRate: 0.0000004 },
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', provider: 'Qwen', category: 'text_generation', description: 'Previous gen Qwen model', cost: fmtTokenCost(0.00000011, 0.00000038), inputTokenRate: 0.00000011, outputTokenRate: 0.00000038 },
  { id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', provider: 'Qwen', category: 'text_generation', description: 'Code-specialized Qwen 2.5', cost: fmtTokenCost(0.00000079, 0.00000079), inputTokenRate: 0.00000079, outputTokenRate: 0.00000079 },

  // ── Kimi (Moonshot AI) ──
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'Moonshot AI', category: 'text_generation', description: 'Latest Kimi model', cost: fmtTokenCost(0.0000006, 0.000003), inputTokenRate: 0.0000006, outputTokenRate: 0.000003 },
  { id: 'kimi-k2-turbo-preview', name: 'Kimi K2 Turbo', provider: 'Moonshot AI', category: 'text_generation', description: 'Fast Kimi model', cost: fmtTokenCost(0.00000015, 0.000008), inputTokenRate: 0.00000015, outputTokenRate: 0.000008 },

  // ── ZhipuAI GLM ──
  { id: 'zai-org/glm-5', name: 'GLM 5', provider: 'ZhipuAI', category: 'text_generation', description: 'Latest GLM model', cost: fmtTokenCost(0.000001, 0.0000032), inputTokenRate: 0.000001, outputTokenRate: 0.0000032 },
  { id: 'zai-org/glm-4.7', name: 'GLM 4.7', provider: 'ZhipuAI', category: 'text_generation', description: 'Updated GLM model', cost: fmtTokenCost(0.0000006, 0.0000022), inputTokenRate: 0.0000006, outputTokenRate: 0.0000022 },
  { id: 'zai-org/glm-4.6', name: 'GLM 4.6', provider: 'ZhipuAI', category: 'text_generation', description: 'GLM 4.6 model', cost: fmtTokenCost(0.0000006, 0.0000022), inputTokenRate: 0.0000006, outputTokenRate: 0.0000022 },
  { id: 'zai-org/glm-4.5', name: 'GLM 4.5', provider: 'ZhipuAI', category: 'text_generation', description: 'GLM 4.5 model', cost: fmtTokenCost(0.0000006, 0.0000022), inputTokenRate: 0.0000006, outputTokenRate: 0.0000022 },

  // ── MiniMax ──
  { id: 'm2.7', name: 'MiniMax M2.7', provider: 'MiniMax', category: 'text_generation', description: 'MiniMax language model', cost: fmtTokenCost(0.0000003, 0.0000012), inputTokenRate: 0.0000003, outputTokenRate: 0.0000012 },
];

// ────────────────────────────────────────────────────────────
// IMAGE GENERATION MODELS
// ────────────────────────────────────────────────────────────

export const IMAGE_GENERATION_MODELS: AbacusModel[] = [
  // ── GPT Image ──
  { id: 'gpt_image15', name: 'GPT Image 1.5', provider: 'OpenAI', category: 'image_generation', description: 'OpenAI image generation model', cost: 'Token-based pricing' },
  { id: 'gpt_image_edit', name: 'GPT Image [Edit]', provider: 'OpenAI', category: 'image_generation', description: 'OpenAI image editing model', cost: 'Token-based pricing' },

  // ── FLUX (Black Forest Labs) ──
  { id: 'flux2', name: 'FLUX.2', provider: 'Black Forest Labs', category: 'image_generation', description: 'Next-gen Flux model', cost: '~$0.96/image', rate: 0.96 },
  { id: 'flux2_pro', name: 'FLUX.2 [Pro]', provider: 'Black Forest Labs', category: 'image_generation', description: 'Pro-tier Flux 2 generation', cost: '~$3/image', rate: 3 },
  { id: 'flux_pro', name: 'FLUX 1.1 [Pro]', provider: 'Black Forest Labs', category: 'image_generation', description: 'High-fidelity image generation', cost: '~$4/image', rate: 4 },
  { id: 'flux_pro_ultra', name: 'FLUX 1.1 [Pro] Ultra', provider: 'Black Forest Labs', category: 'image_generation', description: 'Premium quality Flux generation', cost: '~$6/image', rate: 6 },
  { id: 'flux_kontext', name: 'FLUX.1 Kontext', provider: 'Black Forest Labs', category: 'image_generation', description: 'Context-aware Flux generation', cost: '~$4–$8/image' },
  { id: 'flux_kontext_edit', name: 'FLUX.1 Kontext [Edit]', provider: 'Black Forest Labs', category: 'image_generation', description: 'Context-aware Flux editing', cost: '~$4–$8/image' },
  { id: 'flux_pro_canny', name: 'FLUX 1.1 [Pro] Canny [Edit]', provider: 'Black Forest Labs', category: 'image_generation', description: 'Edge-guided Flux editing', cost: '~$5/image', rate: 5 },
  { id: 'flux_pro_depth', name: 'FLUX 1.1 [Pro] Depth [Edit]', provider: 'Black Forest Labs', category: 'image_generation', description: 'Depth-guided Flux editing', cost: '~$5/image', rate: 5 },

  // ── Google ──
  { id: 'imagen', name: 'Imagen 4', provider: 'Google', category: 'image_generation', description: 'Google Imagen via Abacus', cost: '~$5/image', rate: 5 },
  { id: 'seedream', name: 'Seedream 4.5', provider: 'Google', category: 'image_generation', description: 'Creative and artistic generation', cost: '~$4/image', rate: 4 },

  // ── Ideogram ──
  { id: 'ideogram', name: 'Ideogram 3.0', provider: 'Ideogram', category: 'image_generation', description: 'Excellent text rendering in images', cost: '~$6/image', rate: 6 },
  { id: 'ideogram_character', name: 'Ideogram Character', provider: 'Ideogram', category: 'image_generation', description: 'Character-focused generation', cost: '~$10–$20/image' },

  // ── Recraft ──
  { id: 'recraft', name: 'Recraft', provider: 'Recraft', category: 'image_generation', description: 'Design-oriented image generation', cost: '~$4/image', rate: 4 },
  { id: 'recraft_svg', name: 'Recraft SVG', provider: 'Recraft', category: 'image_generation', description: 'SVG vector image generation', cost: '~$8/image', rate: 8 },

  // ── OpenAI ──
  { id: 'dalle', name: 'DALL-E', provider: 'OpenAI', category: 'image_generation', description: 'OpenAI DALL-E image generation', cost: '~$4–$12/image (varies by quality/res)' },

  // ── Midjourney ──
  { id: 'midjourney', name: 'Midjourney', provider: 'Midjourney', category: 'image_generation', description: 'Artistic image generation', cost: '~$4–$14/image (varies by speed)' },

  // ── Nano Banana (Google Gemini-based) ──
  { id: 'nano_banana', name: 'Nano Banana', provider: 'Google', category: 'image_generation', description: 'Fast multimodal image generation', cost: '~$3.90/image', rate: 3.9 },
  { id: 'nano_banana_pro', name: 'Nano Banana Pro', provider: 'Google', category: 'image_generation', description: 'Enhanced multimodal generation', cost: '~$15/image', rate: 15 },
  { id: 'nano_banana2', name: 'Nano Banana 2', provider: 'Google', category: 'image_generation', description: 'Latest Nano Banana with text rendering', cost: '~$6/image', rate: 6 },

  // ── Qwen ──
  { id: 'qwen_image_edit', name: 'Qwen Image Edit', provider: 'Qwen', category: 'image_generation', description: 'Qwen image editing model', cost: '~$3/megapixel', rate: 3 },

  // ── Hunyuan ──
  { id: 'hunyuan_image', name: 'Hunyuan Image 3.0', provider: 'Tencent', category: 'image_generation', description: 'Hunyuan image generation', cost: '~$10/image', rate: 10 },

  // ── ImagineArt ──
  { id: 'imagine_art', name: 'ImagineArt 1.5', provider: 'ImagineArt', category: 'image_generation', description: 'Artistic image generation', cost: '~$3/image', rate: 3 },

  // ── Dreamina ──
  { id: 'dreamina', name: 'Dreamina', provider: 'ByteDance', category: 'image_generation', description: 'ByteDance image generation', cost: '~$3/image', rate: 3 },

  // ── xAI ──
  { id: 'grok_imagine_image', name: 'Grok Imagine Image', provider: 'xAI', category: 'image_generation', description: 'Grok image generation', cost: '~$2/image', rate: 2 },

  // ── Wan ──
  { id: 'wan27', name: 'Wan 2.7', provider: 'Alibaba', category: 'image_generation', description: 'Wan image generation', cost: '~$3/image', rate: 3 },

  // ── Magnific ──
  { id: 'magnific', name: 'Magnific Upscaler', provider: 'Magnific', category: 'image_generation', description: 'AI image upscaling', cost: '~$11–$132 (varies by resolution)' },
];

// ────────────────────────────────────────────────────────────
// VIDEO GENERATION MODELS
// ────────────────────────────────────────────────────────────

export const VIDEO_GENERATION_MODELS: AbacusModel[] = [
  // ── Google ──
  { id: 'veo31', name: 'Veo 3.1', provider: 'Google', category: 'video_generation', description: 'Latest Google video generation', cost: '~$120–$320/video' },
  { id: 'veo31_lite', name: 'Veo 3.1 Lite', provider: 'Google', category: 'video_generation', description: 'Lightweight Veo 3.1', cost: '~$7/video', rate: 7 },
  { id: 'veo3', name: 'Veo 3', provider: 'Google', category: 'video_generation', description: 'Veo 3 with audio support', cost: '~$200–$600/video' },
  { id: 'veo', name: 'Veo 2', provider: 'Google', category: 'video_generation', description: 'Google Veo 2 video generation', cost: '~$250–$400/video' },
  { id: 'seedance15_pro', name: 'Seedance 1.5 Pro', provider: 'Google', category: 'video_generation', description: 'Pro video generation', cost: '~$26/video', rate: 26 },
  { id: 'seedance_pro', name: 'Seedance Pro', provider: 'Google', category: 'video_generation', description: 'Professional Seedance video', cost: '~$74/video', rate: 74 },
  { id: 'seedance', name: 'Seedance', provider: 'Google', category: 'video_generation', description: 'Google video generation', cost: '~$18/video', rate: 18 },

  // ── OpenAI ──
  { id: 'sora', name: 'Sora 2', provider: 'OpenAI', category: 'video_generation', description: 'OpenAI video generation', cost: '~$10–$30/video' },

  // ── Runway ──
  { id: 'runway', name: 'Runway', provider: 'Runway', category: 'video_generation', description: 'Runway video generation', cost: '~$25–$50/video' },

  // ── Luma Labs ──
  { id: 'luma_labs', name: 'Luma Labs', provider: 'Luma Labs', category: 'video_generation', description: 'Luma Labs video generation', cost: '~$40/video', rate: 40 },

  // ── Kling AI ──
  { id: 'kling_ai_o3', name: 'Kling AI O3', provider: 'Kuaishou', category: 'video_generation', description: 'Latest Kling reasoning video', cost: '~$17–$28/video' },
  { id: 'kling_ai_o1', name: 'Kling AI O1', provider: 'Kuaishou', category: 'video_generation', description: 'Kling reasoning video', cost: '~$42–$112/video' },
  { id: 'kling_ai_v3', name: 'Kling AI v3', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v3 video generation', cost: '~$17–$34/video' },
  { id: 'kling_ai_v26', name: 'Kling AI v2.6', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v2.6 video', cost: '~$7–$14/video', rate: 7 },
  { id: 'kling_ai_v26_motion', name: 'Kling v2.6 Motion Control', provider: 'Kuaishou', category: 'video_generation', description: 'Motion-controlled video generation', cost: '~$11.20/video', rate: 11.2 },
  { id: 'kling_ai_v25', name: 'Kling AI v2.5', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v2.5 video', cost: '~$21–$70/video' },
  { id: 'kling_ai_v21', name: 'Kling AI v2.1', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v2.1 video', cost: '~$140–$280/video' },
  { id: 'kling_ai_v2', name: 'Kling AI v2', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v2 video', cost: '~$140–$280/video' },
  { id: 'kling_ai', name: 'Kling AI v1.6', provider: 'Kuaishou', category: 'video_generation', description: 'Kling v1.6 video', cost: '~$23–$95/video' },

  // ── Hailuo / MiniMax ──
  { id: 'minimax', name: 'Hailuo 2', provider: 'MiniMax', category: 'video_generation', description: 'MiniMax Hailuo video generation', cost: '~$27–$80/video' },

  // ── Hunyuan ──
  { id: 'hunyuan', name: 'Hunyuan Video', provider: 'Tencent', category: 'video_generation', description: 'Tencent video generation', cost: '~$40/video', rate: 40 },

  // ── Wan ──
  { id: 'wan25', name: 'Wan 2.5', provider: 'Alibaba', category: 'video_generation', description: 'Alibaba Wan 2.5 video', cost: '~$5–$15/video' },
  { id: 'wan', name: 'Wan 2.2', provider: 'Alibaba', category: 'video_generation', description: 'Alibaba Wan 2.2 video', cost: '~$1.25–$8/video', rate: 8 },

  // ── xAI ──
  { id: 'grok_imagine_video', name: 'Grok Imagine Video', provider: 'xAI', category: 'video_generation', description: 'Grok video generation', cost: '~$5/video', rate: 5 },

  // ── Topaz ──
  { id: 'topaz', name: 'Topaz Upscaler', provider: 'Topaz', category: 'video_generation', description: 'AI video upscaling', cost: '~$10/video', rate: 10 },
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

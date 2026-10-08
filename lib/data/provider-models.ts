/**
 * Native Provider Model Registry
 * 
 * Models available directly through each provider's own API.
 * This is separate from abacus-models.ts which lists Abacus-proxied models.
 * 
 * Providers:
 * - gemini: Google Gemini API (generativelanguage.googleapis.com)
 * - openai: OpenAI API (api.openai.com)
 * - abacus: Abacus AI RouteLLM (apps.abacus.ai)
 */

export type ApiProviderType = 'gemini' | 'openai' | 'abacus';

export type FunctionType = 'llm_ideas' | 'llm_screenplay' | 'image' | 'video';

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  cost?: string;
  /** Which functions this model can serve */
  functions: FunctionType[];
  /** Extra capabilities */
  supportsRefImage?: boolean;
  supportsStartFrame?: boolean;
  supportsEndFrame?: boolean;
}

export interface ProviderInfo {
  id: ApiProviderType;
  name: string;
  color: string;        // tailwind color name for UI
  icon: string;         // lucide icon name
  keyConfigKey: string;  // SystemConfig DB key for API key
  envFallbackKey: string; // env var fallback
  description: string;
  docsUrl: string;
  docsSteps: string[];
  /** Which function types this provider supports */
  supportedFunctions: FunctionType[];
  models: ProviderModel[];
}

// ── Gemini Models (via @google/genai SDK + OpenAI-compatible endpoint) ──
const GEMINI_MODELS: ProviderModel[] = [
  // LLM
  // Model names aligned with the October 2026 Gemini lineup (pricing per 1M tokens, input/output)
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Latest Gemini Flash', cost: '$0.75/$3.75 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', description: 'Fast Gemini 3.7', cost: '$0.75/$3.75 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', description: 'Fast Gemini 3.6', cost: '$0.75/$3.75 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: 'Gemini 3.5 Flash', cost: '$1.50/$9 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', description: 'Lightweight Gemini 3.5', cost: '$0.30/$2.50 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Pro-tier Gemini', cost: '$2/$12 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: 'Ultra-lightweight Gemini', cost: '$0.25/$1.50 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast, cost-efficient (default)', cost: '$0.50/$3 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'High-quality Gemini reasoning', cost: '$1.25/$10 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast Gemini 2.5', cost: '$0.30/$2.50 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  // Image (Gemini-native "Nano Banana" via generateContent — the Imagen 3/4 families were retired on the Gemini API)
  { id: 'gemini-2.5-flash-image', name: 'Nano Banana', description: 'Native image gen with text (recommended default)', cost: 'Multimodal pricing', functions: ['image'], supportsRefImage: true },
  { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', description: 'Native image gen with text', cost: 'Multimodal pricing', functions: ['image'], supportsRefImage: true },
  // Video (Veo)
  { id: 'veo-3.1-generate-preview', name: 'Veo 3.1', description: '8s video, 720p–4K, native audio', cost: '~$0.35/video (8s)', functions: ['video'], supportsStartFrame: true, supportsEndFrame: true },
  { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast', description: 'Speed-optimized Veo 3.1', cost: '~$0.10/video', functions: ['video'], supportsStartFrame: true },
  { id: 'veo-3.0-generate-preview', name: 'Veo 3', description: 'High quality with audio', cost: '~$0.50/video', functions: ['video'], supportsStartFrame: true, supportsEndFrame: true },
  { id: 'veo-2.0-generate-001', name: 'Veo 2', description: 'Stable video generation', cost: '~$0.25/video', functions: ['video'], supportsStartFrame: true },
];

// ── OpenAI Models (via api.openai.com) ──
const OPENAI_MODELS: ProviderModel[] = [
  // LLM
  // Synced against the live api.openai.com /v1/models catalog — October 2026 (pricing per 1M tokens, input/output)
  { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', description: 'Newest GPT-6.1 flagship', cost: '$2/$10 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-6-astra', name: 'GPT-6 Astra', description: 'Top-tier GPT-6 (premium)', cost: '$10/$50 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-6-sol', name: 'GPT-6 Sol', description: 'Balanced GPT-6', cost: '$2/$10 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna', description: 'Fast, ultra-low-cost GPT-6', cost: '$0.10/$0.50 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', description: 'High-capability GPT-5.6', cost: '$4/$20 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', description: 'Balanced GPT-5.6', cost: '$2/$12 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', description: 'Low-cost GPT-5.6', cost: '$0.20/$1.20 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.5', name: 'GPT-5.5', description: 'GPT-5.5 flagship', cost: '$5/$30 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.4', name: 'GPT-5.4', description: 'GPT-5.4 flagship', cost: '$2.50/$15 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', description: 'Compact GPT-5.4', cost: '$0.75/$4.50 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', description: 'Ultra-light GPT-5.4', cost: '$0.20/$1.25 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.2', name: 'GPT-5.2', description: 'GPT-5.2 reasoning model', cost: '$1.75/$14 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5.1', name: 'GPT-5.1', description: 'GPT-5.1 reasoning model', cost: '$1.25/$10 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5', name: 'GPT-5', description: 'GPT-5 reasoning model', cost: '$1.25/$10 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Compact GPT-5', cost: '$0.25/$2 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'Ultra-light GPT-5', cost: '$0.05/$0.40 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Reliable long-context GPT-4.1', cost: '$2/$8 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Compact and efficient', cost: '$0.40/$1.60 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Ultra-lightweight', cost: '$0.10/$0.40 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal GPT-4o', cost: '$2.50/$10 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cost-efficient multimodal', cost: '$0.15/$0.60 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'o3', name: 'o3', description: 'Advanced reasoning', cost: '$2/$8 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'o4-mini', name: 'o4 Mini', description: 'Efficient reasoning', cost: '$1.10/$4.40 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  { id: 'o3-mini', name: 'o3 Mini', description: 'Efficient reasoning (older)', cost: '$1.10/$4.40 per 1M tok', functions: ['llm_ideas', 'llm_screenplay'] },
  // Image  
  { id: 'gpt-image-1', name: 'GPT Image 1', description: 'Native GPT image generation', cost: '~$0.04/image', functions: ['image'], supportsRefImage: true },
  { id: 'dall-e-3', name: 'DALL-E 3', description: 'High quality image generation', cost: '$0.04–$0.12/image', functions: ['image'] },
  // Video (Sora - being deprecated Sept 2026)
  { id: 'sora-2', name: 'Sora 2', description: 'Video generation (deprecated Sept 2026)', cost: '~$0.10–$0.30/video', functions: ['video'], supportsStartFrame: true },
];

// ── Provider Definitions ──

export const PROVIDERS: Record<ApiProviderType, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    color: 'blue',
    icon: 'Sparkles',
    keyConfigKey: 'GEMINI_API_KEY',
    envFallbackKey: 'GEMINI_API_KEY',
    description: 'Google Gemini API — LLM, Imagen, Veo video generation',
    docsUrl: 'https://aistudio.google.com/apikey',
    docsSteps: [
      'Go to Google AI Studio',
      'Sign in with your Google account',
      'Click "Create API Key"',
      'Copy and paste below',
    ],
    supportedFunctions: ['llm_ideas', 'llm_screenplay', 'image', 'video'],
    models: GEMINI_MODELS,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    color: 'green',
    icon: 'Cpu',
    keyConfigKey: 'OPENAI_API_KEY',
    envFallbackKey: 'OPENAI_API_KEY',
    description: 'OpenAI API — GPT, DALL-E, Sora video generation',
    docsUrl: 'https://platform.openai.com/api-keys',
    docsSteps: [
      'Go to OpenAI Platform',
      'Sign in to your account',
      'Navigate to API Keys',
      'Create and copy your key',
    ],
    supportedFunctions: ['llm_ideas', 'llm_screenplay', 'image', 'video'],
    models: OPENAI_MODELS,
  },
  abacus: {
    id: 'abacus',
    name: 'Abacus.AI',
    color: 'emerald',
    icon: 'Server',
    keyConfigKey: 'ABACUS_API_KEY',
    envFallbackKey: 'ABACUSAI_API_KEY',
    description: 'Abacus.AI RouteLLM — multi-model LLM + image generation',
    docsUrl: 'https://apps.abacus.ai/profile',
    docsSteps: [
      'Go to Abacus.AI Profile',
      'Sign in to your account',
      'Navigate to API Keys section',
      'Create and copy your key',
    ],
    supportedFunctions: ['llm_ideas', 'llm_screenplay', 'image'],
    models: [], // Abacus models come from abacus-models.ts
  },
};

/** Get models for a provider filtered by function type */
export function getProviderModels(provider: ApiProviderType, fn: FunctionType): ProviderModel[] {
  return PROVIDERS[provider].models.filter(m => m.functions.includes(fn));
}

/** Get all providers that support a given function */
export function getProvidersForFunction(fn: FunctionType): ProviderInfo[] {
  return Object.values(PROVIDERS).filter(p => p.supportedFunctions.includes(fn));
}

/** The DB config keys for per-function provider and model */
export const FUNCTION_CONFIG_KEYS: Record<FunctionType, { providerKey: string; modelKey: string }> = {
  llm_ideas: { providerKey: 'FN_LLM_IDEAS_PROVIDER', modelKey: 'FN_LLM_IDEAS_MODEL' },
  llm_screenplay: { providerKey: 'FN_LLM_SCREENPLAY_PROVIDER', modelKey: 'FN_LLM_SCREENPLAY_MODEL' },
  image: { providerKey: 'FN_IMAGE_PROVIDER', modelKey: 'FN_IMAGE_MODEL' },
  video: { providerKey: 'FN_VIDEO_PROVIDER', modelKey: 'FN_VIDEO_MODEL' },
};

/** All SystemConfig keys used by the hybrid config system */
export const ALL_HYBRID_CONFIG_KEYS = [
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ABACUS_API_KEY',
  ...Object.values(FUNCTION_CONFIG_KEYS).flatMap(k => [k.providerKey, k.modelKey]),
  // Legacy keys for backward compat
  'API_PROVIDER', 'IMAGEN_MODEL', 'ABACUS_IMAGE_MODEL',
  'ABACUS_LLM_IDEAS_MODEL', 'ABACUS_LLM_SCREENPLAY_MODEL', 'ABACUS_VIDEO_MODEL',
];

/** Human-friendly function labels */
export const FUNCTION_LABELS: Record<FunctionType, { title: string; description: string; icon: string }> = {
  llm_ideas: { title: 'Story Ideas & Concepts', description: 'Generating story ideas and developing concepts', icon: 'Zap' },
  llm_screenplay: { title: 'Screenplay Writing', description: 'Writing full screenplays from concepts', icon: 'Sparkles' },
  image: { title: 'Image Generation', description: 'Generating storyboard images and artwork', icon: 'ImageIcon' },
  video: { title: 'Video Generation', description: 'Generating video clips for the Director', icon: 'Video' },
};

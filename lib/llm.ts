/**
 * LLM API Utility — Hybrid Multi-Provider Routing
 * 
 * Supports three providers:
 * 1. Gemini — Google's OpenAI-compatible endpoint
 * 2. OpenAI — api.openai.com
 * 3. Abacus AI — apps.abacus.ai RouteLLM
 * 
 * Per-function provider+model stored in SystemConfig:
 *   FN_LLM_IDEAS_PROVIDER / FN_LLM_IDEAS_MODEL
 *   FN_LLM_SCREENPLAY_PROVIDER / FN_LLM_SCREENPLAY_MODEL
 * 
 * Falls back to legacy API_PROVIDER config, then to first available key.
 */

import { prisma } from '@/lib/db';
import { FUNCTION_CONFIG_KEYS, ALL_HYBRID_CONFIG_KEYS, type ApiProviderType } from '@/lib/data/provider-models';

export type ApiProvider = 'gemini' | 'openai' | 'abacus';

export type LLMPurpose = 'default' | 'ideas' | 'screenplay';

// Provider base URLs
const PROVIDER_URLS: Record<ApiProvider, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  abacus: 'https://apps.abacus.ai/v1/chat/completions',
};

// Default models per provider
const DEFAULT_MODELS: Record<ApiProvider, string> = {
  gemini: 'gemini-3-flash-preview',
  openai: 'gpt-4o-mini',
  abacus: 'gemini-3-flash-preview',
};

// Cache DB-fetched config to avoid hitting DB on every call
let cachedConfig: {
  // API keys
  geminiKey: string | null;
  openaiKey: string | null;
  abacusKey: string | null;
  // Per-function config
  fnConfig: Record<string, { provider: string; model: string }>;
  // Legacy fields
  legacyProvider: ApiProvider;
  abacusIdeasModel: string | null;
  abacusScreenplayModel: string | null;
  fetchedAt: number;
} = {
  geminiKey: null, openaiKey: null, abacusKey: null,
  fnConfig: {}, legacyProvider: 'gemini',
  abacusIdeasModel: null, abacusScreenplayModel: null,
  fetchedAt: 0,
};
const DB_KEY_CACHE_TTL = 60_000;

/** Immediately bust the in-memory provider config cache */
export function invalidateLlmCache() {
  cachedConfig.fetchedAt = 0;
}

async function loadProviderConfig(): Promise<typeof cachedConfig> {
  const now = Date.now();
  if (now - cachedConfig.fetchedAt < DB_KEY_CACHE_TTL && (cachedConfig.geminiKey || cachedConfig.openaiKey || cachedConfig.abacusKey)) {
    return cachedConfig;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ALL_HYBRID_CONFIG_KEYS } }
    });
    const cm = Object.fromEntries(configs.map(c => [c.key, c.value]));

    // Build per-function config
    const fnConfig: Record<string, { provider: string; model: string }> = {};
    for (const [fn, keys] of Object.entries(FUNCTION_CONFIG_KEYS)) {
      fnConfig[fn] = {
        provider: cm[keys.providerKey] || '',
        model: cm[keys.modelKey] || '',
      };
    }

    cachedConfig = {
      geminiKey: cm['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY || null,
      openaiKey: cm['OPENAI_API_KEY'] || process.env.OPENAI_API_KEY || null,
      abacusKey: cm['ABACUS_API_KEY'] || process.env.ABACUSAI_API_KEY || null,
      fnConfig,
      legacyProvider: (cm['API_PROVIDER'] as ApiProvider) || 'gemini',
      abacusIdeasModel: cm['ABACUS_LLM_IDEAS_MODEL'] || null,
      abacusScreenplayModel: cm['ABACUS_LLM_SCREENPLAY_MODEL'] || null,
      fetchedAt: now,
    };
  } catch (e) {
    console.warn('Failed to load provider config from DB:', e);
    cachedConfig = {
      geminiKey: process.env.GEMINI_API_KEY || null,
      openaiKey: process.env.OPENAI_API_KEY || null,
      abacusKey: process.env.ABACUSAI_API_KEY || null,
      fnConfig: {},
      legacyProvider: 'gemini',
      abacusIdeasModel: null,
      abacusScreenplayModel: null,
      fetchedAt: Date.now(),
    };
  }

  return cachedConfig;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: ApiProvider;
}

/** Get the API key for a given provider, or null */
function getKeyForProvider(config: typeof cachedConfig, prov: ApiProvider): string | null {
  switch (prov) {
    case 'gemini': return config.geminiKey;
    case 'openai': return config.openaiKey;
    case 'abacus': return config.abacusKey;
    default: return null;
  }
}

/** Find the first provider with an available key */
function findFirstAvailableProvider(config: typeof cachedConfig, preferred?: ApiProvider[]): { provider: ApiProvider; key: string } | null {
  const order = preferred || (['gemini', 'openai', 'abacus'] as ApiProvider[]);
  for (const p of order) {
    const k = getKeyForProvider(config, p);
    if (k) return { provider: p, key: k };
  }
  return null;
}

/** Map LLMPurpose to FunctionType key */
function purposeToFnKey(purpose: LLMPurpose): string {
  switch (purpose) {
    case 'ideas': return 'llm_ideas';
    case 'screenplay': return 'llm_screenplay';
    default: return 'llm_ideas'; // default falls back to ideas config
  }
}

export async function getLLMConfig(purpose: LLMPurpose = 'default'): Promise<LLMConfig> {
  // Priority 1: Custom override env vars
  if (process.env.LLM_API_KEY) {
    return {
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_API_BASE_URL || 'https://api.openai.com/v1/chat/completions',
      model: process.env.LLM_MODEL || 'gemini-3-flash-preview',
      provider: 'gemini',
    };
  }

  const config = await loadProviderConfig();
  const fnKey = purposeToFnKey(purpose);
  const fnCfg = config.fnConfig[fnKey];

  // Priority 2: Per-function provider+model from hybrid config
  if (fnCfg?.provider) {
    const prov = fnCfg.provider as ApiProvider;
    const key = getKeyForProvider(config, prov);
    if (key) {
      const model = fnCfg.model || DEFAULT_MODELS[prov];
      return {
        apiKey: key,
        baseUrl: PROVIDER_URLS[prov],
        model,
        provider: prov,
      };
    }
  }

  // Priority 3: Legacy per-purpose models (Abacus)
  if (config.legacyProvider === 'abacus' && config.abacusKey) {
    let model = DEFAULT_MODELS.abacus;
    if (purpose === 'ideas' && config.abacusIdeasModel) model = config.abacusIdeasModel;
    if (purpose === 'screenplay' && config.abacusScreenplayModel) model = config.abacusScreenplayModel;
    return {
      apiKey: config.abacusKey,
      baseUrl: PROVIDER_URLS.abacus,
      model,
      provider: 'abacus',
    };
  }

  // Priority 4: Legacy provider preference
  const legacyKey = getKeyForProvider(config, config.legacyProvider);
  if (legacyKey) {
    return {
      apiKey: legacyKey,
      baseUrl: PROVIDER_URLS[config.legacyProvider],
      model: DEFAULT_MODELS[config.legacyProvider],
      provider: config.legacyProvider,
    };
  }

  // Priority 5: First available provider
  const available = findFirstAvailableProvider(config);
  if (available) {
    return {
      apiKey: available.key,
      baseUrl: PROVIDER_URLS[available.provider],
      model: DEFAULT_MODELS[available.provider],
      provider: available.provider,
    };
  }

  throw new Error('No LLM API key configured. Set your API key in Admin > API Configuration.');
}

export async function callLLM(options: {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  maxTokens?: number;
  responseFormat?: { type: string };
}) {
  const config = await getLLMConfig();

  const body: Record<string, unknown> = {
    model: options.model || config.model,
    messages: options.messages,
  };

  if (options.stream !== undefined) body.stream = options.stream;
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.responseFormat) body.response_format = options.responseFormat;

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

/**
 * Get the currently active provider name. Useful for trackUsage calls.
 */
export async function getActiveProvider(): Promise<ApiProvider> {
  const config = await loadProviderConfig();
  if (config.legacyProvider && getKeyForProvider(config, config.legacyProvider)) {
    return config.legacyProvider;
  }
  const avail = findFirstAvailableProvider(config);
  return avail?.provider || config.legacyProvider;
}

/**
 * Get the loaded config for use by other modules (imagen, video-gen)
 */
export async function getProviderKeys(): Promise<{
  geminiKey: string | null;
  openaiKey: string | null;
  abacusKey: string | null;
  fnConfig: Record<string, { provider: string; model: string }>;
  legacyProvider: ApiProvider;
}> {
  const config = await loadProviderConfig();
  return {
    geminiKey: config.geminiKey,
    openaiKey: config.openaiKey,
    abacusKey: config.abacusKey,
    fnConfig: config.fnConfig,
    legacyProvider: config.legacyProvider,
  };
}

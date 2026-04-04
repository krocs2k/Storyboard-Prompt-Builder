/**
 * LLM API Utility
 * Provides a configurable OpenAI-compatible API client.
 * 
 * Supports two providers:
 * 1. Gemini (default) — uses Google's OpenAI-compatible endpoint
 * 2. Abacus AI — uses https://apps.abacus.ai/v1/chat/completions
 * 
 * The active provider is stored in SystemConfig as 'API_PROVIDER' ('gemini' | 'abacus').
 * API keys are stored in SystemConfig as 'GEMINI_API_KEY' or 'ABACUS_API_KEY'.
 * Override with LLM_API_KEY + LLM_API_BASE_URL for custom providers.
 */

import { prisma } from '@/lib/db';

export type ApiProvider = 'gemini' | 'abacus';

// Cache DB-fetched config to avoid hitting DB on every call
let cachedConfig: {
  provider: ApiProvider;
  geminiKey: string | null;
  abacusKey: string | null;
  fetchedAt: number;
} = { provider: 'gemini', geminiKey: null, abacusKey: null, fetchedAt: 0 };
const DB_KEY_CACHE_TTL = 60_000; // 60 seconds

/** Immediately bust the in-memory provider config cache so next call re-reads from DB */
export function invalidateLlmCache() {
  cachedConfig.fetchedAt = 0;
}

async function loadProviderConfig(): Promise<typeof cachedConfig> {
  const now = Date.now();
  if (now - cachedConfig.fetchedAt < DB_KEY_CACHE_TTL && (cachedConfig.geminiKey || cachedConfig.abacusKey)) {
    return cachedConfig;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['API_PROVIDER', 'GEMINI_API_KEY', 'ABACUS_API_KEY'] } }
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));

    cachedConfig = {
      provider: (configMap['API_PROVIDER'] as ApiProvider) || 'gemini',
      geminiKey: configMap['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY || null,
      abacusKey: configMap['ABACUS_API_KEY'] || process.env.ABACUSAI_API_KEY || null,
      fetchedAt: now,
    };
  } catch (e) {
    console.warn('Failed to load provider config from DB:', e);
    // Fallback to env vars
    cachedConfig = {
      provider: 'gemini',
      geminiKey: process.env.GEMINI_API_KEY || null,
      abacusKey: process.env.ABACUSAI_API_KEY || null,
      fetchedAt: now,
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

export async function getLLMConfig(): Promise<LLMConfig> {
  // Priority 1: Custom provider override (LLM_API_KEY + LLM_API_BASE_URL)
  if (process.env.LLM_API_KEY) {
    return {
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_API_BASE_URL || 'https://api.openai.com/v1/chat/completions',
      model: process.env.LLM_MODEL || 'gemini-3-flash-preview',
      provider: 'gemini', // treat custom override as generic
    };
  }

  // Priority 2: DB-stored provider preference
  const config = await loadProviderConfig();

  if (config.provider === 'abacus' && config.abacusKey) {
    return {
      apiKey: config.abacusKey,
      baseUrl: 'https://apps.abacus.ai/v1/chat/completions',
      model: process.env.LLM_MODEL || 'gemini-3-flash-preview',
      provider: 'abacus',
    };
  }

  if (config.geminiKey) {
    return {
      apiKey: config.geminiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: process.env.LLM_MODEL || 'gemini-3-flash-preview',
      provider: 'gemini',
    };
  }

  // If abacus key exists but gemini was selected (or vice versa), try the other
  if (config.abacusKey) {
    return {
      apiKey: config.abacusKey,
      baseUrl: 'https://apps.abacus.ai/v1/chat/completions',
      model: process.env.LLM_MODEL || 'gemini-3-flash-preview',
      provider: 'abacus',
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
  // If preferred provider has a key, use it; otherwise use whatever has a key
  if (config.provider === 'abacus' && config.abacusKey) return 'abacus';
  if (config.provider === 'gemini' && config.geminiKey) return 'gemini';
  if (config.abacusKey) return 'abacus';
  if (config.geminiKey) return 'gemini';
  return config.provider;
}
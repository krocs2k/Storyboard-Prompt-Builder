/**
 * LLM API Utility
 * Provides a configurable OpenAI-compatible API client.
 * 
 * Uses the Gemini API key (from Admin > Gemini API in DB, or GEMINI_API_KEY env var)
 * with Google's OpenAI-compatible endpoint by default.
 * Override with LLM_API_KEY + LLM_API_BASE_URL for other providers.
 */

import { prisma } from '@/lib/db';

// Cache the DB-fetched key to avoid hitting DB on every call
let cachedDbKey: { key: string | null; fetchedAt: number } = { key: null, fetchedAt: 0 };
const DB_KEY_CACHE_TTL = 60_000; // 60 seconds

async function getGeminiApiKey(): Promise<string | null> {
  const now = Date.now();
  if (now - cachedDbKey.fetchedAt < DB_KEY_CACHE_TTL && cachedDbKey.key) {
    return cachedDbKey.key;
  }

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'GEMINI_API_KEY' }
    });
    if (config?.value) {
      cachedDbKey = { key: config.value, fetchedAt: now };
      return config.value;
    }
  } catch (e) {
    console.warn('Failed to read Gemini key from DB:', e);
  }

  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    cachedDbKey = { key: envKey, fetchedAt: now };
    return envKey;
  }

  return null;
}

export async function getLLMConfig() {
  // Priority 1: Custom provider override (LLM_API_KEY + LLM_API_BASE_URL)
  if (process.env.LLM_API_KEY) {
    return {
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_API_BASE_URL || 'https://api.openai.com/v1/chat/completions',
      model: process.env.LLM_MODEL || 'gemini-3-flash-preview',
    };
  }

  // Priority 2: Gemini API key (from DB or env) with Google's OpenAI-compatible endpoint
  const geminiKey = await getGeminiApiKey();
  if (geminiKey) {
    return {
      apiKey: geminiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: process.env.LLM_MODEL || 'gemini-3-flash-preview',
    };
  }

  throw new Error('No LLM API key configured. Set your Gemini API key in Admin > Gemini API, or set LLM_API_KEY env var.');
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

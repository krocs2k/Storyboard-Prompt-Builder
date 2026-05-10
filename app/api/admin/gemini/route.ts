import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { invalidateAllApiCaches } from '@/lib/api-config-cache';
import { ALL_HYBRID_CONFIG_KEYS, FUNCTION_CONFIG_KEYS } from '@/lib/data/provider-models';

// Legacy keys (kept for backward compat)
const CONFIG_KEY = 'GEMINI_API_KEY';
const ABACUS_KEY = 'ABACUS_API_KEY';
const OPENAI_KEY = 'OPENAI_API_KEY';
const IMAGEN_MODEL_KEY = 'IMAGEN_MODEL';
const ABACUS_IMAGE_MODEL_KEY = 'ABACUS_IMAGE_MODEL';
const ABACUS_LLM_IDEAS_MODEL_KEY = 'ABACUS_LLM_IDEAS_MODEL';
const ABACUS_LLM_SCREENPLAY_MODEL_KEY = 'ABACUS_LLM_SCREENPLAY_MODEL';
const ABACUS_VIDEO_MODEL_KEY = 'ABACUS_VIDEO_MODEL';
const PROVIDER_KEY = 'API_PROVIDER';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ALL_HYBRID_CONFIG_KEYS } }
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));

    // Helper to mask a key
    const mask = (v: string | undefined) => v ? v.slice(0, 6) + '...' + v.slice(-4) : null;

    // API Keys
    const geminiValue = configMap[CONFIG_KEY];
    const abacusValue = configMap[ABACUS_KEY];
    const openaiValue = configMap[OPENAI_KEY];

    // Per-function configuration
    const functionConfig: Record<string, { provider: string; model: string }> = {};
    for (const [fn, keys] of Object.entries(FUNCTION_CONFIG_KEYS)) {
      functionConfig[fn] = {
        provider: configMap[keys.providerKey] || '',
        model: configMap[keys.modelKey] || '',
      };
    }

    // Legacy values (still used as fallback)
    const provider = configMap[PROVIDER_KEY] || 'gemini';
    const imagenModel = configMap[IMAGEN_MODEL_KEY] || 'imagen-4.0-generate-001';
    const abacusImageModel = configMap[ABACUS_IMAGE_MODEL_KEY] || 'gpt-5.1';
    const abacusIdeasModel = configMap[ABACUS_LLM_IDEAS_MODEL_KEY] || '';
    const abacusScreenplayModel = configMap[ABACUS_LLM_SCREENPLAY_MODEL_KEY] || '';
    const abacusVideoModel = configMap[ABACUS_VIDEO_MODEL_KEY] || '';

    return NextResponse.json({
      // API key status for all 3 providers
      keys: {
        gemini: { hasKey: !!geminiValue, maskedKey: mask(geminiValue), hasEnvKey: !!process.env.GEMINI_API_KEY },
        openai: { hasKey: !!openaiValue, maskedKey: mask(openaiValue), hasEnvKey: !!process.env.OPENAI_API_KEY },
        abacus: { hasKey: !!abacusValue, maskedKey: mask(abacusValue), hasEnvKey: !!process.env.ABACUSAI_API_KEY },
      },
      // Per-function configuration
      functionConfig,
      // Legacy fields for backward compat
      provider,
      hasGeminiKey: !!geminiValue,
      maskedGeminiKey: mask(geminiValue),
      hasGeminiEnvKey: !!process.env.GEMINI_API_KEY,
      hasAbacusKey: !!abacusValue,
      maskedAbacusKey: mask(abacusValue),
      hasAbacusEnvKey: !!process.env.ABACUSAI_API_KEY,
      hasOpenaiKey: !!openaiValue,
      maskedOpenaiKey: mask(openaiValue),
      hasOpenaiEnvKey: !!process.env.OPENAI_API_KEY,
      imagenModel,
      abacusImageModel,
      abacusIdeasModel,
      abacusScreenplayModel,
      abacusVideoModel,
    });
  } catch (error) {
    console.error('Failed to get API config:', error);
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // ── Save API keys ──
    if (body.apiKey !== undefined) {
      await upsertKey(CONFIG_KEY, body.apiKey);
    }
    if (body.abacusApiKey !== undefined) {
      await upsertKey(ABACUS_KEY, body.abacusApiKey);
    }
    if (body.openaiApiKey !== undefined) {
      await upsertKey(OPENAI_KEY, body.openaiApiKey);
    }

    // ── Save per-function config ──
    if (body.functionConfig) {
      for (const [fn, config] of Object.entries(body.functionConfig) as [string, { provider?: string; model?: string }][]) {
        const keys = FUNCTION_CONFIG_KEYS[fn as keyof typeof FUNCTION_CONFIG_KEYS];
        if (!keys) continue;
        if (config.provider !== undefined) {
          await upsertOrDelete(keys.providerKey, config.provider);
        }
        if (config.model !== undefined) {
          await upsertOrDelete(keys.modelKey, config.model);
        }
      }
    }

    // ── Legacy fields (backward compat) ──
    if (body.provider !== undefined) {
      if (!['gemini', 'abacus', 'openai'].includes(body.provider)) {
        return NextResponse.json({ error: 'Invalid provider selection' }, { status: 400 });
      }
      await upsertOrDelete(PROVIDER_KEY, body.provider);
    }
    if (body.imagenModel !== undefined) {
      await upsertOrDelete(IMAGEN_MODEL_KEY, body.imagenModel);
    }
    if (body.abacusImageModel !== undefined) {
      await upsertOrDelete(ABACUS_IMAGE_MODEL_KEY, body.abacusImageModel);
    }
    if (body.abacusVideoModel !== undefined) {
      await upsertOrDelete(ABACUS_VIDEO_MODEL_KEY, body.abacusVideoModel);
    }
    if (body.abacusIdeasModel !== undefined) {
      await upsertOrDelete(ABACUS_LLM_IDEAS_MODEL_KEY, body.abacusIdeasModel);
    }
    if (body.abacusScreenplayModel !== undefined) {
      await upsertOrDelete(ABACUS_LLM_SCREENPLAY_MODEL_KEY, body.abacusScreenplayModel);
    }

    invalidateAllApiCaches();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save API config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const keyType = url.searchParams.get('type');

    const keyMap: Record<string, string> = {
      gemini: CONFIG_KEY,
      openai: OPENAI_KEY,
      abacus: ABACUS_KEY,
    };

    const dbKey = keyMap[keyType || 'gemini'] || CONFIG_KEY;
    await prisma.systemConfig.deleteMany({ where: { key: dbKey } });

    invalidateAllApiCaches();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete API config:', error);
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
  }
}

// ── Helpers ──

async function upsertKey(key: string, value: string) {
  if (!value || typeof value !== 'string' || value.trim().length < 10) {
    throw new Error(`A valid API key is required for ${key}`);
  }
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: value.trim() },
    create: { key, value: value.trim() },
  });
}

async function upsertOrDelete(key: string, value: string) {
  if (!value || value.trim() === '') {
    await prisma.systemConfig.deleteMany({ where: { key } });
  } else {
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: value.trim() },
      create: { key, value: value.trim() },
    });
  }
}

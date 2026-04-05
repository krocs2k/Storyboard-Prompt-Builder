import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { invalidateAllApiCaches } from '@/lib/api-config-cache';

const CONFIG_KEY = 'GEMINI_API_KEY';
const ABACUS_KEY = 'ABACUS_API_KEY';
const IMAGEN_MODEL_KEY = 'IMAGEN_MODEL';
const ABACUS_IMAGE_MODEL_KEY = 'ABACUS_IMAGE_MODEL';
const ABACUS_LLM_IDEAS_MODEL_KEY = 'ABACUS_LLM_IDEAS_MODEL';
const ABACUS_LLM_SCREENPLAY_MODEL_KEY = 'ABACUS_LLM_SCREENPLAY_MODEL';
const PROVIDER_KEY = 'API_PROVIDER';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: [CONFIG_KEY, ABACUS_KEY, IMAGEN_MODEL_KEY, ABACUS_IMAGE_MODEL_KEY, ABACUS_LLM_IDEAS_MODEL_KEY, ABACUS_LLM_SCREENPLAY_MODEL_KEY, PROVIDER_KEY] } }
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));

    // Gemini key
    const geminiValue = configMap[CONFIG_KEY];
    const hasGeminiKey = !!geminiValue;
    const maskedGeminiKey = hasGeminiKey
      ? geminiValue.slice(0, 6) + '...' + geminiValue.slice(-4)
      : null;

    // Abacus key
    const abacusValue = configMap[ABACUS_KEY];
    const hasAbacusKey = !!abacusValue;
    const maskedAbacusKey = hasAbacusKey
      ? abacusValue.slice(0, 6) + '...' + abacusValue.slice(-4)
      : null;

    // Env fallbacks
    const hasGeminiEnvKey = !!process.env.GEMINI_API_KEY;
    const hasAbacusEnvKey = !!process.env.ABACUSAI_API_KEY;

    // Provider and model preferences
    const provider = configMap[PROVIDER_KEY] || 'gemini';
    const imagenModel = configMap[IMAGEN_MODEL_KEY] || 'imagen-4.0-generate-001';
    const abacusImageModel = configMap[ABACUS_IMAGE_MODEL_KEY] || 'gpt-5.1';
    const abacusIdeasModel = configMap[ABACUS_LLM_IDEAS_MODEL_KEY] || '';
    const abacusScreenplayModel = configMap[ABACUS_LLM_SCREENPLAY_MODEL_KEY] || '';

    return NextResponse.json({
      // Legacy fields for backward compat
      hasKey: hasGeminiKey,
      maskedKey: maskedGeminiKey,
      hasEnvKey: hasGeminiEnvKey,
      imagenModel,
      // New fields
      provider,
      hasGeminiKey,
      maskedGeminiKey,
      hasGeminiEnvKey,
      hasAbacusKey,
      maskedAbacusKey,
      hasAbacusEnvKey,
      abacusImageModel,
      abacusIdeasModel,
      abacusScreenplayModel,
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
    const { apiKey, abacusApiKey, imagenModel, abacusImageModel, abacusIdeasModel, abacusScreenplayModel, provider } = body;

    // Handle provider selection
    if (provider !== undefined) {
      if (!['gemini', 'abacus'].includes(provider)) {
        return NextResponse.json({ error: 'Invalid provider selection' }, { status: 400 });
      }
      await prisma.systemConfig.upsert({
        where: { key: PROVIDER_KEY },
        update: { value: provider },
        create: { key: PROVIDER_KEY, value: provider }
      });
    }

    // Handle Gemini API key save
    if (apiKey !== undefined) {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
        return NextResponse.json({ error: 'A valid API key is required' }, { status: 400 });
      }
      await prisma.systemConfig.upsert({
        where: { key: CONFIG_KEY },
        update: { value: apiKey.trim() },
        create: { key: CONFIG_KEY, value: apiKey.trim() }
      });
    }

    // Handle Abacus API key save
    if (abacusApiKey !== undefined) {
      if (!abacusApiKey || typeof abacusApiKey !== 'string' || abacusApiKey.trim().length < 10) {
        return NextResponse.json({ error: 'A valid Abacus API key is required' }, { status: 400 });
      }
      await prisma.systemConfig.upsert({
        where: { key: ABACUS_KEY },
        update: { value: abacusApiKey.trim() },
        create: { key: ABACUS_KEY, value: abacusApiKey.trim() }
      });
    }

    // Handle Imagen model preference save (Gemini)
    if (imagenModel !== undefined) {
      const validModels = ['imagen-4.0-generate-001', 'imagen-4.0-fast-generate-001', 'gemini-3.1-flash-image-preview'];
      if (!validModels.includes(imagenModel)) {
        return NextResponse.json({ error: 'Invalid Imagen model selection' }, { status: 400 });
      }
      await prisma.systemConfig.upsert({
        where: { key: IMAGEN_MODEL_KEY },
        update: { value: imagenModel },
        create: { key: IMAGEN_MODEL_KEY, value: imagenModel }
      });
    }

    // Handle Abacus image model preference
    if (abacusImageModel !== undefined) {
      const validModels = ['gpt-5.1', 'flux2_pro', 'flux_pro_ultra', 'seedream', 'ideogram', 'recraft', 'dalle', 'nano_banana_pro', 'nano_banana2', 'imagen'];
      if (!validModels.includes(abacusImageModel)) {
        return NextResponse.json({ error: 'Invalid Abacus image model selection' }, { status: 400 });
      }
      await prisma.systemConfig.upsert({
        where: { key: ABACUS_IMAGE_MODEL_KEY },
        update: { value: abacusImageModel },
        create: { key: ABACUS_IMAGE_MODEL_KEY, value: abacusImageModel }
      });
    }

    // Handle Abacus LLM model for story ideas/concepts
    if (abacusIdeasModel !== undefined) {
      if (abacusIdeasModel === '') {
        // Empty string means reset to default
        await prisma.systemConfig.deleteMany({ where: { key: ABACUS_LLM_IDEAS_MODEL_KEY } });
      } else {
        await prisma.systemConfig.upsert({
          where: { key: ABACUS_LLM_IDEAS_MODEL_KEY },
          update: { value: abacusIdeasModel },
          create: { key: ABACUS_LLM_IDEAS_MODEL_KEY, value: abacusIdeasModel },
        });
      }
    }

    // Handle Abacus LLM model for screenplay generation
    if (abacusScreenplayModel !== undefined) {
      if (abacusScreenplayModel === '') {
        await prisma.systemConfig.deleteMany({ where: { key: ABACUS_LLM_SCREENPLAY_MODEL_KEY } });
      } else {
        await prisma.systemConfig.upsert({
          where: { key: ABACUS_LLM_SCREENPLAY_MODEL_KEY },
          update: { value: abacusScreenplayModel },
          create: { key: ABACUS_LLM_SCREENPLAY_MODEL_KEY, value: abacusScreenplayModel },
        });
      }
    }

    // Bust all in-memory caches so the new values are picked up immediately
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

    // Check if a specific key type is requested
    const url = new URL(request.url);
    const keyType = url.searchParams.get('type');

    if (keyType === 'abacus') {
      await prisma.systemConfig.deleteMany({ where: { key: ABACUS_KEY } });
    } else {
      // Default: delete Gemini key (backward compat)
      await prisma.systemConfig.deleteMany({ where: { key: CONFIG_KEY } });
    }

    // Bust all in-memory caches so the deletion is picked up immediately
    invalidateAllApiCaches();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete API config:', error);
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
  }
}
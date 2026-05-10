export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getVideoModelInfo } from '@/lib/video-gen';
import { getProviderModels, PROVIDERS } from '@/lib/data/provider-models';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const modelInfo = await getVideoModelInfo();

    // Get available video models from Gemini and OpenAI
    const geminiVideoModels = getProviderModels('gemini', 'video').map(m => ({
      id: m.id, name: m.name, provider: 'Google',
      cost: m.cost, supportsStartFrame: !!m.supportsStartFrame, supportsEndFrame: !!m.supportsEndFrame,
    }));
    const openaiVideoModels = getProviderModels('openai', 'video').map(m => ({
      id: m.id, name: m.name, provider: 'OpenAI',
      cost: m.cost, supportsStartFrame: !!m.supportsStartFrame, supportsEndFrame: !!m.supportsEndFrame,
    }));

    return NextResponse.json({
      selectedModelId: modelInfo?.model || '',
      selectedModel: modelInfo || null,
      hasApiKey: !!modelInfo,
      provider: modelInfo?.provider || null,
      supportsStartFrame: modelInfo?.supportsStartFrame || false,
      supportsEndFrame: modelInfo?.supportsEndFrame || false,
      availableModels: [...geminiVideoModels, ...openaiVideoModels],
    });
  } catch (error) {
    console.error('Director config error:', error);
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const CONFIG_KEY = 'GEMINI_API_KEY';
const IMAGEN_MODEL_KEY = 'IMAGEN_MODEL';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [config, imagenModelConfig] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } }),
      prisma.systemConfig.findUnique({ where: { key: IMAGEN_MODEL_KEY } }),
    ]);

    // Return masked key + whether it's set
    const hasKey = !!config?.value;
    const maskedKey = hasKey
      ? config!.value.slice(0, 6) + '...' + config!.value.slice(-4)
      : null;

    // Also check if env var fallback exists
    const hasEnvKey = !!process.env.GEMINI_API_KEY;

    // Imagen model preference (default: standard)
    const imagenModel = imagenModelConfig?.value || 'imagen-4.0-generate-001';

    return NextResponse.json({ hasKey, maskedKey, hasEnvKey, imagenModel });
  } catch (error) {
    console.error('Failed to get Gemini config:', error);
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey, imagenModel } = await request.json();

    // Handle API key save
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

    // Handle Imagen model preference save
    if (imagenModel !== undefined) {
      const validModels = ['imagen-4.0-generate-001', 'imagen-4.0-fast-generate-001'];
      if (!validModels.includes(imagenModel)) {
        return NextResponse.json({ error: 'Invalid Imagen model selection' }, { status: 400 });
      }
      await prisma.systemConfig.upsert({
        where: { key: IMAGEN_MODEL_KEY },
        update: { value: imagenModel },
        create: { key: IMAGEN_MODEL_KEY, value: imagenModel }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save Gemini config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.systemConfig.deleteMany({
      where: { key: CONFIG_KEY }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete Gemini config:', error);
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
  }
}

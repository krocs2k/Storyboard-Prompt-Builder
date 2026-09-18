export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { invalidateAllApiCaches } from '@/lib/api-config-cache';
import {
  getImageModelRegistry,
  saveImageModelRegistry,
  fetchLiveGeminiImageModels,
  cheapestActiveModel,
} from '@/lib/image-model-registry';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

/**
 * GET  -> returns the managed image-model registry (+ the current cheapest
 *         active model). Pass ?refresh=true to also reconcile against the live
 *         list of valid image models Google currently serves for the stored key.
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const registry = await getImageModelRegistry();
    const cheapest = cheapestActiveModel(registry);

    const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
    let live: string[] | undefined;
    let liveError: string | undefined;
    if (refresh) {
      const row = await prisma.systemConfig.findUnique({ where: { key: 'GEMINI_API_KEY' } });
      const key = row?.value || process.env.GEMINI_API_KEY || '';
      const result = await fetchLiveGeminiImageModels(key);
      live = result.ids;
      liveError = result.error;
    }

    return NextResponse.json({
      registry,
      cheapestActive: cheapest?.apiName || null,
      live,
      liveError,
    });
  } catch (err) {
    console.error('[admin/gemini/models] GET failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to load image model registry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST -> save the managed registry. Body: { models: ImageModelEntry[] }.
 * Prices and the active flag are admin-managed; the API name is what gets sent
 * in the provider call.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const models = Array.isArray(body?.models) ? body.models : [];
    if (models.length === 0) {
      return NextResponse.json({ error: 'At least one model is required' }, { status: 400 });
    }
    const saved = await saveImageModelRegistry(models);
    // Registry drives image routing/pricing decisions; bust the image config cache.
    invalidateAllApiCaches();
    const cheapest = cheapestActiveModel(saved);
    return NextResponse.json({ registry: saved, cheapestActive: cheapest?.apiName || null });
  } catch (err) {
    console.error('[admin/gemini/models] POST failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to save image model registry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

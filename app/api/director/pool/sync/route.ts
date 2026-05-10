export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST: Sync storyboard + gallery images into the pool for a project.
 * Upserts by sourceId so duplicates are never created.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await request.json();
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Fetch existing pool source IDs to avoid duplicates
    const existingPool = await prisma.poolImage.findMany({
      where: { projectId, source: { in: ['storyboard', 'gallery'] } },
      select: { sourceId: true },
    });
    const existingSourceIds = new Set(existingPool.map(p => p.sourceId).filter(Boolean));

    // Get max sort order
    const maxSort = await prisma.poolImage.aggregate({
      where: { projectId, deleted: false },
      _max: { sortOrder: true },
    });
    let nextSort = (maxSort._max.sortOrder ?? -1) + 1;

    // Fetch storyboard images
    const sbImages = await prisma.storyboardImage.findMany({ where: { projectId } });
    const newSb = sbImages.filter(si => !existingSourceIds.has(si.id));

    // Fetch gallery images
    const galImages = await prisma.galleryImage.findMany({ where: { projectId } });
    const newGal = galImages.filter(gi => !existingSourceIds.has(gi.id));

    // Build a properly-formed image URL for storyboard/gallery image paths.
    // The image API route expects: /api/images?path=<encoded relative path>
    const buildUrl = (rawPath: string) => {
      if (!rawPath) return rawPath;
      if (rawPath.startsWith('http') || rawPath.startsWith('/api/')) return rawPath;
      // Strip any leading slash so we always send a relative path to the API
      const rel = rawPath.replace(/^\/+/, '');
      return `/api/images?path=${encodeURIComponent(rel)}`;
    };

    const toCreate = [];

    for (const si of newSb) {
      toCreate.push({
        projectId,
        label: `Shot ${si.blockNumber + 1}`,
        imagePath: buildUrl(si.imagePath),
        fileName: si.fileName,
        aspectRatio: si.aspectRatio || '16:9',
        source: 'storyboard',
        sourceId: si.id,
        sortOrder: nextSort++,
      });
    }

    for (const gi of newGal) {
      toCreate.push({
        projectId,
        label: gi.label || gi.imageKey || 'Gallery image',
        imagePath: buildUrl(gi.imagePath),
        fileName: gi.fileName,
        aspectRatio: gi.aspectRatio || '16:9',
        width: gi.width || 0,
        height: gi.height || 0,
        source: 'gallery',
        sourceId: gi.id,
        sortOrder: nextSort++,
      });
    }

    if (toCreate.length > 0) {
      await prisma.poolImage.createMany({ data: toCreate });
    }

    // ---- Heal/backfill: fix existing pool rows that have broken/legacy paths.
    // Earlier code stored `/api/images/<path>` (path-style) instead of the
    // working query-string format, which caused images to break for previously
    // opened projects. Re-derive URL from the source row (storyboard/gallery)
    // when needed.
    let healed = 0;
    const sbById = new Map(sbImages.map(s => [s.id, s]));
    const galById = new Map(galImages.map(g => [g.id, g]));
    const allPool = await prisma.poolImage.findMany({
      where: { projectId, source: { in: ['storyboard', 'gallery'] } },
    });
    for (const p of allPool) {
      const path = p.imagePath || '';
      const isBroken =
        !path ||
        path.startsWith('/api/images/') || // legacy path-style (broken)
        (!path.startsWith('http') && !path.startsWith('/api/')); // raw relative path
      if (!isBroken) continue;
      let correct: string | null = null;
      if (p.source === 'storyboard' && p.sourceId) {
        const si = sbById.get(p.sourceId);
        if (si?.imagePath) correct = buildUrl(si.imagePath);
      } else if (p.source === 'gallery' && p.sourceId) {
        const gi = galById.get(p.sourceId);
        if (gi?.imagePath) correct = buildUrl(gi.imagePath);
      }
      // Last resort: try to repair path-style URLs in place
      if (!correct && path.startsWith('/api/images/')) {
        const rel = path.replace(/^\/api\/images\//, '');
        if (rel) correct = `/api/images?path=${encodeURIComponent(rel)}`;
      }
      if (correct && correct !== path) {
        await prisma.poolImage.update({ where: { id: p.id }, data: { imagePath: correct } });
        healed++;
      }
    }

    return NextResponse.json({ success: true, imported: toCreate.length, healed });
  } catch (error) {
    console.error('Pool sync error:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}

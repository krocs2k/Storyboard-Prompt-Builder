export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CATEGORY_CONFIG, invalidateAllCategoryCaches } from '@/lib/category-overrides';
import { invalidateMovieStyleCache } from '@/lib/movie-style-ref';

/**
 * DELETE - Reset the image database by clearing all category overrides from SystemConfig.
 * This removes ALL image/description associations so the app falls back to static defaults.
 * Use this before a fresh import to ensure production matches dev exactly.
 *
 * Query params:
 *   - confirm=true  (required safety check)
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const confirm = req.nextUrl.searchParams.get('confirm');
  if (confirm !== 'true') {
    return NextResponse.json({ error: 'Pass ?confirm=true to proceed' }, { status: 400 });
  }

  // All SystemConfig keys that store category image/override data
  const keysToDelete = [
    // Generic category overrides
    ...Object.keys(CATEGORY_CONFIG).map(cat => `${cat}_overrides`),
    // Movie-style specific keys
    'movie_style_overrides',
    'movie_style_settings',
    'movie_style_custom',
    'movie_style_hidden',
  ];

  try {
    const result = await prisma.systemConfig.deleteMany({
      where: { key: { in: keysToDelete } },
    });

    // Invalidate all in-memory caches
    invalidateAllCategoryCaches();
    try { invalidateMovieStyleCache(); } catch { /* ok */ }

    return NextResponse.json({
      success: true,
      message: `Reset image database: deleted ${result.count} override entries`,
      deletedCount: result.count,
      keysCleared: keysToDelete,
    });
  } catch (err) {
    console.error('Failed to reset image database:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reset failed' },
      { status: 500 }
    );
  }
}

/**
 * GET - Preview what would be reset (list override keys and counts)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keysToCheck = [
    ...Object.keys(CATEGORY_CONFIG).map(cat => `${cat}_overrides`),
    'movie_style_overrides',
    'movie_style_settings',
    'movie_style_custom',
    'movie_style_hidden',
  ];

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: keysToCheck } },
      select: { key: true, value: true },
    });

    const entries = configs.map(c => {
      let itemCount = 0;
      try {
        const parsed = JSON.parse(c.value);
        itemCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
      } catch { /* ok */ }
      return { key: c.key, itemCount };
    });

    return NextResponse.json({
      totalEntries: entries.length,
      entries,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to preview' }, { status: 500 });
  }
}

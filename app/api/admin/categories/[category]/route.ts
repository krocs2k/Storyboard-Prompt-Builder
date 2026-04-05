export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  CATEGORY_CONFIG,
  loadCategoryItems,
  getCategoryOverrides,
  saveCategoryOverrides,
  mergeWithOverrides,
  invalidateCategoryCache,
  CategoryOverride,
} from '@/lib/category-overrides';

interface Params {
  params: { category: string };
}

/**
 * GET - List all items for a category with overrides merged
 */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = params;
  const config = CATEGORY_CONFIG[category];
  if (!config) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 });
  }

  const items = await loadCategoryItems(category);
  const overrides = await getCategoryOverrides(category);
  const merged = mergeWithOverrides(items, overrides);

  // Rewrite /images/... paths to /api/category-images/... for Docker/production compatibility
  const rewritten = merged.map(item => ({
    ...item,
    image: rewriteImagePath(item.image),
  }));

  return NextResponse.json({
    category,
    label: config.label,
    section: config.section,
    items: rewritten,
    overrideCount: Object.keys(overrides).length,
  });
}

/**
 * PUT - Update override for a single item
 * Body: { id: string, image?: string, description?: string }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = params;
  if (!CATEGORY_CONFIG[category]) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 });
  }

  const { id, image, description } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const overrides = await getCategoryOverrides(category);
  if (!overrides[id]) overrides[id] = {};
  if (image !== undefined) overrides[id].image = image;
  if (description !== undefined) overrides[id].description = description;

  // Clean empty overrides
  if (!overrides[id].image && !overrides[id].description) {
    delete overrides[id];
  }

  await saveCategoryOverrides(category, overrides);

  // Also invalidate movie style cache if this is movie-styles
  if (category === 'movie-styles') {
    try {
      const { invalidateMovieStyleCache } = await import('@/lib/movie-style-ref');
      invalidateMovieStyleCache();
    } catch { /* ok */ }
  }

  return NextResponse.json({ success: true, overrideCount: Object.keys(overrides).length });
}

/**
 * DELETE - Reset override for a single item
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = params;
  if (!CATEGORY_CONFIG[category]) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const overrides = await getCategoryOverrides(category);
  delete overrides[id];
  await saveCategoryOverrides(category, overrides);

  if (category === 'movie-styles') {
    try {
      const { invalidateMovieStyleCache } = await import('@/lib/movie-style-ref');
      invalidateMovieStyleCache();
    } catch { /* ok */ }
  }

  return NextResponse.json({ success: true });
}

/** Rewrite static /images/... paths to go through the dynamic API route */
function rewriteImagePath(img?: string): string | undefined {
  if (!img) return img;
  if (img.startsWith('/api/category-images/')) return img;
  if (img.startsWith('/images/')) {
    return '/api/category-images/' + img.slice('/images/'.length);
  }
  return img;
}

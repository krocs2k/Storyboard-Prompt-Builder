export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  CATEGORY_CONFIG,
  loadCategoryItems,
  getCategoryOverrides,
  mergeWithOverrides,
} from '@/lib/category-overrides';

/**
 * GET - Returns all categories with overrides merged.
 * Used by the prompt builder to display items with admin-customized images.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, any[]> = {};

  await Promise.all(
    Object.entries(CATEGORY_CONFIG).map(async ([key, config]) => {
      const items = await loadCategoryItems(key);
      const overrides = await getCategoryOverrides(key);
      const merged = mergeWithOverrides(items, overrides);
      // Rewrite /images/... paths to /api/category-images/... for Docker compatibility
      results[config.dataExport] = merged.map(item => ({
        ...item,
        image: rewriteImagePath(item.image),
      }));
    })
  );

  return NextResponse.json(results);
}

/** Rewrite static /images/... paths to go through the dynamic API route */
function rewriteImagePath(img?: string): string | undefined {
  if (!img) return img;
  // Already using the API route
  if (img.startsWith('/api/category-images/')) return img;
  // Rewrite /images/xxx to /api/category-images/xxx
  if (img.startsWith('/images/')) {
    return '/api/category-images/' + img.slice('/images/'.length);
  }
  return img;
}

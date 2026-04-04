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
      results[config.dataExport] = mergeWithOverrides(items, overrides);
    })
  );

  return NextResponse.json(results);
}

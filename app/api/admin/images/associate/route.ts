export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  CATEGORY_CONFIG,
  loadCategoryItems,
  getCategoryOverrides,
  saveCategoryOverrides,
  CategoryOverride,
} from '@/lib/category-overrides';
import { invalidateMovieStyleCache } from '@/lib/movie-style-ref';
import * as fs from 'fs';
import * as path from 'path';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

interface AssocMatch {
  styleId: string;
  styleName: string;
  currentImage: string;
  newImage: string;
  matchType: string;
}

interface CategoryAssocResult {
  category: string;
  label: string;
  totalItems: number;
  alreadyCorrect: number;
  toAssociate: AssocMatch[];
  noMatch: number;
}

const DATA_DIR_ASSOC = process.env.DATA_DIR || path.join(process.cwd(), 'data');

function computeAssociationsForCategory(
  items: Array<{ id: string; name: string; image?: string; description?: string }>,
  overrides: Record<string, CategoryOverride>,
  imageDir: string,
  categoryKey: string,
): { alreadyCorrect: number; toAssociate: AssocMatch[]; noMatch: number } {
  // Check both data/category-images/ and public/images/ for files
  const dataDirPath = path.join(DATA_DIR_ASSOC, 'category-images', imageDir);
  const publicDirPath = path.join(process.cwd(), 'public', 'images', imageDir);

  const fileMap = new Map<string, string>();

  // Collect from both directories (data takes priority)
  for (const dirPath of [publicDirPath, dataDirPath]) {
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext);
    });
    for (const f of files) {
      const base = path.basename(f, path.extname(f));
      fileMap.set(base, `/api/category-images/${imageDir}/${f}`);
    }
  }

  if (fileMap.size === 0) {
    return { alreadyCorrect: 0, toAssociate: [], noMatch: items.length };
  }

  const toAssociate: AssocMatch[] = [];
  let alreadyCorrect = 0;
  let noMatch = 0;
  const claimedFiles = new Set<string>();

  // Helper to check if an image file exists on disk
  function imageFileExists(imgPath: string): boolean {
    const clean = imgPath.split('?')[0];
    let rel = clean;
    if (rel.startsWith('/api/category-images/')) rel = rel.slice('/api/category-images/'.length);
    else if (rel.startsWith('/images/')) rel = rel.slice('/images/'.length);
    return (
      fs.existsSync(path.join(DATA_DIR_ASSOC, 'category-images', rel)) ||
      fs.existsSync(path.join(process.cwd(), 'public', 'images', rel))
    );
  }

  // Pass 1: items already using the correct image dir
  for (const item of items) {
    const effectiveImage = overrides[item.id]?.image || item.image;
    if (effectiveImage?.includes(`/${imageDir}/`)) {
      if (imageFileExists(effectiveImage)) {
        alreadyCorrect++;
        const base = path.basename(effectiveImage.split('?')[0], path.extname(effectiveImage.split('?')[0]));
        claimedFiles.add(base);
        continue;
      }
    }

    // Try exact ID match
    if (fileMap.has(item.id) && !claimedFiles.has(item.id)) {
      toAssociate.push({
        styleId: item.id,
        styleName: item.name,
        currentImage: effectiveImage || '',
        newImage: fileMap.get(item.id)!,
        matchType: 'exact-id',
      });
      claimedFiles.add(item.id);
      continue;
    }

    // Try slug-based matching
    const nameSlug = slugify(item.name);
    let matched = false;
    for (const [base, filePath] of fileMap.entries()) {
      if (claimedFiles.has(base)) continue;
      if (base === nameSlug || base === item.id ||
          nameSlug === base.replace(/-\d{4}$/, '') ||
          base.replace(/-\d{4}$/, '') === item.id ||
          base.startsWith(item.id + '-') ||
          base.replace(/_/g, '-') === item.id ||
          item.id.replace(/_/g, '-') === base ||
          nameSlug.startsWith(base + '-') || base.startsWith(nameSlug + '-') ||
          nameSlug.replace(/-/g, '_') === base || base.replace(/-/g, '_') === item.id) {
        toAssociate.push({
          styleId: item.id,
          styleName: item.name,
          currentImage: effectiveImage || '',
          newImage: filePath,
          matchType: 'slug-match',
        });
        claimedFiles.add(base);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Check if existing image file exists on disk
      if (effectiveImage && (effectiveImage.startsWith('/images/') || effectiveImage.startsWith('/api/category-images/'))) {
        if (imageFileExists(effectiveImage)) {
          alreadyCorrect++;
          continue;
        }
      } else if (effectiveImage?.startsWith('http')) {
        // External URL - counts as having an image
        alreadyCorrect++;
        continue;
      }
      noMatch++;
    }
  }

  return { alreadyCorrect, toAssociate, noMatch };
}

/**
 * GET: Preview associations for all categories (or one via ?category=xxx)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetCategory = request.nextUrl.searchParams.get('category');
  const results: CategoryAssocResult[] = [];

  const categoriesToProcess = targetCategory
    ? { [targetCategory]: CATEGORY_CONFIG[targetCategory] }
    : CATEGORY_CONFIG;

  for (const [key, config] of Object.entries(categoriesToProcess)) {
    if (!config) continue;
    const imageDir = config.imageDir;
    if (!imageDir) {
      // Categories without a dedicated image dir use /images/data/ with UUIDs
      // Can't auto-associate UUID files - skip but report stats
      const items = await loadCategoryItems(key);
      const overrides = await getCategoryOverrides(key);
      let correct = 0;
      for (const item of items) {
        const img = overrides[item.id]?.image || item.image;
        if (img) {
          if (img.startsWith('http')) { correct++; continue; }
          // Check both data/category-images and public/images
          let rel = img.split('?')[0];
          if (rel.startsWith('/api/category-images/')) rel = rel.slice('/api/category-images/'.length);
          else if (rel.startsWith('/images/')) rel = rel.slice('/images/'.length);
          if (
            fs.existsSync(path.join(DATA_DIR_ASSOC, 'category-images', rel)) ||
            fs.existsSync(path.join(process.cwd(), 'public', 'images', rel))
          ) { correct++; continue; }
        }
      }
      results.push({
        category: key,
        label: config.label,
        totalItems: items.length,
        alreadyCorrect: correct,
        toAssociate: [],
        noMatch: items.length - correct,
      });
      continue;
    }

    const items = await loadCategoryItems(key);
    const overrides = await getCategoryOverrides(key);
    const assoc = computeAssociationsForCategory(items, overrides, imageDir, key);

    results.push({
      category: key,
      label: config.label,
      totalItems: items.length,
      alreadyCorrect: assoc.alreadyCorrect,
      toAssociate: assoc.toAssociate,
      noMatch: assoc.noMatch,
    });
  }

  const totalToAssociate = results.reduce((a, r) => a + r.toAssociate.length, 0);

  return NextResponse.json({
    results,
    summary: {
      totalCategories: results.length,
      totalToAssociate,
      totalAlreadyCorrect: results.reduce((a, r) => a + r.alreadyCorrect, 0),
      totalNoMatch: results.reduce((a, r) => a + r.noMatch, 0),
    },
  });
}

/**
 * POST: Apply associations for all categories (or one via ?category=xxx)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetCategory = request.nextUrl.searchParams.get('category');
  const categoriesToProcess = targetCategory
    ? { [targetCategory]: CATEGORY_CONFIG[targetCategory] }
    : CATEGORY_CONFIG;

  let totalAssociated = 0;
  const categoryResults: Array<{ category: string; associated: number }> = [];

  for (const [key, config] of Object.entries(categoriesToProcess)) {
    if (!config || !config.imageDir) continue;

    const items = await loadCategoryItems(key);
    const overrides = await getCategoryOverrides(key);
    const assoc = computeAssociationsForCategory(items, overrides, config.imageDir, key);

    if (assoc.toAssociate.length === 0) {
      categoryResults.push({ category: key, associated: 0 });
      continue;
    }

    for (const match of assoc.toAssociate) {
      if (!overrides[match.styleId]) overrides[match.styleId] = {};
      overrides[match.styleId].image = match.newImage;
    }

    await saveCategoryOverrides(key, overrides);
    totalAssociated += assoc.toAssociate.length;
    categoryResults.push({ category: key, associated: assoc.toAssociate.length });
  }

  // Invalidate movie style cache if it was touched
  if (!targetCategory || targetCategory === 'movie-styles') {
    try { invalidateMovieStyleCache(); } catch { /* ok */ }
  }

  return NextResponse.json({
    message: `Associated ${totalAssociated} items across ${categoryResults.filter(r => r.associated > 0).length} categories`,
    totalAssociated,
    categoryResults,
  });
}

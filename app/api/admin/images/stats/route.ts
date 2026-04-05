export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively count image files and their total size.
 */
function countImages(dir: string): { fileCount: number; totalSize: number } {
  let fileCount = 0;
  let totalSize = 0;
  if (!fs.existsSync(dir)) return { fileCount, totalSize };

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countImages(fullPath);
      fileCount += sub.fileCount;
      totalSize += sub.totalSize;
    } else if (entry.isFile()) {
      const ext = entry.name.toLowerCase().split('.').pop();
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff'].includes(ext || '')) {
        fileCount++;
        totalSize += fs.statSync(fullPath).size;
      }
    }
  }
  return { fileCount, totalSize };
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CATEGORY_IMAGES_DIR = path.join(DATA_DIR, 'category-images');

/**
 * Check if a local image path exists on disk (checks data/category-images first, then public/images).
 */
function localImageExists(imagePath: string): boolean {
  const cleanImage = imagePath.split('?')[0];
  let relPath = cleanImage;
  if (relPath.startsWith('/api/category-images/')) relPath = relPath.slice('/api/category-images/'.length);
  else if (relPath.startsWith('/images/')) relPath = relPath.slice('/images/'.length);

  return (
    fs.existsSync(path.join(CATEGORY_IMAGES_DIR, relPath)) ||
    fs.existsSync(path.join(process.cwd(), 'public', 'images', relPath))
  );
}

/**
 * Count how many items in a data category have local images that exist on disk.
 */
function countCategoryImages(items: Array<{ id: string; name: string; image?: string }>): { total: number; withImage: number; localFound: number; missing: number; externalCount: number } {
  let withImage = 0, localFound = 0, missing = 0, externalCount = 0;
  for (const item of items) {
    if (!item.image) continue;
    withImage++;
    if (item.image.startsWith('/images/') || item.image.startsWith('/api/category-images/')) {
      if (localImageExists(item.image)) {
        localFound++;
      } else {
        missing++;
      }
    } else if (item.image.startsWith('http')) {
      externalCount++;
    }
  }
  return { total: items.length, withImage, localFound, missing, externalCount };
}

/**
 * GET - Return stats about all images in public/images/ and per-category breakdown
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const publicImagesDir = path.join(process.cwd(), 'public', 'images');

  // Count images from both locations
  const publicStats = countImages(publicImagesDir);
  const dataStats = countImages(CATEGORY_IMAGES_DIR);
  const fileCount = publicStats.fileCount + dataStats.fileCount;
  const totalSize = publicStats.totalSize + dataStats.totalSize;

  // Per-category stats
  const { imageTypes } = await import('@/lib/data/image-types');
  const { shotTypes } = await import('@/lib/data/shot-types');
  const { lightingSources } = await import('@/lib/data/lighting-sources');
  const { cameraBodies } = await import('@/lib/data/camera-bodies');
  const { focalLengths } = await import('@/lib/data/focal-lengths');
  const { lensTypes } = await import('@/lib/data/lens-types');
  const { filmStocks } = await import('@/lib/data/film-stocks');
  const { photographerStyles } = await import('@/lib/data/photographer-styles');
  const { movieStyles } = await import('@/lib/data/movie-styles');
  const { filterEffects } = await import('@/lib/data/filter-effects');

  const categories: Record<string, { label: string; section: string; stats: ReturnType<typeof countCategoryImages> }> = {
    'image-types': { label: 'Image Types', section: 'Section 1', stats: countCategoryImages(imageTypes) },
    'shot-types': { label: 'Shot Types', section: 'Section 2', stats: countCategoryImages(shotTypes) },
    'lighting-sources': { label: 'Lighting Sources', section: 'Section 3', stats: countCategoryImages(lightingSources) },
    'camera-bodies': { label: 'Camera Bodies', section: 'Section 4', stats: countCategoryImages(cameraBodies) },
    'focal-lengths': { label: 'Focal Lengths', section: 'Section 4', stats: countCategoryImages(focalLengths as any) },
    'lens-types': { label: 'Lens Types', section: 'Section 4', stats: countCategoryImages(lensTypes) },
    'film-stocks': { label: 'Film Stocks', section: 'Section 4', stats: countCategoryImages(filmStocks) },
    'photographer-styles': { label: 'Photographer Styles', section: 'Section 5', stats: countCategoryImages(photographerStyles) },
    'movie-styles': { label: 'Movie Styles', section: 'Section 1', stats: countCategoryImages(movieStyles) },
    'filter-effects': { label: 'Filter Effects', section: 'Section 5', stats: countCategoryImages(filterEffects as any) },
  };

  // Subdirectory stats (from both directories)
  const subdirs: Record<string, { fileCount: number; sizeMB: number }> = {};
  for (const dir of [publicImagesDir, CATEGORY_IMAGES_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const sub = countImages(path.join(dir, entry.name));
        const existing = subdirs[entry.name];
        if (existing) {
          existing.fileCount += sub.fileCount;
          existing.sizeMB = Math.round(((existing.sizeMB * 1024 * 1024 + sub.totalSize) / (1024 * 1024)) * 10) / 10;
        } else {
          subdirs[entry.name] = { fileCount: sub.fileCount, sizeMB: Math.round((sub.totalSize / (1024 * 1024)) * 10) / 10 };
        }
      }
    }
  }

  return NextResponse.json({
    fileCount,
    totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 10) / 10,
    categories,
    subdirs,
  });
}

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

/**
 * Count how many items in a data category have local images that exist on disk.
 */
function countCategoryImages(items: Array<{ id: string; name: string; image?: string }>, imagesRoot: string): { total: number; withImage: number; localFound: number; missing: number; externalCount: number } {
  let withImage = 0, localFound = 0, missing = 0, externalCount = 0;
  for (const item of items) {
    if (!item.image) continue;
    withImage++;
    if (item.image.startsWith('/images/')) {
      const filePath = path.join(imagesRoot, '..', item.image);
      if (fs.existsSync(filePath)) {
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

  const publicDir = path.join(process.cwd(), 'public');
  const imagesDir = path.join(publicDir, 'images');
  const { fileCount, totalSize } = countImages(imagesDir);

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
    'image-types': { label: 'Image Types', section: 'Section 1', stats: countCategoryImages(imageTypes, imagesDir) },
    'shot-types': { label: 'Shot Types', section: 'Section 2', stats: countCategoryImages(shotTypes, imagesDir) },
    'lighting-sources': { label: 'Lighting Sources', section: 'Section 3', stats: countCategoryImages(lightingSources, imagesDir) },
    'camera-bodies': { label: 'Camera Bodies', section: 'Section 4', stats: countCategoryImages(cameraBodies, imagesDir) },
    'focal-lengths': { label: 'Focal Lengths', section: 'Section 4', stats: countCategoryImages(focalLengths as any, imagesDir) },
    'lens-types': { label: 'Lens Types', section: 'Section 4', stats: countCategoryImages(lensTypes, imagesDir) },
    'film-stocks': { label: 'Film Stocks', section: 'Section 4', stats: countCategoryImages(filmStocks, imagesDir) },
    'photographer-styles': { label: 'Photographer Styles', section: 'Section 5', stats: countCategoryImages(photographerStyles, imagesDir) },
    'movie-styles': { label: 'Movie Styles', section: 'Section 1', stats: countCategoryImages(movieStyles, imagesDir) },
    'filter-effects': { label: 'Filter Effects', section: 'Section 5', stats: countCategoryImages(filterEffects as any, imagesDir) },
  };

  // Subdirectory stats
  const subdirs: Record<string, { fileCount: number; sizeMB: number }> = {};
  if (fs.existsSync(imagesDir)) {
    for (const entry of fs.readdirSync(imagesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const sub = countImages(path.join(imagesDir, entry.name));
        subdirs[entry.name] = { fileCount: sub.fileCount, sizeMB: Math.round((sub.totalSize / (1024 * 1024)) * 10) / 10 };
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

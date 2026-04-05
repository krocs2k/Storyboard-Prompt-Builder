export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

/**
 * GET - Export ALL images under public/images/ as a ZIP file.
 * Includes all subdirectories (data, movie-styles, photographer-styles, filter-effects, etc.)
 * and a manifest mapping category→id→filename for data file references.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const categoryImagesDir = path.join(DATA_DIR, 'category-images');
  const publicImagesDir = path.join(process.cwd(), 'public', 'images');

  // Use data/category-images/ as primary, fall back to public/images/
  const imagesRoot = fs.existsSync(categoryImagesDir) ? categoryImagesDir
    : fs.existsSync(publicImagesDir) ? publicImagesDir : null;

  if (!imagesRoot) {
    return NextResponse.json({ error: 'No images directory found' }, { status: 404 });
  }

  // Build manifest from data files
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

  type DataItem = { id: string; name: string; image?: string };
  const categories: Record<string, DataItem[]> = {
    'image-types': imageTypes,
    'shot-types': shotTypes,
    'lighting-sources': lightingSources,
    'camera-bodies': cameraBodies,
    'focal-lengths': focalLengths,
    'lens-types': lensTypes,
    'film-stocks': filmStocks,
    'photographer-styles': photographerStyles,
    'movie-styles': movieStyles,
    'filter-effects': filterEffects,
  };

  // Build manifest: all local images (starting with /images/)
  const manifest: Record<string, Array<{ id: string; name: string; imagePath: string }>> = {};

  for (const [cat, items] of Object.entries(categories)) {
    manifest[cat] = [];
    for (const item of items) {
      if (item.image && item.image.startsWith('/images/')) {
        manifest[cat].push({ id: item.id, name: item.name, imagePath: item.image });
      }
    }
  }

  // Recursively collect all files under public/images/
  function collectFiles(dir: string, relativeTo: string): Array<{ fullPath: string; zipPath: string }> {
    const results: Array<{ fullPath: string; zipPath: string }> = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(relativeTo, fullPath);
      if (entry.isDirectory()) {
        results.push(...collectFiles(fullPath, relativeTo));
      } else if (entry.isFile()) {
        results.push({ fullPath, zipPath: relPath });
      }
    }
    return results;
  }

  const allImageFiles = collectFiles(imagesRoot, imagesRoot);

  // Create ZIP archive
  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', resolve);
    archive.on('error', reject);

    // Add manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add ALL image files, preserving subdirectory structure
    for (const { fullPath, zipPath } of allImageFiles) {
      archive.file(fullPath, { name: `images/${zipPath}` });
    }

    archive.finalize();
  });

  const zipBuffer = Buffer.concat(chunks);

  return new Response(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="storyshot-images-${new Date().toISOString().slice(0, 10)}.zip"`,
      'Content-Length': String(zipBuffer.length),
    },
  });
}

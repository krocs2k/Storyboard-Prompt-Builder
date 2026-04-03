export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

/**
 * POST - Resize all images in public/images/data/ to optimized thumbnails.
 * Converts to WebP format at the target size (default 384x384).
 * Preserves original filenames but changes extension to the same (overwrites in-place).
 * Returns progress info for the worker UI.
 *
 * Query params:
 *   - size: target dimension (default 384)
 *   - quality: WebP quality 1-100 (default 80)
 *   - dryRun: if "true", only returns stats without modifying files
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const targetSize = parseInt(url.searchParams.get('size') || '384', 10);
  const quality = parseInt(url.searchParams.get('quality') || '80', 10);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  const imagesDir = path.join(process.cwd(), 'public', 'images', 'data');

  if (!fs.existsSync(imagesDir)) {
    return NextResponse.json({ error: 'No images directory found' }, { status: 404 });
  }

  const files = fs.readdirSync(imagesDir).filter(f => {
    const ext = f.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff'].includes(ext || '');
  });

  if (files.length === 0) {
    return NextResponse.json({ error: 'No image files found' }, { status: 404 });
  }

  // Analyze current state
  let totalOriginalSize = 0;
  let alreadyOptimized = 0;
  const filesToProcess: Array<{ name: string; size: number; width: number; height: number }> = [];

  for (const file of files) {
    const fullPath = path.join(imagesDir, file);
    const stat = fs.statSync(fullPath);
    totalOriginalSize += stat.size;

    try {
      const meta = await sharp(fullPath).metadata();
      const w = meta.width || 0;
      const h = meta.height || 0;

      // Skip if already at or below target size
      if (w <= targetSize && h <= targetSize) {
        alreadyOptimized++;
      } else {
        filesToProcess.push({ name: file, size: stat.size, width: w, height: h });
      }
    } catch {
      // Skip files that can't be read by sharp
      console.warn(`Skipping unreadable file: ${file}`);
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalFiles: files.length,
      alreadyOptimized,
      toProcess: filesToProcess.length,
      currentSizeMB: Math.round((totalOriginalSize / (1024 * 1024)) * 10) / 10,
      targetSize,
      quality,
    });
  }

  // Process files
  let processed = 0;
  let failed = 0;
  let savedBytes = 0;
  const errors: string[] = [];

  for (const fileInfo of filesToProcess) {
    const fullPath = path.join(imagesDir, fileInfo.name);
    const ext = fileInfo.name.toLowerCase().split('.').pop() || 'png';

    try {
      const inputBuffer = fs.readFileSync(fullPath);
      const originalSize = inputBuffer.length;

      let outputBuffer: Buffer;

      // Resize and re-encode in the same format to preserve filename references
      const resized = sharp(inputBuffer)
        .resize(targetSize, targetSize, {
          fit: 'cover',
          position: 'center',
        });

      if (ext === 'jpg' || ext === 'jpeg') {
        outputBuffer = await resized.jpeg({ quality, mozjpeg: true }).toBuffer();
      } else if (ext === 'webp') {
        outputBuffer = await resized.webp({ quality }).toBuffer();
      } else {
        // PNG — convert to high-quality PNG with compression
        outputBuffer = await resized.png({ compressionLevel: 9, palette: false }).toBuffer();
      }

      fs.writeFileSync(fullPath, outputBuffer);
      savedBytes += originalSize - outputBuffer.length;
      processed++;
    } catch (err) {
      failed++;
      errors.push(`${fileInfo.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Calculate new total size
  let newTotalSize = 0;
  for (const file of files) {
    const fullPath = path.join(imagesDir, file);
    if (fs.existsSync(fullPath)) {
      newTotalSize += fs.statSync(fullPath).size;
    }
  }

  return NextResponse.json({
    success: true,
    totalFiles: files.length,
    alreadyOptimized,
    processed,
    failed,
    savedMB: Math.round((savedBytes / (1024 * 1024)) * 10) / 10,
    originalSizeMB: Math.round((totalOriginalSize / (1024 * 1024)) * 10) / 10,
    newSizeMB: Math.round((newTotalSize / (1024 * 1024)) * 10) / 10,
    targetSize,
    quality,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
}

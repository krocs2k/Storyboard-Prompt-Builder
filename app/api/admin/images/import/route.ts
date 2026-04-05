export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { invalidateAllCategoryCaches } from '@/lib/category-overrides';
import { invalidateMovieStyleCache } from '@/lib/movie-style-ref';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const THUMB_SIZE = 384;
const THUMB_QUALITY = 80;

/**
 * POST - Import images in batches.
 * 
 * The client extracts the ZIP in the browser (using JSZip) and uploads
 * files in small batches to avoid proxy body-size limits (~4 MB per request).
 * 
 * FormData fields:
 *   - files[]        : one or more image File objects
 *   - paths[]        : matching relative paths (e.g. "data/lens-types/image.jpg")
 *   - action         : "init" (first batch — clears target dirs) or "append" (subsequent)
 *   - subdirs        : comma-separated list of subdirs to clear on "init" (e.g. "data,movie-styles")
 *   - overrides      : (optional, init batch only) JSON string of overrides.json from export ZIP
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const action = (formData.get('action') as string) || 'init';
    const subdirsCsv = (formData.get('subdirs') as string) || '';
    const files = formData.getAll('files[]') as File[];
    const paths = formData.getAll('paths[]') as string[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files in batch' }, { status: 400 });
    }
    if (files.length !== paths.length) {
      return NextResponse.json({ error: 'files[] and paths[] count mismatch' }, { status: 400 });
    }

    const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const imagesRoot = path.join(DATA_DIR, 'category-images');

    // On "init" batch, clear target subdirectories and apply DB overrides
    let overridesApplied = 0;
    if (action === 'init') {
      // Clear target subdirectories
      if (subdirsCsv) {
        const subdirs = subdirsCsv.split(',').map(s => s.trim()).filter(Boolean);
        for (const subdir of subdirs) {
          // Prevent path traversal
          if (subdir.includes('..') || subdir.startsWith('/')) continue;
          const subdirPath = path.join(imagesRoot, subdir);
          if (fs.existsSync(subdirPath)) {
            const existing = fs.readdirSync(subdirPath);
            for (const f of existing) {
              const fullPath = path.join(subdirPath, f);
              try {
                if (fs.statSync(fullPath).isFile()) fs.unlinkSync(fullPath);
              } catch { /* skip */ }
            }
          }
        }
      }

      // Apply overrides from export ZIP (syncs the "image database")
      const overridesJson = formData.get('overrides') as string | null;
      if (overridesJson) {
        try {
          const overridesData: Record<string, any> = JSON.parse(overridesJson);
          for (const [key, value] of Object.entries(overridesData)) {
            const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
            await prisma.systemConfig.upsert({
              where: { key },
              create: { key, value: valueStr },
              update: { value: valueStr },
            });
            overridesApplied++;
          }
          // Invalidate all caches so the app picks up new overrides immediately
          invalidateAllCategoryCaches();
          try { invalidateMovieStyleCache(); } catch { /* ok */ }
        } catch (e) {
          console.error('Failed to apply overrides:', e);
        }
      }
    }

    // Write each file, auto-resizing if oversized
    let imported = 0;
    let resized = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let relativePath = paths[i];

      // Prevent path traversal
      if (relativePath.includes('..')) continue;

      const destPath = path.join(imagesRoot, relativePath);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = relativePath.toLowerCase().split('.').pop() || '';

      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff'].includes(ext)) {
        try {
          const meta = await sharp(buffer).metadata();
          const w = meta.width || 0;
          const h = meta.height || 0;

          if (w > THUMB_SIZE || h > THUMB_SIZE) {
            const resizedSharp = sharp(buffer).resize(THUMB_SIZE, THUMB_SIZE, {
              fit: 'cover',
              position: 'center',
            });

            let output: Buffer;
            if (ext === 'jpg' || ext === 'jpeg') {
              output = await resizedSharp.jpeg({ quality: THUMB_QUALITY, mozjpeg: true }).toBuffer();
            } else if (ext === 'webp') {
              output = await resizedSharp.webp({ quality: THUMB_QUALITY }).toBuffer();
            } else {
              output = await resizedSharp.png({ compressionLevel: 9 }).toBuffer();
            }

            fs.writeFileSync(destPath, output);
            resized++;
          } else {
            fs.writeFileSync(destPath, buffer);
          }
        } catch {
          fs.writeFileSync(destPath, buffer);
        }
      } else {
        fs.writeFileSync(destPath, buffer);
      }
      imported++;
    }

    return NextResponse.json({ success: true, imported, resized, overridesApplied });
  } catch (err) {
    console.error('Image import batch failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}

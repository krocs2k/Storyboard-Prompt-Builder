export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import sharp from 'sharp';

const THUMB_SIZE = 384;
const THUMB_QUALITY = 80;

/**
 * POST - Import images from an uploaded ZIP file.
 * Expects a ZIP with:
 *   - images/<subdir>/<filename> — image files in subdirectories (data/, movie-styles/, etc.)
 *   - images/<filename> — legacy flat structure (imported to data/ subfolder)
 *   - manifest.json (optional) — mapping of category→items (informational)
 * All existing files in public/images/ subdirectories are replaced
 * with the contents of the ZIP images/ folder.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a ZIP archive' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find all image files in the ZIP (in images/ folder, preserving subdirs)
    const imageFiles: Array<{ relativePath: string; file: JSZip.JSZipObject }> = [];
    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      if (relativePath === 'manifest.json') return;
      // Accept files under images/ prefix
      if (relativePath.startsWith('images/')) {
        const subPath = relativePath.slice('images/'.length);
        if (subPath) {
          imageFiles.push({ relativePath: subPath, file: zipEntry });
        }
      }
    });

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: 'No image files found in ZIP. Expected files in an "images/" folder.' },
        { status: 400 }
      );
    }

    const imagesRoot = path.join(process.cwd(), 'public', 'images');

    // Determine which subdirectories are in the ZIP
    const subdirsInZip = new Set<string>();
    for (const { relativePath } of imageFiles) {
      const parts = relativePath.split('/');
      if (parts.length > 1) {
        subdirsInZip.add(parts[0]);
      }
    }

    // If the ZIP has subdirectories, clear those specific subdirectories
    // If it's a flat structure (legacy), clear the data/ directory
    if (subdirsInZip.size > 0) {
      for (const subdir of subdirsInZip) {
        const subdirPath = path.join(imagesRoot, subdir);
        if (fs.existsSync(subdirPath)) {
          const existing = fs.readdirSync(subdirPath);
          for (const f of existing) {
            const fullPath = path.join(subdirPath, f);
            if (fs.statSync(fullPath).isFile()) {
              fs.unlinkSync(fullPath);
            }
          }
        }
      }
    } else {
      // Legacy flat ZIP — clear data/ directory
      const dataDir = path.join(imagesRoot, 'data');
      if (fs.existsSync(dataDir)) {
        const existing = fs.readdirSync(dataDir);
        for (const f of existing) {
          const fullPath = path.join(dataDir, f);
          if (fs.statSync(fullPath).isFile()) {
            fs.unlinkSync(fullPath);
          }
        }
      }
    }

    // Extract and auto-resize images
    let imported = 0;
    let resized = 0;
    for (const { relativePath, file: zipEntry } of imageFiles) {
      const buffer = await zipEntry.async('nodebuffer');
      const ext = relativePath.toLowerCase().split('.').pop() || '';

      // For flat ZIPs (no subdirs), place in data/
      let destRelative = relativePath;
      if (subdirsInZip.size === 0 && !relativePath.includes('/')) {
        destRelative = `data/${relativePath}`;
      }

      const destPath = path.join(imagesRoot, destRelative);

      // Ensure parent directory exists
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Auto-resize oversized images
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
          // If resize fails, write original
          fs.writeFileSync(destPath, buffer);
        }
      } else {
        fs.writeFileSync(destPath, buffer);
      }
      imported++;
    }

    const subdirList = subdirsInZip.size > 0 ? ` across ${subdirsInZip.size} directories (${[...subdirsInZip].join(', ')})` : '';
    return NextResponse.json({
      success: true,
      imported,
      resized,
      message: `Successfully imported ${imported} images${subdirList} (${resized} auto-resized to ${THUMB_SIZE}×${THUMB_SIZE}). They are now active in the system.`,
    });
  } catch (err) {
    console.error('Image import failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}

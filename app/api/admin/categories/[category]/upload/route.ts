export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CATEGORY_CONFIG } from '@/lib/category-overrides';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const TARGET_DIMENSION = 1024;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CATEGORY_IMAGES_DIR = path.join(DATA_DIR, 'category-images');

interface Params {
  params: { category: string };
}

/**
 * POST - Upload an image file for a category item
 * Accepts: multipart form with 'file' and 'itemId'
 * OR JSON with 'url' and 'itemId' (download from URL)
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = params;
  const config = CATEGORY_CONFIG[category];
  if (!config) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 });
  }

  // Determine target directory — save to persistent data volume
  const subdir = config.imageDir || 'data';
  const targetDir = path.join(CATEGORY_IMAGES_DIR, subdir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    // File upload
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const itemId = formData.get('itemId') as string;

    if (!file || !itemId) {
      return NextResponse.json({ error: 'file and itemId required' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const slug = itemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const filename = `${slug}.${ext}`;
    const filePath = path.join(targetDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());

    // Auto-resize if larger than target
    try {
      const metadata = await sharp(buffer).metadata();
      if (metadata.width && metadata.height && (metadata.width > TARGET_DIMENSION || metadata.height > TARGET_DIMENSION)) {
        const resized = await sharp(buffer)
          .resize(TARGET_DIMENSION, TARGET_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        fs.writeFileSync(filePath, resized);
      } else {
        fs.writeFileSync(filePath, buffer);
      }
    } catch {
      fs.writeFileSync(filePath, buffer);
    }

    return NextResponse.json({ path: `/api/category-images/${subdir}/${filename}?v=${Date.now()}` });
  } else {
    // JSON URL download
    const { url, itemId } = await request.json();
    if (!url || !itemId) {
      return NextResponse.json({ error: 'url and itemId required' }, { status: 400 });
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error('Failed to fetch image');
      const contentType = res.headers.get('content-type') || '';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const slug = itemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      const filename = `${slug}.${ext}`;
      const filePath = path.join(targetDir, filename);

      const buffer = Buffer.from(await res.arrayBuffer());
      
      try {
        const metadata = await sharp(buffer).metadata();
        if (metadata.width && metadata.height && (metadata.width > TARGET_DIMENSION || metadata.height > TARGET_DIMENSION)) {
          const resized = await sharp(buffer)
            .resize(TARGET_DIMENSION, TARGET_DIMENSION, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
          fs.writeFileSync(filePath, resized);
        } else {
          fs.writeFileSync(filePath, buffer);
        }
      } catch {
        fs.writeFileSync(filePath, buffer);
      }

      return NextResponse.json({ path: `/api/category-images/${subdir}/${filename}?v=${Date.now()}` });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Download failed' }, { status: 500 });
    }
  }
}

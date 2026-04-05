export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const STYLES_DIR = path.join(process.cwd(), 'public', 'images', 'movie-styles');

function ensureDir() {
  if (!fs.existsSync(STYLES_DIR)) {
    fs.mkdirSync(STYLES_DIR, { recursive: true });
  }
}

function getExtension(contentType: string, url?: string): string {
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  // Try to get extension from URL
  if (url) {
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return ext;
  }
  return '.jpg';
}

/**
 * POST - Upload a movie style image (file upload or URL download)
 * Returns the local path to the saved image.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const styleId = formData.get('styleId') as string | null;

      if (!file || !styleId) {
        return NextResponse.json({ error: 'file and styleId are required' }, { status: 400 });
      }

      ensureDir();
      const ext = getExtension(file.type);
      const filename = `${styleId}${ext}`;
      const filePath = path.join(STYLES_DIR, filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const localPath = `/images/movie-styles/${filename}?v=${Date.now()}`;
      return NextResponse.json({ success: true, path: localPath });
    } else {
      // Handle URL download
      const { url, styleId } = await req.json();

      if (!url || !styleId) {
        return NextResponse.json({ error: 'url and styleId are required' }, { status: 400 });
      }

      // If it's already a local path, just return it
      if (url.startsWith('/images/')) {
        return NextResponse.json({ success: true, path: url });
      }

      // Download the image
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return NextResponse.json({ error: `Failed to download image: HTTP ${response.status}` }, { status: 400 });
      }

      const imageContentType = response.headers.get('content-type') || 'image/jpeg';
      if (!imageContentType.startsWith('image/')) {
        return NextResponse.json({ error: 'URL does not point to an image' }, { status: 400 });
      }

      ensureDir();
      const ext = getExtension(imageContentType, url);
      const filename = `${styleId}${ext}`;
      const filePath = path.join(STYLES_DIR, filename);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

      const localPath = `/images/movie-styles/${filename}?v=${Date.now()}`;
      return NextResponse.json({ success: true, path: localPath });
    }
  } catch (err) {
    console.error('Movie style image upload failed:', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

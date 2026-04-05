export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CATEGORY_IMAGES_DIR = path.join(DATA_DIR, 'category-images');
const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'public', 'images');

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/**
 * GET /api/category-images/{subdir}/{filename}
 * Serves category images from the persistent data volume first,
 * falling back to public/images/ for dev/Abacus environments.
 * No auth required — these are public visual assets.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const segments = params.path;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  // Security: prevent path traversal
  const joined = segments.join('/');
  if (joined.includes('..') || segments.some(s => s.startsWith('.'))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Strip query-param artifacts from the last segment (e.g., "file.jpg?v=123" → "file.jpg")
  const cleanSegments = [...segments];
  const lastIdx = cleanSegments.length - 1;
  cleanSegments[lastIdx] = cleanSegments[lastIdx].split('?')[0];

  const relativePath = cleanSegments.join(path.sep);

  // 1. Try persistent data volume first (Docker / admin uploads)
  const dataPath = path.join(CATEGORY_IMAGES_DIR, relativePath);
  if (fs.existsSync(dataPath)) {
    return serveFile(dataPath);
  }

  // 2. Fallback to public/images/ (dev environment / Abacus deployment)
  const publicPath = path.join(PUBLIC_IMAGES_DIR, relativePath);
  if (fs.existsSync(publicPath)) {
    return serveFile(publicPath);
  }

  return new NextResponse(null, { status: 404 });
}

function serveFile(filePath: string): NextResponse {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}

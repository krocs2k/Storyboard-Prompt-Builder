export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/**
 * Build a list of candidate directories where images might live.
 * In development, process.cwd()/public/images works.
 * In production standalone mode, the working directory may differ,
 * so we check multiple paths to ensure we find the files.
 */
function getImageSearchPaths(): string[] {
  const cwd = process.cwd();
  const dataDir = process.env.DATA_DIR || path.join(cwd, 'data');

  const candidates: string[] = [
    // 1. Persistent data volume (Docker / admin uploads)
    path.join(dataDir, 'category-images'),
    // 2. Standard dev: cwd/public/images
    path.join(cwd, 'public', 'images'),
    // 3. Standalone build: cwd/app/public/images (if cwd is the standalone root)
    path.join(cwd, 'app', 'public', 'images'),
    // 4. Relative to this file's __dirname (compiled route location)
    path.resolve(__dirname, '..', '..', '..', '..', 'public', 'images'),
    path.resolve(__dirname, '..', '..', '..', 'public', 'images'),
    // 5. Standalone: .build output location
    path.join(cwd, '.build', 'standalone', 'app', 'public', 'images'),
  ];

  return candidates;
}

// Cache resolved base path to avoid re-scanning on every request
let _resolvedBasePaths: string[] | null = null;

function getResolvedBasePaths(): string[] {
  if (_resolvedBasePaths) return _resolvedBasePaths;
  const candidates = getImageSearchPaths();
  _resolvedBasePaths = candidates.filter(p => {
    try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); } catch { return false; }
  });
  if (_resolvedBasePaths.length === 0) {
    console.warn('[category-images] No image directories found. Searched:', candidates);
    _resolvedBasePaths = candidates; // Still try them at request time
  } else {
    console.log('[category-images] Resolved image dirs:', _resolvedBasePaths);
  }
  return _resolvedBasePaths;
}

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

  // Search through all candidate paths
  const basePaths = getResolvedBasePaths();
  for (const base of basePaths) {
    const fullPath = path.join(base, relativePath);
    try {
      if (fs.existsSync(fullPath)) {
        return serveFile(fullPath);
      }
    } catch { /* skip */ }
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

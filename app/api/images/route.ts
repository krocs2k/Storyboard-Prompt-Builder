export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readImage, imageExists, imageCdnUrl } from '@/lib/image-storage';

/**
 * GET - Serve an image from local storage, or redirect to BunnyCDN when configured.
 * Usage: /api/images?path=images/projectId/block_001.png
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const imagePath = req.nextUrl.searchParams.get('path');
  if (!imagePath) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
  }

  // Security: prevent path traversal
  if (imagePath.includes('..') || imagePath.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Prefer serving from local disk (legacy / self-hosted volume).
  if (imageExists(imagePath)) {
    const buffer = await readImage(imagePath);
    if (buffer) {
      const ext = imagePath.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      return new NextResponse(buffer as any, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
  }

  // Not on disk: if BunnyCDN is configured, redirect to the global CDN URL.
  const cdn = await imageCdnUrl(imagePath);
  if (cdn) {
    return NextResponse.redirect(cdn, 302);
  }

  // Last resort: try reading bytes from Bunny directly.
  const buffer = await readImage(imagePath);
  if (buffer) {
    const ext = imagePath.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  return NextResponse.json({ error: 'Image not found' }, { status: 404 });
}

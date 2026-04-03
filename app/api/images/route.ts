export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readImage } from '@/lib/image-storage';

/**
 * GET - Serve an image from local storage
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

  const buffer = readImage(imagePath);
  if (!buffer) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const ext = imagePath.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

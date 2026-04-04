export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively count image files and their total size.
 */
function countImages(dir: string): { fileCount: number; totalSize: number } {
  let fileCount = 0;
  let totalSize = 0;
  if (!fs.existsSync(dir)) return { fileCount, totalSize };

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countImages(fullPath);
      fileCount += sub.fileCount;
      totalSize += sub.totalSize;
    } else if (entry.isFile()) {
      const ext = entry.name.toLowerCase().split('.').pop();
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff'].includes(ext || '')) {
        fileCount++;
        totalSize += fs.statSync(fullPath).size;
      }
    }
  }
  return { fileCount, totalSize };
}

/**
 * GET - Return stats about all images in public/images/ and subdirectories
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const imagesDir = path.join(process.cwd(), 'public', 'images');
  const { fileCount, totalSize } = countImages(imagesDir);

  return NextResponse.json({
    fileCount,
    totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 10) / 10,
  });
}

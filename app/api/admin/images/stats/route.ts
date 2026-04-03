export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GET - Return stats about the current images in public/images/data/
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const imagesDir = path.join(process.cwd(), 'public', 'images', 'data');

  if (!fs.existsSync(imagesDir)) {
    return NextResponse.json({ fileCount: 0, totalSizeMB: 0 });
  }

  const files = fs.readdirSync(imagesDir);
  let totalSize = 0;
  let fileCount = 0;

  for (const f of files) {
    const fullPath = path.join(imagesDir, f);
    const s = fs.statSync(fullPath);
    if (s.isFile()) {
      totalSize += s.size;
      fileCount++;
    }
  }

  return NextResponse.json({
    fileCount,
    totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 10) / 10,
  });
}

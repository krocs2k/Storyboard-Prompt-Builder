export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const POOL_BASE = path.join(DATA_DIR, 'category-images', 'pool');

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string;
    const label = (formData.get('label') as string) || '';

    if (!file || !projectId) {
      return NextResponse.json({ error: 'file and projectId required' }, { status: 400 });
    }

    const targetDir = path.join(POOL_BASE, projectId);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const filename = `${randomUUID()}.${ext}`;
    const filePath = path.join(targetDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    let width = 0, height = 0, aspectRatio = '16:9';
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width || 0;
      height = meta.height || 0;
      if (width && height) {
        const r = width / height;
        if (Math.abs(r - 16 / 9) < 0.05) aspectRatio = '16:9';
        else if (Math.abs(r - 9 / 16) < 0.05) aspectRatio = '9:16';
        else if (Math.abs(r - 1) < 0.05) aspectRatio = '1:1';
        else if (Math.abs(r - 4 / 3) < 0.05) aspectRatio = '4:3';
        else aspectRatio = `${width}:${height}`;
      }
    } catch { /* ignore */ }

    const imagePath = `/api/category-images/pool/${projectId}/${filename}`;

    const maxSort = await prisma.poolImage.aggregate({
      where: { projectId, deleted: false }, _max: { sortOrder: true },
    });

    const image = await prisma.poolImage.create({
      data: {
        projectId,
        label: label || file.name,
        imagePath,
        fileName: filename,
        aspectRatio,
        width,
        height,
        source: 'upload',
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ image });
  } catch (error) {
    console.error('Pool upload error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}

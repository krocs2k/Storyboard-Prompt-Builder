export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = request.nextUrl.searchParams.get('projectId');
    const includeDeleted = request.nextUrl.searchParams.get('includeDeleted') === 'true';
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Auto-purge trash > 7 days old
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.poolImage.deleteMany({
      where: { projectId, deleted: true, deletedAt: { lt: sevenDaysAgo } },
    });

    const images = await prisma.poolImage.findMany({
      where: { projectId, deleted: includeDeleted ? undefined : false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Pool GET error:', error);
    return NextResponse.json({ error: 'Failed to load pool images' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, projectId, label, imagePath, fileName, isMultiImage, gridSize, source, sortOrder, deleted, hidden, aspectRatio, width, height } = body;

    if (id) {
      const data: Record<string, unknown> = {};
      if (label !== undefined) data.label = label;
      if (isMultiImage !== undefined) data.isMultiImage = isMultiImage;
      if (gridSize !== undefined) data.gridSize = gridSize;
      if (sortOrder !== undefined) data.sortOrder = sortOrder;
      if (hidden !== undefined) data.hidden = hidden;
      if (deleted !== undefined) {
        data.deleted = deleted;
        data.deletedAt = deleted ? new Date() : null;
      }
      const image = await prisma.poolImage.update({ where: { id }, data });
      return NextResponse.json({ image });
    }

    if (!projectId || !imagePath) {
      return NextResponse.json({ error: 'projectId and imagePath required' }, { status: 400 });
    }

    const maxSort = await prisma.poolImage.aggregate({
      where: { projectId, deleted: false }, _max: { sortOrder: true },
    });

    const image = await prisma.poolImage.create({
      data: {
        projectId,
        label: label || '',
        imagePath,
        fileName: fileName || '',
        isMultiImage: !!isMultiImage,
        gridSize: gridSize || 0,
        source: source || 'upload',
        aspectRatio: aspectRatio || '16:9',
        width: width || 0,
        height: height || 0,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({ image });
  } catch (error) {
    console.error('Pool POST error:', error);
    return NextResponse.json({ error: 'Failed to save pool image' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, restore } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (restore) {
      await prisma.poolImage.update({ where: { id }, data: { deleted: false, deletedAt: null } });
      return NextResponse.json({ success: true, restored: true });
    }
    await prisma.poolImage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pool DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

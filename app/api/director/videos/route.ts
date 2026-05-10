export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET: List videos for a project
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = request.nextUrl.searchParams.get('projectId');
    const includeDeleted = request.nextUrl.searchParams.get('includeDeleted') === 'true';
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Clean up videos deleted > 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.directorVideo.deleteMany({
      where: { projectId, deleted: true, deletedAt: { lt: sevenDaysAgo } },
    });

    const videos = await prisma.directorVideo.findMany({
      where: {
        projectId,
        deleted: includeDeleted ? undefined : false,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Director videos GET error:', error);
    return NextResponse.json({ error: 'Failed to load videos' }, { status: 500 });
  }
}

// POST: Create or update a video
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, projectId, prompt, sortOrder, enabled, inPoint, outPoint, deleted, startFrameUrl, endFrameUrl } = body;

    if (id) {
      // Update existing video
      const updateData: Record<string, unknown> = {};
      if (prompt !== undefined) updateData.prompt = prompt;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (enabled !== undefined) updateData.enabled = enabled;
      if (inPoint !== undefined) updateData.inPoint = inPoint;
      if (outPoint !== undefined) updateData.outPoint = outPoint;
      if (startFrameUrl !== undefined) updateData.startFrameUrl = startFrameUrl;
      if (endFrameUrl !== undefined) updateData.endFrameUrl = endFrameUrl;
      if (deleted !== undefined) {
        updateData.deleted = deleted;
        updateData.deletedAt = deleted ? new Date() : null;
      }

      const video = await prisma.directorVideo.update({
        where: { id },
        data: updateData,
      });
      return NextResponse.json({ video });
    }

    // Create new video
    if (!projectId || !prompt) {
      return NextResponse.json({ error: 'projectId and prompt required' }, { status: 400 });
    }

    // Get next sort order
    const maxSort = await prisma.directorVideo.aggregate({
      where: { projectId, deleted: false },
      _max: { sortOrder: true },
    });

    const video = await prisma.directorVideo.create({
      data: {
        projectId,
        prompt,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        startFrameUrl: startFrameUrl || null,
        endFrameUrl: endFrameUrl || null,
      },
    });

    return NextResponse.json({ video });
  } catch (error) {
    console.error('Director videos POST error:', error);
    return NextResponse.json({ error: 'Failed to save video' }, { status: 500 });
  }
}

// PUT: Batch update (reorder, etc.)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { updates } = await request.json();
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates array required' }, { status: 400 });
    }

    for (const u of updates) {
      if (!u.id) continue;
      const data: Record<string, unknown> = {};
      if (u.sortOrder !== undefined) data.sortOrder = u.sortOrder;
      if (u.enabled !== undefined) data.enabled = u.enabled;
      if (u.inPoint !== undefined) data.inPoint = u.inPoint;
      if (u.outPoint !== undefined) data.outPoint = u.outPoint;
      await prisma.directorVideo.update({ where: { id: u.id }, data });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Director videos PUT error:', error);
    return NextResponse.json({ error: 'Failed to update videos' }, { status: 500 });
  }
}

// DELETE: Permanent delete (for admin/force) or restore
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, restore } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (restore) {
      await prisma.directorVideo.update({
        where: { id },
        data: { deleted: false, deletedAt: null },
      });
      return NextResponse.json({ success: true, restored: true });
    }

    await prisma.directorVideo.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Director videos DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}

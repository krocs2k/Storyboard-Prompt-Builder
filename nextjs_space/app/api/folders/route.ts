import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET - List all folders
export async function GET() {
  try {
    const folders = await prisma.projectFolder.findMany({
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            updatedAt: true,
          },
        },
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(folders);
  } catch (error) {
    console.error('Folders GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

// POST - Create new folder
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const folder = await prisma.projectFolder.create({
      data: { name },
      include: {
        projects: true,
        _count: {
          select: { projects: true },
        },
      },
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error('Folders POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

// PUT - Update folder
export async function PUT(request: NextRequest) {
  try {
    const { id, name } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Folder ID and name are required' },
        { status: 400 }
      );
    }

    const folder = await prisma.projectFolder.update({
      where: { id },
      data: { name },
      include: {
        projects: true,
        _count: {
          select: { projects: true },
        },
      },
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error('Folders PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

// DELETE - Delete folder
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    // This will set folderId to null for all projects in the folder
    await prisma.projectFolder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Folders DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}

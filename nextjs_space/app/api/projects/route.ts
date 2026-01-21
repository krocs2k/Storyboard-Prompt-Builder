import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET - List all projects or get specific project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const folderId = searchParams.get('folderId');

    if (id) {
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          folder: true,
          screenplay: true,
          storyboard: true,
        },
      });
      
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      
      return NextResponse.json(project);
    }

    const where = folderId ? { folderId } : {};
    const projects = await prisma.project.findMany({
      where,
      include: {
        folder: true,
        screenplay: true,
        storyboard: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Projects GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST - Create new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, folderId, selections, recommendations, screenplay, storyboard } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        folderId: folderId || null,
        selections: selections || null,
        recommendations: recommendations || null,
        ...(screenplay && {
          screenplay: {
            create: {
              title: screenplay.title || name,
              runtime: screenplay.runtime || 15,
              content: screenplay.content || '',
              characters: screenplay.characters || [],
              environments: screenplay.environments || [],
              sourceType: screenplay.sourceType || 'manual',
              sourceUrl: screenplay.sourceUrl || null,
              storyIdea: screenplay.storyIdea || null,
              characterPrompts: screenplay.characterPrompts || null,
              environmentPrompts: screenplay.environmentPrompts || null,
            },
          },
        }),
        ...(storyboard && {
          storyboard: {
            create: {
              blocks: storyboard.blocks || [],
              shotlist: storyboard.shotlist || {},
              totalBlocks: storyboard.totalBlocks || 0,
              estimatedRuntime: storyboard.estimatedRuntime || 15,
            },
          },
        }),
      },
      include: {
        folder: true,
        screenplay: true,
        storyboard: true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('Projects POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

// PUT - Update project
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, folderId, selections, recommendations, screenplay, storyboard } = body;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Update main project
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (folderId !== undefined) updateData.folderId = folderId;
    if (selections !== undefined) updateData.selections = selections;
    if (recommendations !== undefined) updateData.recommendations = recommendations;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    // Update or create screenplay if provided
    if (screenplay) {
      const existingScreenplay = await prisma.screenplay.findUnique({
        where: { projectId: id },
      });

      if (existingScreenplay) {
        await prisma.screenplay.update({
          where: { projectId: id },
          data: {
            title: screenplay.title,
            runtime: screenplay.runtime,
            content: screenplay.content,
            characters: screenplay.characters,
            environments: screenplay.environments,
            sourceType: screenplay.sourceType,
            sourceUrl: screenplay.sourceUrl,
            storyIdea: screenplay.storyIdea,
            characterPrompts: screenplay.characterPrompts,
            environmentPrompts: screenplay.environmentPrompts,
          },
        });
      } else {
        await prisma.screenplay.create({
          data: {
            projectId: id,
            title: screenplay.title || project.name,
            runtime: screenplay.runtime || 15,
            content: screenplay.content || '',
            characters: screenplay.characters || [],
            environments: screenplay.environments || [],
            sourceType: screenplay.sourceType || 'manual',
            sourceUrl: screenplay.sourceUrl || null,
            storyIdea: screenplay.storyIdea || null,
            characterPrompts: screenplay.characterPrompts || null,
            environmentPrompts: screenplay.environmentPrompts || null,
          },
        });
      }
    }

    // Update or create storyboard if provided
    if (storyboard) {
      const existingStoryboard = await prisma.storyboard.findUnique({
        where: { projectId: id },
      });

      if (existingStoryboard) {
        await prisma.storyboard.update({
          where: { projectId: id },
          data: {
            blocks: storyboard.blocks,
            shotlist: storyboard.shotlist,
            totalBlocks: storyboard.totalBlocks,
            estimatedRuntime: storyboard.estimatedRuntime,
          },
        });
      } else {
        await prisma.storyboard.create({
          data: {
            projectId: id,
            blocks: storyboard.blocks || [],
            shotlist: storyboard.shotlist || {},
            totalBlocks: storyboard.totalBlocks || 0,
            estimatedRuntime: storyboard.estimatedRuntime || 15,
          },
        });
      }
    }

    // Fetch updated project with relations
    const updatedProject = await prisma.project.findUnique({
      where: { id },
      include: {
        folder: true,
        screenplay: true,
        storyboard: true,
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('Projects PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE - Delete project
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Projects DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

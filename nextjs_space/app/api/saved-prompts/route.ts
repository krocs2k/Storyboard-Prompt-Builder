import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET - List user's saved prompts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prompts = await prisma.savedPrompt.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(prompts);
  } catch (error) {
    console.error('SavedPrompts GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved prompts' },
      { status: 500 }
    );
  }
}

// POST - Create new saved prompt
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, prompt, selections } = await request.json();

    if (!name || !prompt) {
      return NextResponse.json(
        { error: 'Name and prompt are required' },
        { status: 400 }
      );
    }

    const savedPrompt = await prisma.savedPrompt.create({
      data: {
        name,
        prompt,
        selections: selections || {},
        userId: session.user.id,
      },
    });

    return NextResponse.json(savedPrompt);
  } catch (error) {
    console.error('SavedPrompts POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save prompt' },
      { status: 500 }
    );
  }
}

// PUT - Update saved prompt
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, prompt, selections } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.savedPrompt.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (selections !== undefined) updateData.selections = selections;

    const savedPrompt = await prisma.savedPrompt.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(savedPrompt);
  } catch (error) {
    console.error('SavedPrompts PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

// DELETE - Delete saved prompt
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.savedPrompt.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    await prisma.savedPrompt.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SavedPrompts DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateImage } from '@/lib/imagen';
import { saveImage, deleteImage, deleteProjectImages } from '@/lib/image-storage';
import { getMovieStyleSettings, loadStyleReferenceImage } from '@/lib/movie-style-ref';

/**
 * GET - List all storyboard images for a project
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  try {
    const images = await prisma.storyboardImage.findMany({
      where: { projectId },
      orderBy: { blockNumber: 'asc' },
    });
    return NextResponse.json({ images });
  } catch (err) {
    console.error('Failed to fetch images:', err);
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}

/**
 * POST - Generate image for a specific storyboard block
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId, blockNumber, prompt, aspectRatio, movieStyleId } = await req.json();

    if (!projectId || blockNumber === undefined || !prompt) {
      return NextResponse.json({ error: 'projectId, blockNumber, and prompt required' }, { status: 400 });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if style reference mode is enabled
    let styleReferenceImage: { base64: string; mimeType: string } | null = null;
    if (movieStyleId) {
      const settings = await getMovieStyleSettings();
      if (settings.useImageAsReference) {
        styleReferenceImage = await loadStyleReferenceImage(movieStyleId);
      }
    }

    // Generate image
    const results = await generateImage(prompt, {
      aspectRatio: aspectRatio || '16:9',
      numberOfImages: 1,
      styleReferenceImage,
    });

    const imageData = results[0];
    const buffer = Buffer.from(imageData.imageBytes, 'base64');

    // Save to local filesystem
    const { relativePath, fileName } = saveImage(projectId, blockNumber, buffer, 'png');

    // Upsert to database (replace existing image for this block)
    const image = await prisma.storyboardImage.upsert({
      where: {
        projectId_blockNumber: { projectId, blockNumber },
      },
      update: {
        prompt,
        imagePath: relativePath,
        fileName,
        aspectRatio: aspectRatio || '16:9',
      },
      create: {
        projectId,
        blockNumber,
        prompt,
        imagePath: relativePath,
        fileName,
        aspectRatio: aspectRatio || '16:9',
      },
    });

    return NextResponse.json({ success: true, image });
  } catch (err) {
    console.error('Image generation failed:', err);
    const message = err instanceof Error ? err.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE - Delete image(s) for a project
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId, blockNumber, deleteAll } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    if (deleteAll) {
      // Delete all images for project
      const images = await prisma.storyboardImage.findMany({ where: { projectId } });
      for (const img of images) {
        deleteImage(img.imagePath);
      }
      await prisma.storyboardImage.deleteMany({ where: { projectId } });
      deleteProjectImages(projectId);
      return NextResponse.json({ success: true, deleted: images.length });
    }

    if (blockNumber === undefined) {
      return NextResponse.json({ error: 'blockNumber or deleteAll required' }, { status: 400 });
    }

    // Delete single image
    const image = await prisma.storyboardImage.findUnique({
      where: { projectId_blockNumber: { projectId, blockNumber } },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    deleteImage(image.imagePath);
    await prisma.storyboardImage.delete({ where: { id: image.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete image:', err);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}

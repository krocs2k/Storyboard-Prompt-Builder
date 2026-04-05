export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { saveGalleryImage, deleteGalleryImageFile } from '@/lib/gallery-storage';
import sharp from 'sharp';

/**
 * GET - List all gallery images for a project
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  try {
    const images = await prisma.galleryImage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ images });
  } catch (err) {
    console.error('Failed to fetch gallery images:', err);
    return NextResponse.json({ error: 'Failed to fetch gallery images' }, { status: 500 });
  }
}

/**
 * POST - Save a generated image to the gallery
 * Body: { projectId, imageKey, prompt, label, base64, mimeType, aspectRatio }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { projectId, imageKey, prompt, label, base64, mimeType, aspectRatio } = await req.json();

    if (!projectId || !base64) {
      return NextResponse.json({ error: 'projectId and base64 required' }, { status: 400 });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const buffer = Buffer.from(base64, 'base64');

    // Get image dimensions
    let width = 0, height = 0;
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width || 0;
      height = meta.height || 0;
    } catch { /* skip */ }

    const ext = mimeType?.includes('jpeg') || mimeType?.includes('jpg') ? 'jpg' : 'png';
    const { relativePath, fileName } = saveGalleryImage(projectId, buffer, ext);

    const image = await prisma.galleryImage.create({
      data: {
        projectId,
        imageKey: imageKey || `img-${Date.now()}`,
        prompt: prompt || '',
        label: label || '',
        imagePath: relativePath,
        fileName,
        aspectRatio: aspectRatio || '16:9',
        width,
        height,
      },
    });

    return NextResponse.json({ success: true, image });
  } catch (err) {
    console.error('Failed to save gallery image:', err);
    return NextResponse.json({ error: 'Failed to save image' }, { status: 500 });
  }
}

/**
 * PATCH - Toggle favorite on a gallery image
 * Ensures only ONE image per imageKey-prefix per project can be favorite.
 * Body: { id, isFavorite }
 * The imageKey prefix groups images: 'char-0', 'char-1', 'env-0', etc.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, isFavorite } = await req.json();
    if (!id || typeof isFavorite !== 'boolean') {
      return NextResponse.json({ error: 'id and isFavorite required' }, { status: 400 });
    }

    const image = await prisma.galleryImage.findUnique({ where: { id } });
    if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

    // Extract prefix group (e.g. 'char-0' from 'char-0')
    const keyPrefix = image.imageKey;

    if (isFavorite) {
      // Clear any existing favorite for this imageKey in this project
      await prisma.galleryImage.updateMany({
        where: { projectId: image.projectId, imageKey: keyPrefix, isFavorite: true },
        data: { isFavorite: false },
      });
    }

    // Set the new favorite
    const updated = await prisma.galleryImage.update({
      where: { id },
      data: { isFavorite },
    });

    return NextResponse.json({ success: true, image: updated });
  } catch (err) {
    console.error('Failed to update favorite:', err);
    return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 });
  }
}

/**
 * DELETE - Delete gallery image(s)
 * Body: { id } or { projectId, deleteAll: true }
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, projectId, deleteAll } = await req.json();

    if (deleteAll && projectId) {
      const images = await prisma.galleryImage.findMany({ where: { projectId } });
      for (const img of images) {
        deleteGalleryImageFile(img.imagePath);
      }
      await prisma.galleryImage.deleteMany({ where: { projectId } });
      return NextResponse.json({ success: true, deleted: images.length });
    }

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const image = await prisma.galleryImage.findUnique({ where: { id } });
    if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

    deleteGalleryImageFile(image.imagePath);
    await prisma.galleryImage.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete gallery image:', err);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}

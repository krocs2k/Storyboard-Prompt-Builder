export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readGalleryImage, saveGalleryImage, deleteGalleryImageFile } from '@/lib/gallery-storage';
import sharp from 'sharp';

/**
 * POST - Upscale a gallery image by 4x using Sharp Lanczos3
 * Body: { imageId }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { imageId } = await req.json();
    if (!imageId) return NextResponse.json({ error: 'imageId required' }, { status: 400 });

    const image = await prisma.galleryImage.findUnique({ where: { id: imageId } });
    if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

    const buffer = readGalleryImage(image.imagePath);
    if (!buffer) return NextResponse.json({ error: 'Image file not found on disk' }, { status: 404 });

    // Get current dimensions
    const meta = await sharp(buffer).metadata();
    const origW = meta.width || 512;
    const origH = meta.height || 512;
    const newW = origW * 4;
    const newH = origH * 4;

    // Cap at 8192x8192 to avoid memory issues
    const maxDim = 8192;
    const scaleW = Math.min(newW, maxDim);
    const scaleH = Math.min(newH, maxDim);

    // Upscale with Lanczos3
    const ext = image.fileName.endsWith('.jpg') ? 'jpg' : 'png';
    let upscaled: Buffer;
    if (ext === 'jpg') {
      upscaled = await sharp(buffer)
        .resize(scaleW, scaleH, { kernel: sharp.kernel.lanczos3 })
        .jpeg({ quality: 95 })
        .toBuffer();
    } else {
      upscaled = await sharp(buffer)
        .resize(scaleW, scaleH, { kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
    }

    // Delete old file
    deleteGalleryImageFile(image.imagePath);

    // Save new file
    const { relativePath, fileName } = saveGalleryImage(image.projectId, upscaled, ext);

    // Update DB record
    const updated = await prisma.galleryImage.update({
      where: { id: imageId },
      data: {
        imagePath: relativePath,
        fileName,
        width: scaleW,
        height: scaleH,
        label: image.label ? `${image.label} (4x upscaled)` : '4x upscaled',
      },
    });

    return NextResponse.json({ success: true, image: updated });
  } catch (err) {
    console.error('Upscale failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upscale failed' }, { status: 500 });
  }
}

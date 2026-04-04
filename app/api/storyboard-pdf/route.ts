export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readImage } from '@/lib/image-storage';
import { StoryboardBlock } from '@/lib/types';

/**
 * POST - Generate a simple storyboard PDF as base64
 * Client will construct the PDF using jsPDF
 * This endpoint provides all the data + images as base64
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { storyboard: true, storyboardImages: true, screenplay: true },
    });

    if (!project || !project.storyboard) {
      return NextResponse.json({ error: 'Project or storyboard not found' }, { status: 404 });
    }

    const blocks = project.storyboard.blocks as unknown as StoryboardBlock[];
    const imageMap = new Map(project.storyboardImages.map((img) => [img.blockNumber, img]));

    // Build data payload with base64 images
    const pages = blocks.map((block) => {
      const imageRecord = imageMap.get(block.blockNumber);
      let imageBase64: string | null = null;

      if (imageRecord) {
        const buffer = readImage(imageRecord.imagePath);
        if (buffer) {
          imageBase64 = buffer.toString('base64');
        }
      }

      return {
        blockNumber: block.blockNumber,
        timestampStart: block.timestampStart,
        timestampEnd: block.timestampEnd,
        scene: block.scene,
        location: block.location,
        action: block.action,
        subjectAction: block.subjectAction,
        environment: block.environment,
        atmosphere: block.atmosphere,
        shotType: block.shotType,
        lighting: block.lighting,
        prompt: block.prompt,
        notes: block.notes,
        imageBase64,
        hasImage: !!imageBase64,
      };
    });

    return NextResponse.json({
      title: project.screenplay?.title || project.name,
      projectName: project.name,
      totalBlocks: blocks.length,
      pages,
    });
  } catch (err) {
    console.error('PDF data generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate PDF data' }, { status: 500 });
  }
}

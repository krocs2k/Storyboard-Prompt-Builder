export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateImage } from '@/lib/imagen';
import { saveImage } from '@/lib/image-storage';
import { getMovieStyleSettings, loadStyleReferenceImage } from '@/lib/movie-style-ref';

/**
 * POST - Batch render all storyboard images, streaming progress via SSE
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { projectId: string; aspectRatio?: string; regenerateExisting?: boolean; movieStyleId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId, aspectRatio = '16:9', regenerateExisting = false, movieStyleId } = body;

  // Pre-load style reference image if enabled (load once for entire batch)
  let styleReferenceImage: { base64: string; mimeType: string } | null = null;
  if (movieStyleId) {
    const settings = await getMovieStyleSettings();
    if (settings.useImageAsReference) {
      styleReferenceImage = await loadStyleReferenceImage(movieStyleId);
    }
  }

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'projectId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify project has storyboard
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { storyboard: true },
  });

  if (!project || !project.storyboard) {
    return new Response(JSON.stringify({ error: 'Project or storyboard not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const blocks = project.storyboard.blocks as Array<{
    blockNumber: number;
    prompt: string;
    scene?: string;
    action?: string;
    subjectAction?: string;
  }>;

  // Get existing images to skip unless regenerating
  const existingImages = await prisma.storyboardImage.findMany({
    where: { projectId },
    select: { blockNumber: true },
  });
  const existingBlockNumbers = new Set(existingImages.map((i) => i.blockNumber));

  const blocksToRender = regenerateExisting
    ? blocks
    : blocks.filter((b) => !existingBlockNumbers.has(b.blockNumber));

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({
        status: 'starting',
        message: `Rendering ${blocksToRender.length} images...`,
        total: blocksToRender.length,
        completed: 0,
        skipped: blocks.length - blocksToRender.length,
      });

      let completed = 0;
      let failed = 0;
      const BATCH_SIZE = 3; // Process 3 at a time to avoid rate limits
      const DELAY_BETWEEN_BATCHES = 2000; // 2s delay between batches

      for (let i = 0; i < blocksToRender.length; i += BATCH_SIZE) {
        const batch = blocksToRender.slice(i, i + BATCH_SIZE);

        const promises = batch.map(async (block) => {
          const prompt = block.prompt || block.subjectAction || block.action || block.scene || '';
          if (!prompt) {
            failed++;
            return;
          }

          try {
            send({
              status: 'generating',
              message: `Generating Block ${block.blockNumber}...`,
              total: blocksToRender.length,
              completed,
              currentBlock: block.blockNumber,
            });

            const results = await generateImage(prompt, {
              aspectRatio: (aspectRatio as '16:9') || '16:9',
              numberOfImages: 1,
              styleReferenceImage,
            });

            const imageData = results[0];
            const buffer = Buffer.from(imageData.imageBytes, 'base64');
            const { relativePath, fileName } = saveImage(projectId, block.blockNumber, buffer, 'png');

            await prisma.storyboardImage.upsert({
              where: {
                projectId_blockNumber: { projectId, blockNumber: block.blockNumber },
              },
              update: {
                prompt,
                imagePath: relativePath,
                fileName,
                aspectRatio,
              },
              create: {
                projectId,
                blockNumber: block.blockNumber,
                prompt,
                imagePath: relativePath,
                fileName,
                aspectRatio,
              },
            });

            completed++;
            send({
              status: 'progress',
              message: `Completed Block ${block.blockNumber}`,
              total: blocksToRender.length,
              completed,
              currentBlock: block.blockNumber,
            });
          } catch (err) {
            failed++;
            send({
              status: 'block_error',
              message: `Failed Block ${block.blockNumber}: ${err instanceof Error ? err.message : 'Unknown error'}`,
              total: blocksToRender.length,
              completed,
              failed,
              currentBlock: block.blockNumber,
            });
          }
        });

        await Promise.all(promises);

        // Delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < blocksToRender.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      send({
        status: 'complete',
        message: `Batch render complete: ${completed} generated, ${failed} failed, ${blocks.length - blocksToRender.length} skipped`,
        total: blocksToRender.length,
        completed,
        failed,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

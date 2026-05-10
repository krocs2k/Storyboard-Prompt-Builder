export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateVideo, getVideoModelInfo } from '@/lib/video-gen';
import { trackUsage } from '@/lib/usage-tracker';
import { submitJob } from '@/lib/concurrency';
import type { Provider } from '@/lib/concurrency';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { videoId, prompt, startFrameUrl, endFrameUrl } = body;

    if (!videoId || !prompt) {
      return NextResponse.json({ error: 'videoId and prompt required' }, { status: 400 });
    }

    // Mark video as generating
    await prisma.directorVideo.update({
      where: { id: videoId },
      data: { status: 'generating', errorMessage: null },
    });

    // Determine provider for concurrency management
    let providerHint: Provider = 'gemini';
    try {
      const modelInfo = await getVideoModelInfo();
      if (modelInfo?.provider) providerHint = modelInfo.provider as Provider;
    } catch { /* use default */ }

    try {
      // Submit through concurrency manager for optimal parallel execution
      const result = await submitJob({
        fn: () => generateVideo({
          prompt,
          startFrameUrl: startFrameUrl || null,
          endFrameUrl: endFrameUrl || null,
        }),
        userId: session.user?.id || 'anonymous',
        jobType: 'video',
        provider: providerHint,
        priority: 3, // Videos are higher priority
      });

      // Update video record with result
      await prisma.directorVideo.update({
        where: { id: videoId },
        data: {
          status: 'ready',
          videoUrl: result.videoUrl,
          modelId: result.model,
          startFrameUrl: startFrameUrl || null,
          endFrameUrl: endFrameUrl || null,
        },
      });

      // Track usage
      await trackUsage({
        userId: session.user?.id,
        eventType: 'video_generate',
        apiModel: result.model,
        apiType: 'video',
        provider: result.provider,
        count: 1,
        metadata: { hasStartFrame: !!startFrameUrl, hasEndFrame: !!endFrameUrl },
      });

      return NextResponse.json({ success: true, videoUrl: result.videoUrl });
    } catch (genError: unknown) {
      const errorMsg = genError instanceof Error ? genError.message : 'Video generation failed';
      console.error('Video generation error:', errorMsg);

      await prisma.directorVideo.update({
        where: { id: videoId },
        data: { status: 'failed', errorMessage: errorMsg.slice(0, 500) },
      });

      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
  } catch (error) {
    console.error('Director generate error:', error);
    return NextResponse.json({ error: 'Video generation failed' }, { status: 500 });
  }
}

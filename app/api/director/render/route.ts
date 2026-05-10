export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { videos } = await request.json();
    // videos: Array<{ url: string; inPoint: number; outPoint: number; duration: number }>

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: 'No videos provided' }, { status: 400 });
    }

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'FFmpeg API key not configured' }, { status: 500 });
    }

    // Build FFmpeg command to concatenate videos with trim points
    const inputFiles: Record<string, string> = {};
    const filterParts: string[] = [];
    const inputArgs: string[] = [];

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const key = `in_${i + 1}`;
      inputFiles[key] = v.url;
      inputArgs.push(`-i {{${key}}}`);

      const inP = v.inPoint || 0;
      const outP = v.outPoint && v.outPoint > inP ? v.outPoint : v.duration || 0;
      const dur = outP > inP ? outP - inP : 0;

      // Trim each video to in/out points, scale to 1920x1080, set SAR/DAR
      if (dur > 0) {
        filterParts.push(
          `[${i}:v]trim=start=${inP}:end=${outP},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
        );
      } else {
        filterParts.push(
          `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
        );
      }
    }

    // Concat
    const concatInputs = videos.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${concatInputs}concat=n=${videos.length}:v=1:a=0[outv]`);

    const filterComplex = filterParts.join(';');
    const ffmpegCommand = `${inputArgs.join(' ')} -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart {{out_1}}`;

    const outputFiles = { out_1: 'rendered_sequence.mp4' };

    // Step 1: Create FFmpeg request
    const createResponse = await fetch('https://apps.abacus.ai/api/createRunFfmpegCommandRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: apiKey,
        input_files: inputFiles,
        output_files: outputFiles,
        ffmpeg_command: ffmpegCommand,
        max_command_run_seconds: 600,
      }),
    });

    if (!createResponse.ok) {
      const err = await createResponse.json().catch(() => ({ error: 'FFmpeg request failed' }));
      return NextResponse.json({ error: err.error || 'FFmpeg request failed' }, { status: 500 });
    }

    const { request_id } = await createResponse.json();
    if (!request_id) {
      return NextResponse.json({ error: 'No request ID returned' }, { status: 500 });
    }

    // Step 2: Poll for status
    const maxAttempts = 600;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch('https://apps.abacus.ai/api/getRunFfmpegCommandStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: apiKey }),
      });

      const statusResult = await statusResponse.json();
      const status = statusResult?.status || 'FAILED';
      const result = statusResult?.result || null;

      if (status === 'SUCCESS') {
        if (result?.result) {
          return NextResponse.json({ success: true, outputUrl: result.result.out_1 });
        }
        return NextResponse.json({ error: 'FFmpeg completed but no output' }, { status: 500 });
      } else if (status === 'FAILED') {
        return NextResponse.json({ error: result?.error || 'FFmpeg processing failed' }, { status: 500 });
      }

      attempts++;
    }

    return NextResponse.json({ error: 'FFmpeg processing timed out' }, { status: 500 });
  } catch (error) {
    console.error('Director render error:', error);
    return NextResponse.json({ error: 'Render failed' }, { status: 500 });
  }
}

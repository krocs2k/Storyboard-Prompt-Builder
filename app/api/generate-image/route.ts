export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateImage } from '@/lib/imagen';
import { getMovieStyleSettings, loadStyleReferenceImage } from '@/lib/movie-style-ref';

/**
 * POST - Generate an image from any prompt and return it as base64
 * Used for character prompts, environment prompts, and the constructed prompt.
 * Optionally passes a movie style image as a style reference when enabled in admin.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { prompt, aspectRatio, movieStyleId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    // Check if style reference mode is enabled and a movie style is selected
    let styleReferenceImage: { base64: string; mimeType: string } | null = null;
    if (movieStyleId) {
      const settings = await getMovieStyleSettings();
      if (settings.useImageAsReference) {
        styleReferenceImage = await loadStyleReferenceImage(movieStyleId);
      }
    }

    const results = await generateImage(prompt, {
      aspectRatio: aspectRatio || '16:9',
      numberOfImages: 1,
      styleReferenceImage,
    });

    const imageData = results[0];

    return NextResponse.json({
      success: true,
      image: {
        base64: imageData.imageBytes,
        mimeType: imageData.mimeType,
      },
    });
  } catch (err) {
    console.error('Image generation failed:', err);
    const message = err instanceof Error ? err.message : 'Image generation failed';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Image generation error details:', { message, stack });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

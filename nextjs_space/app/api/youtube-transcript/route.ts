import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]+)/,
    /(?:youtu\.be\/)([\w-]+)/,
    /(?:youtube\.com\/embed\/)([\w-]+)/,
    /(?:youtube\.com\/v\/)([\w-]+)/,
    /(?:youtube\.com\/shorts\/)([\w-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }
    
    // Use youtube-transcript library for reliable transcript extraction
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcriptItems || transcriptItems.length === 0) {
      return NextResponse.json(
        { error: 'No transcript available for this video. The video may not have captions enabled.' },
        { status: 404 }
      );
    }
    
    // Combine all transcript segments into a single text
    const transcript = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return NextResponse.json({ 
      success: true, 
      transcript,
      videoId 
    });
  } catch (error) {
    console.error('YouTube transcript error:', error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch transcript';
    
    if (errorMessage.includes('disabled') || errorMessage.includes('Transcript')) {
      return NextResponse.json(
        { error: 'Transcript is disabled for this video or not available.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]+)/,
    /(?:youtu\.be\/)([\w-]+)/,
    /(?:youtube\.com\/embed\/)([\w-]+)/,
    /(?:youtube\.com\/v\/)([\w-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchTranscript(videoId: string): Promise<string> {
  // Try to fetch transcript using YouTube's timedtext API
  const response = await fetch(
    `https://www.youtube.com/watch?v=${videoId}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  
  const html = await response.text();
  
  // Extract captions URL from the page
  const captionsMatch = html.match(/"captionTracks":\s*\[([^\]]+)\]/);
  if (!captionsMatch) {
    throw new Error('No captions found for this video. Please ensure the video has subtitles/captions enabled.');
  }
  
  const captionsData = JSON.parse(`[${captionsMatch[1]}]`);
  const englishCaption = captionsData.find((c: { languageCode: string }) => 
    c.languageCode === 'en' || c.languageCode?.startsWith('en')
  ) || captionsData[0];
  
  if (!englishCaption?.baseUrl) {
    throw new Error('Could not find caption URL.');
  }
  
  // Fetch the actual transcript
  const transcriptResponse = await fetch(englishCaption.baseUrl);
  const transcriptXml = await transcriptResponse.text();
  
  // Parse XML to extract text
  const textMatches = transcriptXml.match(/<text[^>]*>([^<]*)<\/text>/g);
  if (!textMatches) {
    throw new Error('Could not parse transcript.');
  }
  
  const transcript = textMatches
    .map(match => {
      const text = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
      return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ');
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return transcript;
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
    
    const transcript = await fetchTranscript(videoId);
    
    return NextResponse.json({ 
      success: true, 
      transcript,
      videoId 
    });
  } catch (error) {
    console.error('YouTube transcript error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}

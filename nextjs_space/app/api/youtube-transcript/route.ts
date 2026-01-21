import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

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

// Fallback method using direct YouTube page scraping
async function fetchTranscriptFallback(videoId: string): Promise<string> {
  const response = await fetch(
    `https://www.youtube.com/watch?v=${videoId}`,
    { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      } 
    }
  );
  
  const html = await response.text();
  
  // Extract captions URL from the page
  const captionsMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);
  if (!captionsMatch) {
    throw new Error('NO_CAPTIONS');
  }
  
  let captionsData;
  try {
    captionsData = JSON.parse(captionsMatch[1]);
  } catch {
    throw new Error('PARSE_ERROR');
  }
  
  // Find English caption or use first available
  const englishCaption = captionsData.find((c: { languageCode?: string; vssId?: string }) => 
    c.languageCode === 'en' || 
    c.languageCode?.startsWith('en') ||
    c.vssId?.includes('.en')
  ) || captionsData[0];
  
  if (!englishCaption?.baseUrl) {
    throw new Error('NO_CAPTION_URL');
  }
  
  // Fetch the actual transcript
  const transcriptResponse = await fetch(englishCaption.baseUrl);
  const transcriptXml = await transcriptResponse.text();
  
  // Parse XML to extract text
  const textMatches = transcriptXml.match(/<text[^>]*>([^<]*)<\/text>/g);
  if (!textMatches) {
    throw new Error('PARSE_ERROR');
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
        .replace(/&nbsp;/g, ' ')
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
    
    let transcript = '';
    
    // Try youtubei.js first (most reliable)
    try {
      const youtube = await Innertube.create({
        lang: 'en',
        location: 'US',
        retrieve_player: false,
      });
      
      const info = await youtube.getInfo(videoId);
      const transcriptInfo = await info.getTranscript();
      
      if (transcriptInfo?.transcript?.content?.body?.initial_segments) {
        const segments = transcriptInfo.transcript.content.body.initial_segments;
        transcript = segments
          .map((seg: { snippet?: { text?: string } }) => seg.snippet?.text || '')
          .filter((text: string) => text.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch (innertubeError) {
      console.log('Innertube method failed, trying fallback:', innertubeError);
    }
    
    // If youtubei.js didn't work, try fallback method
    if (!transcript) {
      try {
        transcript = await fetchTranscriptFallback(videoId);
      } catch (fallbackError) {
        console.log('Fallback method failed:', fallbackError);
      }
    }
    
    if (!transcript) {
      return NextResponse.json(
        { error: 'Could not extract transcript. Please ensure the video has captions/subtitles enabled.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      transcript,
      videoId 
    });
  } catch (error) {
    console.error('YouTube transcript error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript. Please try again or use a different video.' },
      { status: 500 }
    );
  }
}

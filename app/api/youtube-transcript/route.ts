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

// Direct page scraping method
async function fetchTranscriptDirect(videoId: string): Promise<string> {
  const response = await fetch(
    `https://www.youtube.com/watch?v=${videoId}`,
    { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      } 
    }
  );
  
  const html = await response.text();
  
  // Try to find captions in ytInitialPlayerResponse
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
  if (playerResponseMatch) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      
      if (captionTracks && captionTracks.length > 0) {
        // Find English track or use first available
        const track = captionTracks.find((t: { languageCode?: string }) => 
          t.languageCode === 'en' || t.languageCode?.startsWith('en')
        ) || captionTracks[0];
        
        if (track?.baseUrl) {
          const transcriptResponse = await fetch(track.baseUrl);
          const transcriptXml = await transcriptResponse.text();
          
          // Parse XML to extract text
          const textMatches = transcriptXml.match(/<text[^>]*>([^<]*)<\/text>/g);
          if (textMatches) {
            return textMatches
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
          }
        }
      }
    } catch (e) {
      console.log('Direct parse error:', e);
    }
  }
  
  throw new Error('NO_CAPTIONS_FOUND');
}

export async function POST(request: NextRequest) {
  try {
    const { url, manualTranscript } = await request.json();
    
    // If manual transcript is provided, use it directly
    if (manualTranscript && typeof manualTranscript === 'string' && manualTranscript.trim()) {
      return NextResponse.json({ 
        success: true, 
        transcript: manualTranscript.trim(),
        videoId: url ? extractVideoId(url) : null,
        method: 'manual'
      });
    }
    
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
    let method = '';
    
    // Method 1: Try youtube-transcript library
    try {
      const result = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
      if (result && result.length > 0) {
        transcript = result.map(item => item.text).join(' ').replace(/\s+/g, ' ').trim();
        method = 'youtube-transcript';
      }
    } catch (e) {
      console.log('youtube-transcript method failed:', e);
    }
    
    // Method 2: Try direct page scraping
    if (!transcript) {
      try {
        transcript = await fetchTranscriptDirect(videoId);
        method = 'direct-scraping';
      } catch (e) {
        console.log('Direct scraping method failed:', e);
      }
    }
    
    if (!transcript) {
      return NextResponse.json(
        { 
          error: 'AUTO_EXTRACT_FAILED',
          message: 'Could not automatically extract transcript. YouTube may be blocking automated access. Please use the manual paste option.',
          videoId 
        },
        { status: 422 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      transcript,
      videoId,
      method
    });
  } catch (error) {
    console.error('YouTube transcript error:', error);
    return NextResponse.json(
      { 
        error: 'AUTO_EXTRACT_FAILED',
        message: 'Failed to fetch transcript. Please use the manual paste option.' 
      },
      { status: 500 }
    );
  }
}

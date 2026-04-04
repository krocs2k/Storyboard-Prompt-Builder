import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { getLLMConfig } from '@/lib/llm';
import { trackUsage } from '@/lib/usage-tracker';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'Screenplay file is required' },
        { status: 400 }
      );
    }

    let screenplayContent = '';
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      // Plain text and Markdown files
      screenplayContent = await file.text();
    } else if (fileName.endsWith('.docx')) {
      // DOCX files - mammoth supports these well
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      screenplayContent = result.value;
    } else if (fileName.endsWith('.doc')) {
      // DOC files - could be binary or text with .doc extension
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Check for Microsoft Compound Document magic bytes (D0 CF 11 E0)
      const isBinaryDoc = uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF && 
                          uint8Array[2] === 0x11 && uint8Array[3] === 0xE0;
      
      if (isBinaryDoc) {
        // True binary DOC file - use word-extractor
        try {
          const extractor = new WordExtractor();
          const extracted = await extractor.extract(Buffer.from(buffer));
          screenplayContent = extracted.getBody();
        } catch (err) {
          console.error('Word extractor failed:', err);
          // Fallback: try reading as text
          screenplayContent = new TextDecoder('utf-8').decode(uint8Array);
        }
      } else {
        // Text file with .doc extension - read as plain text
        screenplayContent = new TextDecoder('utf-8').decode(uint8Array);
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload .txt, .md, .doc, or .docx' },
        { status: 400 }
      );
    }

    // Check if we got content
    if (!screenplayContent || screenplayContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from the file. The file may be empty or corrupted.' },
        { status: 400 }
      );
    }
    
    console.log('Screenplay content extracted, length:', screenplayContent.length);
    console.log('First 200 chars:', screenplayContent.substring(0, 200));

    // Analyze the screenplay and generate recommendations
    const llm = await getLLMConfig();
    const analysisResponse = await fetch(llm.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          {
            role: 'system',
            content: `You are a cinematography expert analyzing screenplays to recommend visual styles. Analyze the screenplay and recommend settings for each category.

Categories to analyze:
1. IMAGE TYPE - Choose the most appropriate visual style (Photorealistic, Anime cel-shading style, etc.)
2. SHOT TYPES - Recommend key shot types that would work well
3. LIGHTING - Recommend lighting styles that match the mood
4. CAMERA GEAR - Recommend camera, lens, and film stock
5. STYLE & AESTHETICS - Recommend photographer/cinematographer styles and movie references

Also extract:
- All CHARACTER names with brief descriptions
- All ENVIRONMENT/LOCATION descriptions
- Estimated runtime based on page count (1 page ≈ 1 minute)`
          },
          {
            role: 'user',
            content: `Analyze this screenplay and provide recommendations:

${screenplayContent.substring(0, 15000)}

Provide your analysis in JSON format:
{
  "title": "Screenplay title if found",
  "estimatedRuntime": 15,
  "genre": "Horror/Paranormal/Drama/etc",
  "mood": "Dark, suspenseful, etc",
  "recommendations": {
    "imageType": {
      "recommended": "Photorealistic",
      "reason": "Why this style fits"
    },
    "shotTypes": [
      { "type": "CLOSE UP", "reason": "For emotional intensity" }
    ],
    "lighting": [
      { "type": "LOW KEY LIGHTING", "reason": "Creates suspense" }
    ],
    "cameraBody": { "recommended": "ARRI ALEXA Mini", "reason": "Why" },
    "focalLength": { "recommended": "35mm Prime", "reason": "Why" },
    "lensType": { "recommended": "Cooke S4/i Primes", "reason": "Why" },
    "filmStock": { "recommended": "Kodak Vision3 500T", "reason": "Why" },
    "aspectRatio": { "recommended": "16:9", "reason": "Why" },
    "photographerStyle": { "recommended": "Roger Deakins", "reason": "Why" },
    "movieStyle": { "recommended": "Hereditary (2018)", "reason": "Why" },
    "filterEffect": { "recommended": "Low Contrast Filter", "reason": "Why" }
  },
  "characters": [
    { "name": "CHARACTER NAME", "description": "Brief description from script" }
  ],
  "environments": [
    { "name": "LOCATION NAME", "description": "Brief description from script" }
  ]
}

Respond with raw JSON only.`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      }),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Analysis API error:', analysisResponse.status, errorText);
      throw new Error(`Failed to analyze screenplay: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    console.log('Analysis response received:', JSON.stringify(analysisData).substring(0, 500));
    
    if (!analysisData.choices?.[0]?.message?.content) {
      console.error('Invalid analysis response structure:', analysisData);
      throw new Error('Invalid response from analysis API');
    }
    
    let analysis;
    try {
      analysis = JSON.parse(analysisData.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse analysis JSON:', analysisData.choices[0].message.content);
      throw new Error('Failed to parse analysis response');
    }
    
    // Extract dialogue with delivery instructions
    const dialogueResponse = await fetch(llm.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert dialogue director extracting voice-over scripts from screenplays. Extract ALL dialogue lines and provide clear, concise delivery direction for voice actors.

For each line of dialogue, provide:
1. CHARACTER - The character's name exactly as written
2. DIALOGUE - The exact dialogue text (clean it up if needed but preserve meaning)
3. DELIVERY - A brief, clear direction for how the line should be performed. Keep under 100 characters. Be specific about emotion, tone, pacing, and intent.

Examples of good delivery directions:
- "Whispered, terrified, barely audible"
- "Loud, authoritative, commanding attention"
- "Soft, nostalgic, with a hint of regret"
- "Fast-paced, panicked, out of breath"
- "Cold, detached, matter-of-fact"
- "Warm, reassuring, like comforting a child"
- "Sarcastic, with bitter undertone"
- "Trembling voice, fighting back tears"`
          },
          {
            role: 'user',
            content: `Extract ALL dialogue from this screenplay for voice-over recording:

${screenplayContent.substring(0, 20000)}

Return JSON format:
{
  "dialogueLines": [
    {
      "character": "CHARACTER NAME",
      "dialogue": "The exact dialogue text",
      "delivery": "Brief delivery direction under 100 chars"
    }
  ]
}

Include EVERY line of dialogue in order of appearance. Respond with raw JSON only.`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8000,
      }),
    });

    let dialogueLines: Array<{ character: string; dialogue: string; delivery: string }> = [];
    
    if (dialogueResponse.ok) {
      try {
        const dialogueData = await dialogueResponse.json();
        const dialogueResult = JSON.parse(dialogueData.choices[0].message.content);
        dialogueLines = dialogueResult.dialogueLines || [];
      } catch (e) {
        console.error('Failed to parse dialogue:', e);
      }
    }
    
    trackUsage({ eventType: 'screenplay_analyze', apiModel: llm.model, apiType: 'llm', provider: llm.provider });
    return NextResponse.json({
      success: true,
      screenplay: screenplayContent,
      analysis,
      dialogueLines
    });
  } catch (error) {
    console.error('Screenplay analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze screenplay' },
      { status: 500 }
    );
  }
}

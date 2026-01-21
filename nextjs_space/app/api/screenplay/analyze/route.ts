import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

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
    
    if (fileName.endsWith('.txt')) {
      screenplayContent = await file.text();
    } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      // Mammoth supports both .doc and .docx formats
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      screenplayContent = result.value;
    } else if (fileName.endsWith('.pdf')) {
      // For PDF, we'll use the LLM to extract and analyze
      const buffer = await file.arrayBuffer();
      const base64String = Buffer.from(buffer).toString('base64');
      
      const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gemini-3-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  file: {
                    filename: file.name,
                    file_data: `data:application/pdf;base64,${base64String}`
                  }
                },
                {
                  type: 'text',
                  text: 'Extract the full text content from this screenplay PDF.'
                }
              ]
            }
          ],
          max_tokens: 8000,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract PDF content');
      }

      const data = await response.json();
      screenplayContent = data.choices[0].message.content;
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload .txt, .doc, .docx, or .pdf' },
        { status: 400 }
      );
    }

    // Analyze the screenplay and generate recommendations
    const analysisResponse = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gemini-3-flash',
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
      throw new Error('Failed to analyze screenplay');
    }

    const analysisData = await analysisResponse.json();
    const analysis = JSON.parse(analysisData.choices[0].message.content);
    
    return NextResponse.json({
      success: true,
      screenplay: screenplayContent,
      analysis
    });
  } catch (error) {
    console.error('Screenplay analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze screenplay' },
      { status: 500 }
    );
  }
}

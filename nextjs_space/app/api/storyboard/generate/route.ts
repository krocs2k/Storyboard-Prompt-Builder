import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { screenplay, selections, runtime } = await request.json();
    
    if (!screenplay) {
      return new Response(
        JSON.stringify({ error: 'Screenplay content is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate number of storyboard blocks (30 seconds each)
    const totalSeconds = (runtime || 15) * 60;
    const blockCount = Math.ceil(totalSeconds / 30);

    // Build the style context from selections
    const styleContext = buildStyleContext(selections);

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are an expert storyboard artist and cinematographer specializing in paranormal documentary series. Your task is to break down "CRYPTID JOURNAL" screenplays into detailed storyboard blocks, each representing approximately 30 seconds of screen time. Create vivid, atmospheric, and cinematic image generation prompts for each block that capture the show's dark, mysterious tone.`
          },
          {
            role: 'user',
            content: `Break down this "CRYPTID JOURNAL" screenplay into ${blockCount} storyboard blocks (each ~30 seconds of screen time).

SCREENPLAY:
${screenplay.substring(0, 12000)}

VISUAL STYLE SPECIFICATIONS (from Sections 1-5):
${styleContext}

CRYPTID JOURNAL VISUAL GUIDELINES:
- Underground Facility (Host scenes): Dark, shadowy, industrial, mysterious artifacts visible, dramatic low-key lighting
- Interview Room: Stark, clinical, single overhead light, deep shadows, concrete walls, isolated feeling
- Re-enactments: Atmospheric, cinematic, dramatic lighting shifts for tension, supernatural elements when appropriate

For each storyboard block, provide:
1. Block number and timestamp range
2. Scene/location (HOST FACILITY, INTERVIEW ROOM, or RE-ENACTMENT location)
3. Detailed action description
4. Comprehensive image generation prompt incorporating:
   - ALL visual style specifications from Sections 1-5
   - Character positions and expressions
   - Lighting mood and sources
   - Atmospheric elements
   - Any supernatural/eerie visual elements
5. Shot type recommendation (vary between wide, medium, close-up, etc.)
6. Specific lighting notes for that block

Also create a SHOTLIST organized by location for efficient filming/production.

Respond in JSON format:
{
  "blocks": [
    {
      "blockNumber": 1,
      "timestampStart": "00:00",
      "timestampEnd": "00:30",
      "scene": "INT. UNDERGROUND FACILITY - NIGHT",
      "location": "Underground Facility",
      "action": "Description of what happens",
      "prompt": "Comprehensive image generation prompt with all visual specifications applied, atmospheric details, character descriptions, lighting",
      "shotType": "MEDIUM SHOT",
      "lighting": "LOW KEY DRAMATIC LIGHTING with single harsh overhead source",
      "notes": "Cinematography and mood notes"
    }
  ],
  "shotlist": {
    "Location Name": [
      {
        "blockNumber": 1,
        "shotType": "MEDIUM SHOT",
        "action": "Brief action description",
        "prompt": "The full prompt"
      }
    ]
  },
  "summary": {
    "totalBlocks": ${blockCount},
    "estimatedRuntime": ${runtime || 15},
    "uniqueLocations": 0,
    "locations": []
  }
}

Respond with raw JSON only.`
          }
        ],
        response_format: { type: 'json_object' },
        stream: true,
        max_tokens: 10000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        let partialRead = '';
        
        try {
          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            
            partialRead += decoder.decode(value, { stream: true });
            const lines = partialRead.split('\n');
            partialRead = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  try {
                    const storyboard = JSON.parse(buffer);
                    const finalData = JSON.stringify({
                      status: 'completed',
                      storyboard
                    });
                    controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                  } catch (e) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: 'Failed to parse storyboard' })}\n\n`));
                  }
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  buffer += content;
                  if (content) {
                    const progressData = JSON.stringify({
                      status: 'processing',
                      message: 'Creating storyboard blocks...'
                    });
                    controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Storyboard generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate storyboard' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function buildStyleContext(selections: Record<string, unknown> | null): string {
  if (!selections) return 'Use cinematic photorealistic style.';
  
  const parts: string[] = [];
  
  if (selections.imageType) {
    const it = selections.imageType as { name: string };
    parts.push(`Image Style: ${it.name}`);
  }
  if (selections.shotType) {
    const st = selections.shotType as { name: string };
    parts.push(`Default Shot Type: ${st.name}`);
  }
  if (selections.lighting) {
    const lt = selections.lighting as { name: string; description: string };
    parts.push(`Lighting: ${lt.name} - ${lt.description || ''}`);
  }
  if (selections.cameraBody) {
    const cb = selections.cameraBody as { name: string; description: string };
    parts.push(`Camera: ${cb.name} - ${cb.description || ''}`);
  }
  if (selections.focalLength) {
    const fl = selections.focalLength as { name: string; description: string };
    parts.push(`Focal Length: ${fl.name} - ${fl.description || ''}`);
  }
  if (selections.lensType) {
    const lens = selections.lensType as { name: string; description: string };
    parts.push(`Lens: ${lens.name} - ${lens.description || ''}`);
  }
  if (selections.filmStock) {
    const fs = selections.filmStock as { name: string; description: string };
    parts.push(`Film Stock: ${fs.name} - ${fs.description || ''}`);
  }
  if (selections.photographer) {
    const ph = selections.photographer as { name: string; description: string };
    parts.push(`Photographer Style: ${ph.name} - ${ph.description || ''}`);
  }
  if (selections.movie) {
    const mv = selections.movie as { name: string; description: string };
    parts.push(`Movie Style: ${mv.name} - ${mv.description || ''}`);
  }
  if (selections.filter) {
    const ft = selections.filter as { name: string; description: string };
    parts.push(`Filter Effect: ${ft.name} - ${ft.description || ''}`);
  }
  if (selections.aspectRatio) {
    parts.push(`Aspect Ratio: ${selections.aspectRatio}`);
  }
  
  return parts.join('\n') || 'Use cinematic photorealistic style.';
}

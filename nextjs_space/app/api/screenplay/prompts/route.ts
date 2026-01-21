import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { screenplay, characters, environments, selections } = await request.json();
    
    if (!screenplay || !characters || !environments) {
      return new Response(
        JSON.stringify({ error: 'Screenplay, characters, and environments are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
            content: `You are an expert at creating highly detailed, production-ready image generation prompts for film and television production. Your prompts must be comprehensive enough to generate consistent character and environment visuals across an entire production.`
          },
          {
            role: 'user',
            content: `Create DETAILED image generation prompts for EVERY character and environment in this "CRYPTID JOURNAL" screenplay.

SCREENPLAY:
${screenplay.substring(0, 10000)}

CHARACTERS FROM SCREENPLAY:
${JSON.stringify(characters, null, 2)}

ENVIRONMENTS FROM SCREENPLAY:
${JSON.stringify(environments, null, 2)}

VISUAL STYLE SPECIFICATIONS (Sections 1-5 Configuration):
${styleContext}

=== CHARACTER PROMPT REQUIREMENTS ===
For EACH character, create a comprehensive prompt including:
- Full physical description: exact age, height, body type/build, face shape
- Hair: color, length, style, texture
- Eyes: color, shape, expression
- Skin: tone, texture, any distinguishing marks
- Facial features: nose, lips, jaw, eyebrows
- Clothing: specific garments, colors, textures, condition, era-appropriate
- Accessories: jewelry, glasses, watches, etc.
- Posture and body language
- Emotional state and expression
- Apply ALL visual style specifications from Sections 1-5

=== ENVIRONMENT PROMPT REQUIREMENTS ===
For EACH location, create a comprehensive prompt including:
- Location type and architectural style
- Dimensions and spatial layout
- Wall/floor/ceiling materials and colors
- Lighting: sources, direction, color temperature, shadow quality, practical lights
- Time of day and natural light (if applicable)
- Weather and atmospheric conditions
- Specific props and set dressing (list at least 5-10 items)
- Textures and surfaces
- Mood and atmosphere
- Any supernatural/eerie elements
- Apply ALL visual style specifications from Sections 1-5

IMPORTANT: Create prompts for EVERY character mentioned (including The Host, Interviewee, and all re-enactment characters) and EVERY location (including Underground Facility, Interview Room, and all re-enactment locations).

Respond in JSON format:
{
  "characterPrompts": [
    {
      "name": "CHARACTER NAME",
      "prompt": "Complete detailed image generation prompt with all visual specifications applied"
    }
  ],
  "environmentPrompts": [
    {
      "name": "ENVIRONMENT NAME", 
      "prompt": "Complete detailed image generation prompt with all visual specifications applied"
    }
  ]
}

Respond with raw JSON only.`
          }
        ],
        response_format: { type: 'json_object' },
        stream: true,
        max_tokens: 8000,
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
                    const prompts = JSON.parse(buffer);
                    const finalData = JSON.stringify({
                      status: 'completed',
                      prompts
                    });
                    controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                  } catch (e) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: 'Failed to parse prompts' })}\n\n`));
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
                      message: 'Generating prompts...'
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
    console.error('Prompts generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate prompts' }),
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
    parts.push(`Shot Type: ${st.name}`);
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
  
  return parts.join('\n') || 'Use cinematic photorealistic style.';
}

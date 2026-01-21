import { NextRequest } from 'next/server';

interface SelectionItem {
  name: string;
  description?: string;
}

interface Selections {
  imageType?: SelectionItem | null;
  shotType?: SelectionItem | null;
  lighting?: SelectionItem | null;
  camera?: SelectionItem | null;
  focalLength?: SelectionItem | null;
  lensType?: SelectionItem | null;
  filmStock?: SelectionItem | null;
  photographer?: SelectionItem | null;
  movie?: SelectionItem | null;
  filter?: SelectionItem | null;
  aspectRatio?: string;
}

// Build a constructed prompt following the exact structure from Section 6
function buildConstructedPromptTemplate(
  selections: Selections | null,
  subjectPlaceholder: string,
  environmentPlaceholder: string,
  atmospherePlaceholder: string,
  shotType?: string
): string {
  const parts: string[] = [];
  
  parts.push('Create a sequence of 9 cinematic film stills that tell a short story');
  
  if (selections?.imageType) {
    parts.push(`, a ${selections.imageType.name} image of a`);
  }
  
  const shot = shotType || selections?.shotType?.name;
  if (shot) {
    parts.push(` ${shot} of`);
  }
  
  parts.push(` ${subjectPlaceholder}`);
  parts.push(`, set in ${environmentPlaceholder}`);
  
  if (selections?.lighting) {
    parts.push(`, illuminated by ${selections.lighting.name} with ${selections.lighting.description || ''}`);
  }
  
  parts.push(`, creating an ${atmospherePlaceholder} atmosphere and mood`);
  
  if (selections?.camera) {
    parts.push(`. ${selections.camera.name} with ${selections.camera.description || ''}`);
  }
  
  if (selections?.focalLength || selections?.lensType) {
    const focalPart = selections?.focalLength?.name || '';
    const lensPart = selections?.lensType?.name || '';
    const lensDesc = selections?.lensType?.description || '';
    if (focalPart || lensPart) {
      parts.push(`. ${focalPart} ${lensPart}${lensDesc ? ` with ${lensDesc}` : ''}`);
    }
  }
  
  if (selections?.filmStock) {
    parts.push(`. ${selections.filmStock.name} with ${selections.filmStock.description || ''}`);
  }
  
  if (selections?.photographer) {
    parts.push(`. In the style of photographer ${selections.photographer.name} with ${selections.photographer.description || ''}`);
  }
  
  if (selections?.movie) {
    parts.push(`. With the visual aesthetic of the movie ${selections.movie.name} with ${selections.movie.description || ''}`);
  }
  
  if (selections?.filter) {
    parts.push(`. Applied effects: ${selections.filter.name}, ${selections.filter.description || ''}`);
  }
  
  if (selections?.aspectRatio) {
    parts.push(`. Aspect ratio: ${selections.aspectRatio}`);
  }
  
  parts.push('. No blurred faces.');
  
  return parts.join('');
}

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
    
    // Build example templates showing the exact constructed prompt format
    const characterPromptTemplate = buildConstructedPromptTemplate(
      selections,
      '[DETAILED CHARACTER DESCRIPTION with physical features, clothing, expression]',
      '[CHARACTER\'S TYPICAL ENVIRONMENT]',
      '[CHARACTER\'S EMOTIONAL STATE/MOOD]',
      'MEDIUM SHOT'
    );
    
    const environmentPromptTemplate = buildConstructedPromptTemplate(
      selections,
      '[ENVIRONMENT ESTABLISHING SHOT - architectural elements, props, fixtures]',
      '[FULL ENVIRONMENT DESCRIPTION with materials, textures, spatial layout]',
      '[ENVIRONMENT MOOD/ATMOSPHERE]',
      'WIDE SHOT'
    );

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
            role: 'system',
            content: `You are an expert at creating highly detailed, production-ready image generation prompts for film and television production. Your prompts must follow the EXACT Constructed Prompt structure provided below - this ensures visual consistency across the entire production.

CRITICAL: Every prompt you generate MUST follow the exact template structure provided. Fill in the [BRACKETED] sections with specific content while keeping all visual specifications exactly as provided.`
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

=== CONSTRUCTED PROMPT TEMPLATE FOR CHARACTERS ===
Each character prompt MUST follow this EXACT structure:

${characterPromptTemplate}

=== CONSTRUCTED PROMPT TEMPLATE FOR ENVIRONMENTS ===
Each environment prompt MUST follow this EXACT structure:

${environmentPromptTemplate}

=== WHAT YOU MUST FILL IN ===

FOR CHARACTERS - Fill in [BRACKETED] sections with:
1. [DETAILED CHARACTER DESCRIPTION] - Include:
   - Full physical description: exact age, height, body type/build, face shape
   - Hair: color, length, style, texture
   - Eyes: color, shape, expression
   - Skin: tone, texture, any distinguishing marks
   - Facial features: nose, lips, jaw, eyebrows
   - Clothing: specific garments, colors, textures, condition
   - Accessories: jewelry, glasses, watches
   - Posture and body language
   
2. [CHARACTER'S TYPICAL ENVIRONMENT] - The setting where this character is most often seen

3. [CHARACTER'S EMOTIONAL STATE/MOOD] - Their default emotional presentation

FOR ENVIRONMENTS - Fill in [BRACKETED] sections with:
1. [ENVIRONMENT ESTABLISHING SHOT] - Key visual elements, architectural features, props

2. [FULL ENVIRONMENT DESCRIPTION] - Include:
   - Location type and architectural style
   - Dimensions and spatial layout
   - Wall/floor/ceiling materials and colors
   - Practical lights and fixtures
   - Specific props and set dressing (5-10 items)
   - Textures and surfaces
   - Any supernatural/eerie elements
   
3. [ENVIRONMENT MOOD/ATMOSPHERE] - The emotional tone of the space

=== VISUAL SPECIFICATIONS (KEEP THESE EXACTLY AS SHOWN IN TEMPLATE) ===
${styleContext}

=== CRYPTID JOURNAL SPECIFIC GUIDELINES ===
- The Host: Shadowy, mysterious government informant figure in the underground facility
- Interviewee: Witness in stark, dimly-lit interview room setting
- Underground Facility: Dark, cavernous archive with mysterious artifacts
- Interview Room: Concrete walls, single overhead light, metal chair, stark and clinical

IMPORTANT: Create prompts for EVERY character and EVERY location. Each prompt MUST follow the exact template structure.

Respond in JSON format:
{
  "characterPrompts": [
    {
      "name": "CHARACTER NAME",
      "prompt": "THE COMPLETE CONSTRUCTED PROMPT with all [BRACKETED] sections filled in"
    }
  ],
  "environmentPrompts": [
    {
      "name": "ENVIRONMENT NAME", 
      "prompt": "THE COMPLETE CONSTRUCTED PROMPT with all [BRACKETED] sections filled in"
    }
  ]
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

function buildStyleContext(selections: Selections | null): string {
  if (!selections) return 'Use cinematic photorealistic style.';
  
  const parts: string[] = [];
  
  if (selections.imageType) {
    parts.push(`Image Style: ${selections.imageType.name}`);
  }
  if (selections.shotType) {
    parts.push(`Shot Type: ${selections.shotType.name}`);
  }
  if (selections.lighting) {
    parts.push(`Lighting: ${selections.lighting.name} - ${selections.lighting.description || ''}`);
  }
  if (selections.camera) {
    parts.push(`Camera: ${selections.camera.name} - ${selections.camera.description || ''}`);
  }
  if (selections.focalLength) {
    parts.push(`Focal Length: ${selections.focalLength.name} - ${selections.focalLength.description || ''}`);
  }
  if (selections.lensType) {
    parts.push(`Lens: ${selections.lensType.name} - ${selections.lensType.description || ''}`);
  }
  if (selections.filmStock) {
    parts.push(`Film Stock: ${selections.filmStock.name} - ${selections.filmStock.description || ''}`);
  }
  if (selections.photographer) {
    parts.push(`Photographer Style: ${selections.photographer.name} - ${selections.photographer.description || ''}`);
  }
  if (selections.movie) {
    parts.push(`Movie Style: ${selections.movie.name} - ${selections.movie.description || ''}`);
  }
  if (selections.filter) {
    parts.push(`Filter Effect: ${selections.filter.name} - ${selections.filter.description || ''}`);
  }
  if (selections.aspectRatio) {
    parts.push(`Aspect Ratio: ${selections.aspectRatio}`);
  }
  
  return parts.join('\n') || 'Use cinematic photorealistic style.';
}

import { NextRequest } from 'next/server';
import { getLLMConfig } from '@/lib/llm';
import { trackUsage } from '@/lib/usage-tracker';

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

// Build a single prompt following the exact Constructed Prompt structure from Section 6
function buildConstructedPrompt(
  selections: Selections | null,
  subjectAction: string,
  environment: string,
  atmosphere: string,
): string {
  const parts: string[] = [];
  
  parts.push('Create a multi-shot of 4 cinematic film stills that tell a short story');
  
  if (selections?.imageType) {
    parts.push(`, a ${selections.imageType.name} image of a`);
  }
  
  // SECTION 2: Subject & Action (populated from storyboard block)
  if (subjectAction) {
    parts.push(` ${subjectAction}`);
  }
  
  // SECTION 2: Environment (populated from storyboard block)
  if (environment) {
    parts.push(`, set in ${environment}`);
  }
  
  // SECTION 3: Lighting
  if (selections?.lighting) {
    parts.push(`, illuminated by ${selections.lighting.name} with ${selections.lighting.description || ''}`);
  }
  
  // SECTION 3: Atmosphere / Mood (populated from storyboard block)
  if (atmosphere) {
    parts.push(`, creating an ${atmosphere} atmosphere and mood`);
  }
  
  // SECTION 4: Camera Body
  if (selections?.camera) {
    parts.push(`. ${selections.camera.name} with ${selections.camera.description || ''}`);
  }
  
  // SECTION 4: Focal Length & Lens Type (only include focal length if provided)
  if (selections?.focalLength || selections?.lensType) {
    const focalPart = selections?.focalLength?.name || '';
    const lensPart = selections?.lensType?.name || '';
    const lensDesc = selections?.lensType?.description || '';
    const lensCombined = [focalPart, lensPart].filter(Boolean).join(' ');
    if (lensCombined) {
      parts.push(`. ${lensCombined}${lensDesc ? ` with ${lensDesc}` : ''}`);
    }
  }
  
  // SECTION 4: Film Stock
  if (selections?.filmStock) {
    parts.push(`. ${selections.filmStock.name} with ${selections.filmStock.description || ''}`);
  }
  
  // SECTION 5: Photographer Style
  if (selections?.photographer) {
    parts.push(`. In the style of photographer ${selections.photographer.name} with ${selections.photographer.description || ''}`);
  }
  
  // SECTION 5: Movie Style
  if (selections?.movie) {
    parts.push(`. With the visual aesthetic of the movie ${selections.movie.name} with ${selections.movie.description || ''}`);
  }
  
  // SECTION 5: Filter Effect
  if (selections?.filter) {
    parts.push(`. Applied effects: ${selections.filter.name}, ${selections.filter.description || ''}`);
  }
  
  // SECTION 4: Aspect Ratio
  if (selections?.aspectRatio) {
    parts.push(`. Aspect ratio: ${selections.aspectRatio}`);
  }
  
  parts.push('. No blurred faces.');
  
  return parts.join('');
}

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

    // Build the style context from selections for the LLM reference
    const styleContext = buildStyleContext(selections);
    
    // Build an example constructed prompt to show the LLM the exact format
    const examplePrompt = buildConstructedPrompt(
      selections,
      '[SUBJECT performing ACTION]',
      '[ENVIRONMENT DESCRIPTION]',
      '[ATMOSPHERE/MOOD]'
    );

    const llm = await getLLMConfig();
    const response = await fetch(llm.baseUrl, {
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
            content: `You are an expert storyboard artist and cinematographer. Your task is to break down screenplays into detailed storyboard blocks, each representing approximately 30 seconds of screen time.

CRITICAL: Each storyboard block prompt MUST follow the EXACT Constructed Prompt structure below. You will fill in the [BRACKETED] sections with specific content from each scene while keeping all other visual specifications exactly as provided.`
          },
          {
            role: 'user',
            content: `Break down this screenplay into ${blockCount} storyboard blocks (each ~30 seconds of screen time).

SCREENPLAY:
${screenplay.substring(0, 12000)}

=== CONSTRUCTED PROMPT TEMPLATE ===
Each storyboard block prompt MUST follow this EXACT structure:

${examplePrompt}

=== WHAT YOU MUST FILL IN FOR EACH BLOCK ===

⚠️ CRITICAL CHARACTER LIMITS - STRICTLY ENFORCE THESE:
- SUBJECT & ACTION: MAXIMUM 250 CHARACTERS
- ENVIRONMENT: MAXIMUM 150 CHARACTERS

For each storyboard block, you will populate these bracketed sections with scene-specific content:

1. [SUBJECT performing ACTION] - MUST BE 250 CHARACTERS OR LESS
   Be concise but descriptive. Prioritize: character identity, key visual trait, specific action.
   Examples (good): "The Host, shadowy figure in dark suit, emerging from behind ancient filing cabinets" (82 chars)
   Examples (good): "The Interviewee, middle-aged woman with haunted eyes, recounting her terrifying encounter" (91 chars)
   Examples (good): "A young man fleeing through fog-shrouded woods, terror on his face" (66 chars)

2. [ENVIRONMENT DESCRIPTION] - MUST BE 150 CHARACTERS OR LESS
   Focus on: location type, 2-3 key atmospheric details.
   Examples (good): "a cavernous underground archive with towering shelves of mysterious artifacts" (77 chars)
   Examples (good): "a stark concrete interview room with single harsh overhead light" (64 chars)
   Examples (good): "a moonlit forest clearing with twisted oaks and rolling fog" (59 chars)

3. [ATMOSPHERE/MOOD] - Keep brief, 1-3 descriptive words
   Examples: "ominous and foreboding"
   Examples: "tense and claustrophobic"
   Examples: "terrifying and chaotic"

=== VISUAL STYLE SPECIFICATIONS (KEEP THESE EXACTLY AS SHOWN) ===
${styleContext}

=== LOCATION GUIDELINES ===
- Match the visual style and atmosphere described in the screenplay for each location
- Maintain visual consistency across all storyboard blocks
- Use the screenplay's scene descriptions to guide lighting, mood, and set dressing choices

=== OUTPUT FORMAT ===
Respond in JSON format:
{
  "blocks": [
    {
      "blockNumber": 1,
      "timestampStart": "00:00",
      "timestampEnd": "00:30",
      "scene": "INT. UNDERGROUND FACILITY - NIGHT",
      "location": "Underground Facility",
      "subjectAction": "The specific subject and action description",
      "environment": "The specific environment description",
      "atmosphere": "The specific atmosphere/mood",
      "shotType": "MEDIUM SHOT",
      "lighting": "Specific lighting notes for this block",
      "prompt": "THE COMPLETE CONSTRUCTED PROMPT with all [BRACKETED] sections filled in with this block's specific content",
      "notes": "Cinematography and mood notes"
    }
  ],
  "shotlist": {
    "Location Name": [
      {
        "blockNumber": 1,
        "shotType": "MEDIUM SHOT",
        "action": "Brief action description",
        "prompt": "The full constructed prompt"
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

IMPORTANT: 
- The "prompt" field must be the COMPLETE constructed prompt following the exact template structure
- Do NOT include shot type or camera angle in the prompt text
- Keep visual specifications consistent across all blocks

Respond with raw JSON only.`
          }
        ],
        response_format: { type: 'json_object' },
        stream: true,
        max_tokens: 15000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    trackUsage({ eventType: 'storyboard_generate', apiModel: llm.model, apiType: 'llm' });

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

function buildStyleContext(selections: Selections | null): string {
  if (!selections) return 'Use cinematic photorealistic style.';
  
  const parts: string[] = [];
  
  if (selections.imageType) {
    parts.push(`Image Style: ${selections.imageType.name}`);
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

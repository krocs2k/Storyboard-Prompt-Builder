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

// Build a constructed prompt following the exact structure from Section 6
function buildConstructedPromptTemplate(
  selections: Selections | null,
  subjectPlaceholder: string,
  environmentPlaceholder: string,
  atmospherePlaceholder: string,
): string {
  const parts: string[] = [];
  
  parts.push('Create a cinematic film still');
  
  if (selections?.imageType) {
    parts.push(`, a ${selections.imageType.name} image of a`);
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
    const lensCombined = [focalPart, lensPart].filter(Boolean).join(' ');
    if (lensCombined) {
      parts.push(`. ${lensCombined}${lensDesc ? ` with ${lensDesc}` : ''}`);
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
    );
    
    const environmentPromptTemplate = buildConstructedPromptTemplate(
      selections,
      '[ENVIRONMENT ESTABLISHING SHOT - architectural elements, props, fixtures]',
      '[FULL ENVIRONMENT DESCRIPTION with materials, textures, spatial layout]',
      '[ENVIRONMENT MOOD/ATMOSPHERE]',
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
            content: `You are an expert at creating highly detailed, production-ready image generation prompts for film and television production. Your prompts must follow the EXACT Constructed Prompt structure provided below - this ensures visual consistency across the entire production.

CRITICAL: Every prompt you generate MUST follow the exact template structure provided. Fill in the [BRACKETED] sections with specific content while keeping all visual specifications exactly as provided.`
          },
          {
            role: 'user',
            content: `Create DETAILED image generation prompts for EVERY character and environment in this screenplay.

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

⚠️ CRITICAL CHARACTER LIMITS - YOU MUST STRICTLY ADHERE TO THESE:
- SUBJECT & ACTION description: MAXIMUM 250 CHARACTERS (includes character description, action, pose)
- ENVIRONMENT description: MAXIMUM 150 CHARACTERS (the "set in..." portion)

FOR CHARACTERS - Fill in [BRACKETED] sections with:
1. [DETAILED CHARACTER DESCRIPTION] - MUST BE 250 CHARACTERS OR LESS. Prioritize:
   - Most distinctive physical features (age, build, defining characteristics)
   - Key clothing elements and colors
   - Current action/pose
   - Essential expression
   Example (good - 180 chars): "A weathered 50-year-old man with silver-streaked hair, deep-set eyes, wearing a worn leather jacket, standing tensely with arms crossed, suspicious expression"
   
2. [CHARACTER'S TYPICAL ENVIRONMENT] - MUST BE 150 CHARACTERS OR LESS. Focus on:
   - Primary location type
   - Key atmospheric details
   - Essential props/elements
   Example (good - 85 chars): "a dimly lit underground bunker with concrete walls, flickering fluorescent lights"

3. [CHARACTER'S EMOTIONAL STATE/MOOD] - Keep brief (1-3 words)

FOR ENVIRONMENTS - Fill in [BRACKETED] sections with:
1. [ENVIRONMENT ESTABLISHING SHOT] - MUST BE 250 CHARACTERS OR LESS. Prioritize:
   - Main architectural elements
   - Key props and fixtures
   - Dominant visual features
   
2. [FULL ENVIRONMENT DESCRIPTION] - MUST BE 150 CHARACTERS OR LESS. Focus on:
   - Location type and primary atmosphere
   - Most important visual elements
   - Key textures/materials
   Example (good - 120 chars): "abandoned warehouse with rusted metal beams, broken windows letting in moonlight, scattered debris on concrete floor"
   
3. [ENVIRONMENT MOOD/ATMOSPHERE] - Keep brief (1-3 words)

=== VISUAL SPECIFICATIONS (KEEP THESE EXACTLY AS SHOWN IN TEMPLATE) ===
${styleContext}

=== SCREENPLAY-SPECIFIC GUIDELINES ===
- Use the character and environment descriptions from the screenplay to guide visual details
- Maintain visual consistency with the tone and genre of the screenplay
- Ensure each character prompt captures their unique physical traits and wardrobe
- Ensure each environment prompt captures the specific atmosphere and setting details

=== VOICE PROMPTS FOR HUME.AI (CHARACTERS ONLY) ===
For EACH character, also create a detailed VOICE PROMPT that can be used by hume.ai to generate a custom voice. The voice prompt should describe:

1. **Pitch & Range**: Low/medium/high pitch, vocal range, register
2. **Tone & Quality**: Raspy, smooth, gravelly, nasal, breathy, resonant, warm, cold, thin, rich, husky, silky
3. **Pace & Rhythm**: Speaking speed (slow, measured, rapid), pauses, cadence, rhythmic patterns
4. **Accent & Dialect**: Regional accent, international accent, speech patterns unique to background
5. **Age Quality**: How age affects the voice (youthful energy, mature depth, elderly weathering)
6. **Emotional Undertone**: Default emotional quality (anxious, confident, weary, haunted, authoritative)
7. **Distinctive Characteristics**: Vocal quirks, breath patterns, tendency to trail off, emphatic delivery, whisper quality, etc.
8. **Character-Specific Context**: How their experiences/trauma/personality manifest in their voice

Example Voice Prompt:
"A deep, gravelly male voice with a slow, deliberate pace. Low pitch with rich resonance, carrying the weight of decades of classified secrets. Slightly husky quality with occasional whispered emphasis on key words. Measured pauses between phrases create tension. Subtle hints of a Midwestern American accent, weathered by age. Authoritative yet conspiratorial tone, as if sharing forbidden knowledge. Breath audible before important revelations."

IMPORTANT: Create prompts for EVERY character and EVERY location. Each prompt MUST follow the exact template structure.

Respond in JSON format:
{
  "characterPrompts": [
    {
      "name": "CHARACTER NAME",
      "prompt": "THE COMPLETE CONSTRUCTED PROMPT with all [BRACKETED] sections filled in",
      "voicePrompt": "DETAILED VOICE DESCRIPTION for hume.ai voice generation",
      "subjectDescription": "The SUBJECT & ACTION portion only (what you filled in for the subject placeholder)",
      "environmentDescription": "The ENVIRONMENT portion only (what you filled in for the environment placeholder)",
      "atmosphereDescription": "The ATMOSPHERE/MOOD portion only (1-3 words)"
    }
  ],
  "environmentPrompts": [
    {
      "name": "ENVIRONMENT NAME", 
      "prompt": "THE COMPLETE CONSTRUCTED PROMPT with all [BRACKETED] sections filled in",
      "subjectDescription": "The SUBJECT & ACTION portion only (the establishing shot description)",
      "environmentDescription": "The ENVIRONMENT portion only (the full environment description)",
      "atmosphereDescription": "The ATMOSPHERE/MOOD portion only (1-3 words)"
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

    trackUsage({ eventType: 'prompt_generate', apiModel: llm.model, apiType: 'llm', provider: llm.provider });

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

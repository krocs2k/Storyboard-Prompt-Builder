import { NextRequest } from 'next/server';
import { getLLMConfig } from '@/lib/llm';
import { storyGenres } from '@/lib/data/story-genres';
import { trackUsage } from '@/lib/usage-tracker';

// YouTube transcript format - transforms testimonials/interviews into documentary-style screenplays
const YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT = `You are an expert screenplay writer specializing in transforming testimonials, interviews, and transcripts into compelling documentary-style screenplays.

IMPORTANT: Create an original, descriptive TITLE for the screenplay based on the story content. The title should reflect the subject matter and tone of the story.

SHOW FORMAT & TONE:
- NON-INTERACTIVE format - no direct interaction between host and interviewees
- Dark, mysterious, atmospheric tone appropriate to the subject matter
- The Host speaks as if revealing important or little-known information
- Re-enactments are SILENT (no dialogue) - narrated by the interviewee's voice-over
- Build drama, suspense, and entertainment value

EPISODE STRUCTURE:
1. COLD OPEN - Brief mysterious teaser of the most dramatic moment
2. HOST INTRO - The Host introduces the case from a thematic setting appropriate to the story
3. INTERVIEWEE INTRODUCTION - The witness begins telling their story directly to camera
4. RE-ENACTMENT SEQUENCES - Silent dramatic recreations of events as the interviewee narrates via voice-over. Highly cinematic, atmospheric. NO DIALOGUE during re-enactments.
5. INTERVIEW CUTBACKS - During dramatic moments, cut back to the interviewee reacting, showing emotion
6. CLIMAX RE-ENACTMENT - The most intense moment, all silent with interviewee V.O.
7. AFTERMATH - Interviewee describes what happened after, the impact on their life
8. HOST WRAP-UP - Host gives closing remarks, hints at larger implications

SCREENPLAY FORMAT:
- Standard screenplay format with SCENE HEADINGS (INT./EXT. LOCATION - TIME)
- Use (V.O.) for interviewee voice-over during re-enactments
- Mark HOST scenes clearly
- Mark INTERVIEW scenes for witness segments
- RE-ENACTMENT scenes should have NO DIALOGUE - only action descriptions and V.O.

CREATIVE DIRECTION:
- Transform source material into a COMPELLING narrative with dramatic structure
- Add suspense, tension, and atmospheric details
- Create vivid, cinematic re-enactment descriptions
- Make the interviewee's account feel authentic and emotionally resonant
- The Host should feel knowledgeable and engaging
- Change ALL names for privacy

Pacing: Approximately 1 page = 1 minute of screen time.

REQUIRED OUTPUT SECTIONS:
After the screenplay, include:
---CHARACTER DESCRIPTIONS---
For EACH character provide: Full name, age, physical appearance (height, build, hair color/style, eye color, skin tone, distinguishing features), clothing/wardrobe, demeanor, emotional state, mannerisms

---ENVIRONMENT DESCRIPTIONS---
For EACH location provide: Detailed physical description, lighting conditions, atmosphere/mood, specific props and set dressing, sounds, textures, colors, time of day, weather if applicable`;

// Standard screenplay format - used for story idea/concept sources
const STANDARD_SCREENPLAY_SYSTEM_PROMPT = `You are an expert screenplay writer specializing in crafting compelling narratives for film and television. You write professional screenplays in standard industry format.

SCREENPLAY FORMAT:
- Standard screenplay format with SCENE HEADINGS (INT./EXT. LOCATION - TIME)
- Proper character introductions with action lines
- Natural, compelling dialogue
- Clear action descriptions that are visually descriptive
- Professional formatting with scene transitions

CREATIVE DIRECTION:
- Create a compelling narrative with proper dramatic structure (setup, confrontation, resolution)
- Develop well-rounded characters with clear motivations
- Build tension, drama, and emotional engagement
- Write visually descriptive action lines for cinematic storytelling
- Craft authentic dialogue that reveals character

Pacing: Approximately 1 page = 1 minute of screen time.

REQUIRED OUTPUT SECTIONS:
After the screenplay, include:
---CHARACTER DESCRIPTIONS---
For EACH character provide: Full name, age, physical appearance (height, build, hair color/style, eye color, skin tone, distinguishing features), clothing/wardrobe, demeanor, emotional state, mannerisms

---ENVIRONMENT DESCRIPTIONS---
For EACH location provide: Detailed physical description, lighting conditions, atmosphere/mood, specific props and set dressing, sounds, textures, colors, time of day, weather if applicable`;

// PROMO/AD format - used for promotional and advertising content
function buildPromoAdSystemPrompt(genreData: { name: string; personas?: Array<{ role: string; background: string }> }): string {
  const personaDescriptions = genreData.personas?.map((p, i) => 
    `${i + 1}. **${p.role}**: ${p.background}`
  ).join('\n') || '';

  return `You are a collaborative team of world-class experts crafting an outstanding ${genreData.name.toLowerCase()} script. Your team consists of:

${personaDescriptions}

Together, you write scripts that are strategically sound, emotionally compelling, visually cinematic, and commercially effective.

SCRIPT FORMAT:
- Standard screenplay format with SCENE HEADINGS (INT./EXT. LOCATION - TIME)
- Visual storytelling with cinematic action descriptions
- Compelling narration/voice-over where appropriate
- On-screen text/supers for key messages
- Clear brand moments and product/service showcases
- Strong opening hook and memorable closing with call to action

CREATIVE DIRECTION:
- Open with an attention-grabbing hook in the first 3 seconds
- Build emotional connection through relatable scenarios or aspirational imagery
- Showcase the product/service/brand naturally within the narrative
- Use visual metaphors and cinematic techniques to elevate the message
- End with a clear, compelling call to action
- Every frame should serve the brand story

Pacing: Approximately 1 page = 1 minute of screen time.

REQUIRED OUTPUT SECTIONS:
After the script, include:
---CHARACTER DESCRIPTIONS---
For EACH character/talent provide: Full description, appearance, wardrobe, demeanor, role in the narrative

---ENVIRONMENT DESCRIPTIONS---
For EACH location provide: Detailed physical description, lighting conditions, atmosphere/mood, specific props and set dressing, brand integration elements`;
}

export async function POST(request: NextRequest) {
  try {
    const { sourceType, transcript, storyIdea, storyConcept, runtime, genre } = await request.json();
    
    if (!runtime || runtime < 1 || runtime > 240) {
      return new Response(
        JSON.stringify({ error: 'Runtime must be between 1 and 240 minutes' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let userPrompt = '';
    let systemPrompt = '';

    // Check if this is a promo/ad genre
    const genreData = genre ? storyGenres.find(g => g.name === genre || g.id === genre) : null;
    const isPromoAd = genreData?.id === 'promo' || genreData?.id === 'advertisement';
    
    if (sourceType === 'youtube') {
      // YouTube sources use documentary transcript format
      if (!transcript) {
        return new Response(
          JSON.stringify({ error: 'Transcript is required for YouTube source' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      systemPrompt = YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT;
      userPrompt = `Transform this testimonial/transcript into a ${runtime}-minute documentary-style episode screenplay:

TRANSCRIPT:
${transcript}

REQUIREMENTS:
1. Extract and adapt the core story from the transcript
2. Create an original, descriptive TITLE for the screenplay based on the story content
3. Take CREATIVE LIBERTY to craft a compelling narrative with drama, suspense, and entertainment value
4. Follow the documentary format strictly:
   - Cold open teaser
   - Host intro from a thematic setting appropriate to the story
   - Interviewee telling their story
   - Silent re-enactments with interviewee voice-over narration (NO DIALOGUE in re-enactments)
   - Cut back to interviewee during dramatic moments
   - Host wrap-up
5. Change ALL names to protect privacy
6. Total runtime: approximately ${runtime} minutes (${runtime} pages)
7. Make EVERY character and environment visually specific and detailed

Provide the complete screenplay, then REQUIRED sections:

---CHARACTER DESCRIPTIONS---
For EACH character (including Host, Interviewee, and ALL re-enactment characters):
- Full name
- Age
- Physical appearance: height, build, hair color/style, eye color, skin tone, facial features
- Clothing/wardrobe details
- Demeanor and mannerisms
- Emotional state

---ENVIRONMENT DESCRIPTIONS---
For EACH location (Host setting, Interview Room, ALL re-enactment locations):
- Detailed physical description
- Lighting conditions (specific sources, color temperature, shadows)
- Atmosphere and mood
- Props and set dressing
- Sounds and textures
- Time of day
- Weather/environmental conditions if applicable`;
    } else if (sourceType === 'concept') {
      // Story idea sources use STANDARD screenplay format
      if (!storyConcept) {
        return new Response(
          JSON.stringify({ error: 'Story concept is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      systemPrompt = isPromoAd && genreData ? buildPromoAdSystemPrompt(genreData) : STANDARD_SCREENPLAY_SYSTEM_PROMPT;
      
      if (isPromoAd) {
        userPrompt = `Create a ${runtime}-minute ${genreData?.name?.toLowerCase() || 'promotional'} video script based on this concept:

CONCEPT:
${storyConcept}

REQUIREMENTS:
1. Craft a compelling ${genreData?.name?.toLowerCase() || 'promotional'} script with strong persuasive structure
2. Use professional video production format:
   - Scene headings (INT./EXT. LOCATION - TIME)
   - Talent/presenter introductions with action descriptions
   - Voiceover narration and on-screen text callouts
   - Dynamic visual directions and transitions
   - Product/service showcase moments
3. Create engaging on-screen talent with brand-aligned energy
4. Build audience engagement and drive toward a clear call-to-action
5. Total runtime: approximately ${runtime} minutes
6. Make EVERY talent appearance, product shot, and environment visually specific and detailed

Provide the complete script, then REQUIRED sections:

---CHARACTER DESCRIPTIONS---
For EACH on-screen talent, presenter, or featured person:
- Full name / Role
- Age range
- Physical appearance: height, build, hair color/style, eye color, skin tone, facial features
- Wardrobe/styling details (brand-appropriate)
- On-screen energy and demeanor
- Emotional tone

---ENVIRONMENT DESCRIPTIONS---
For EACH location or set:
- Detailed physical description
- Lighting setup (specific sources, color temperature, brand mood)
- Atmosphere and visual tone
- Props, products, and set dressing
- Background elements and textures
- Time of day
- Overall production design aesthetic`;
      } else {
        userPrompt = `Create a ${runtime}-minute screenplay based on this story concept:

CONCEPT:
${storyConcept}

REQUIREMENTS:
1. Craft a compelling narrative with proper dramatic structure
2. Use standard screenplay format:
   - Scene headings (INT./EXT. LOCATION - TIME)
   - Character introductions with action descriptions
   - Natural dialogue
   - Cinematic action lines
3. Create well-developed characters with clear motivations
4. Build tension and emotional engagement throughout
5. Total runtime: approximately ${runtime} minutes (${runtime} pages)
6. Make EVERY character and environment visually specific and detailed

Provide the complete screenplay, then REQUIRED sections:

---CHARACTER DESCRIPTIONS---
For EACH character:
- Full name
- Age
- Physical appearance: height, build, hair color/style, eye color, skin tone, facial features
- Clothing/wardrobe details
- Demeanor and mannerisms
- Emotional state

---ENVIRONMENT DESCRIPTIONS---
For EACH location:
- Detailed physical description
- Lighting conditions (specific sources, color temperature, shadows)
- Atmosphere and mood
- Props and set dressing
- Sounds and textures
- Time of day
- Weather/environmental conditions if applicable`;
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid source type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: true,
        max_tokens: 12000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    trackUsage({ eventType: 'screenplay_generate', apiModel: llm.model, apiType: 'llm' });

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
                  const finalData = JSON.stringify({
                    status: 'completed',
                    screenplay: buffer
                  });
                  controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  buffer += content;
                  if (content) {
                    const progressData = JSON.stringify({
                      status: 'streaming',
                      content: content
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
    console.error('Screenplay generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate screenplay' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

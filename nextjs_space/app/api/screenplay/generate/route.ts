import { NextRequest } from 'next/server';

// CRYPTID JOURNAL format - used ONLY for YouTube-sourced content
const CRYPTID_JOURNAL_SYSTEM_PROMPT = `You are an expert screenplay writer for "CRYPTID JOURNAL", a paranormal documentary series with a unique format. The show features a government informant HOST who provides "soft disclosure" from a hidden underground top-secret storage facility.

SHOW FORMAT & TONE:
- NON-INTERACTIVE format - no direct interaction between host and interviewees
- Dark, mysterious, conspiratorial atmosphere
- The Host speaks as if revealing classified information
- Re-enactments are SILENT (no dialogue) - narrated by the interviewee's voice-over
- Build drama, suspense, and entertainment value

EPISODE STRUCTURE:
1. COLD OPEN - Brief mysterious teaser of the most dramatic moment
2. HOST INTRO (Underground Facility) - The Host, in shadows, introduces the case from a secret government archive room filled with filing cabinets and strange artifacts. Mentions this is "declassified testimony" and names have been changed for protection.
3. INTERVIEWEE INTRODUCTION - Cut to the WITNESS sitting alone in a stark, dimly-lit interview room (concrete walls, single overhead light, metal chair). They begin telling their story directly to camera.
4. RE-ENACTMENT SEQUENCES - Silent dramatic recreations of events as the interviewee narrates via voice-over. Highly cinematic, atmospheric. NO DIALOGUE during re-enactments.
5. INTERVIEW CUTBACKS - During particularly dramatic moments, cut back to the interviewee in the dim room reacting, pausing, showing emotion as they recount events.
6. CLIMAX RE-ENACTMENT - The most intense paranormal encounter, all silent with interviewee V.O.
7. AFTERMATH - Interviewee describes what happened after, the impact on their life
8. HOST WRAP-UP (Underground Facility) - Host gives ominous closing remarks, hints at larger implications, suggests there's more the public doesn't know

SCREENPLAY FORMAT:
- Standard screenplay format with SCENE HEADINGS (INT./EXT. LOCATION - TIME)
- Use (V.O.) for interviewee voice-over during re-enactments
- Mark HOST scenes clearly in the underground facility
- Mark INTERVIEW ROOM scenes for witness segments
- RE-ENACTMENT scenes should have NO DIALOGUE - only action descriptions and V.O.

CREATIVE DIRECTION:
- Transform source material into a COMPELLING narrative with dramatic structure
- Add suspense, tension, and atmospheric details
- Create vivid, cinematic re-enactment descriptions
- Make the interviewee's account feel authentic and emotionally resonant
- The Host should feel mysterious, knowledgeable, slightly ominous
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

export async function POST(request: NextRequest) {
  try {
    const { sourceType, transcript, storyIdea, storyConcept, runtime } = await request.json();
    
    if (!runtime || runtime < 5 || runtime > 25) {
      return new Response(
        JSON.stringify({ error: 'Runtime must be between 5 and 25 minutes' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let userPrompt = '';
    let systemPrompt = '';
    
    if (sourceType === 'youtube') {
      // YouTube sources use CRYPTID JOURNAL format
      if (!transcript) {
        return new Response(
          JSON.stringify({ error: 'Transcript is required for YouTube source' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      systemPrompt = CRYPTID_JOURNAL_SYSTEM_PROMPT;
      userPrompt = `Transform this testimonial/transcript into a ${runtime}-minute "CRYPTID JOURNAL" episode screenplay:

TRANSCRIPT:
${transcript}

REQUIREMENTS:
1. Extract and adapt the core paranormal/cryptid story from the transcript
2. Take CREATIVE LIBERTY to craft a compelling narrative with drama, suspense, and entertainment value
3. Follow the CRYPTID JOURNAL format strictly:
   - Cold open teaser
   - Host intro from underground facility (mysterious government informant tone)
   - Interviewee in dim interview room telling their story
   - Silent re-enactments with interviewee voice-over narration (NO DIALOGUE in re-enactments)
   - Cut back to interviewee during dramatic moments
   - Ominous host wrap-up
4. Change ALL names to protect privacy
5. Total runtime: approximately ${runtime} minutes (${runtime} pages)
6. Make EVERY character and environment visually specific and detailed

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
For EACH location (Underground Facility, Interview Room, ALL re-enactment locations):
- Detailed physical description
- Lighting conditions (specific sources, color temperature, shadows)
- Atmosphere and mood
- Props and set dressing
- Sounds and textures
- Time of day
- Weather/environmental conditions if applicable`;
    } else if (sourceType === 'concept') {
      // Story idea sources use STANDARD screenplay format (no CRYPTID JOURNAL modifications)
      if (!storyConcept) {
        return new Response(
          JSON.stringify({ error: 'Story concept is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      systemPrompt = STANDARD_SCREENPLAY_SYSTEM_PROMPT;
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
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid source type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
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

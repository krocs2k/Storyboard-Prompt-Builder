import { NextRequest } from 'next/server';

const GHOSTLY_ENCOUNTERS_SYSTEM_PROMPT = `You are an expert screenplay writer specializing in paranormal documentary-style television shows like "Ghostly Encounters". Your task is to transform real testimonials or story concepts into engaging, dramatic screenplays.

Format Guidelines:
- Use standard screenplay format with SCENE HEADINGS (INT./EXT. LOCATION - TIME)
- Include detailed action descriptions and character dialogue
- Create a compelling host introduction that sets the tone
- Add dramatic re-enactment scenes based on the testimonial
- Include interview-style segments with witnesses
- Create a thoughtful host wrap-up
- Change all names to protect privacy
- Add disclaimer about names being changed

Structure:
1. HOST INTRO - Sets up the episode theme, mentions names have been changed
2. WITNESS INTRODUCTION - Brief intro of the person sharing their story
3. RE-ENACTMENT SCENES - Dramatic recreation of the events
4. INTERVIEW CUTAWAYS - Witness reactions and commentary
5. CLIMAX - The most intense paranormal moment
6. RESOLUTION - How the story concluded
7. HOST WRAP-UP - Reflection on the experience, closing thoughts

Pacing: Approximately 1 page = 1 minute of screen time.

Always include detailed descriptions for:
- Each CHARACTER (age, appearance, demeanor, clothing)
- Each ENVIRONMENT (location details, atmosphere, lighting, props)`;

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
    
    if (sourceType === 'youtube') {
      if (!transcript) {
        return new Response(
          JSON.stringify({ error: 'Transcript is required for YouTube source' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      userPrompt = `Transform this testimonial/transcript into a ${runtime}-minute "Ghostly Encounters" style screenplay:

TRANSCRIPT:
${transcript}

Requirements:
1. Extract the core paranormal story from the transcript
2. Create compelling dramatic re-enactments
3. Change ALL names to protect privacy
4. Add host intro mentioning this is based on reported incidents and names have been changed
5. Total runtime should be approximately ${runtime} minutes (${runtime} pages)
6. Include CHARACTER DESCRIPTIONS section with detailed descriptions for each character
7. Include ENVIRONMENT DESCRIPTIONS section with detailed descriptions for each location

Provide the complete screenplay followed by:

---CHARACTER DESCRIPTIONS---
[List each character with detailed physical description, age, demeanor, clothing]

---ENVIRONMENT DESCRIPTIONS---
[List each location with detailed atmosphere, lighting, props, mood]`;
    } else if (sourceType === 'concept') {
      if (!storyConcept) {
        return new Response(
          JSON.stringify({ error: 'Story concept is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      userPrompt = `Create a ${runtime}-minute "Ghostly Encounters" style screenplay based on this concept:

CONCEPT:
${storyConcept}

Requirements:
1. Create a compelling paranormal narrative
2. Use fictional but realistic-sounding names
3. Add host intro mentioning stories are based on reported incidents
4. Total runtime should be approximately ${runtime} minutes (${runtime} pages)
5. Include CHARACTER DESCRIPTIONS section with detailed descriptions for each character
6. Include ENVIRONMENT DESCRIPTIONS section with detailed descriptions for each location

Provide the complete screenplay followed by:

---CHARACTER DESCRIPTIONS---
[List each character with detailed physical description, age, demeanor, clothing]

---ENVIRONMENT DESCRIPTIONS---
[List each location with detailed atmosphere, lighting, props, mood]`;
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
          { role: 'system', content: GHOSTLY_ENCOUNTERS_SYSTEM_PROMPT },
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

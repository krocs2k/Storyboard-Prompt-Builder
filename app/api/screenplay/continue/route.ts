import { NextRequest } from 'next/server';
import { getLLMConfig } from '@/lib/llm';
import { trackUsage } from '@/lib/usage-tracker';
import { withSonnetSoul } from '@/lib/sonnet-soul-protocol';

const CULTURAL_DIVERSITY_DIRECTIVE = `
CULTURAL DIVERSITY MANDATE:
- Maintain the cultural identities established in previous episodes
- Continue using authentic character names from their established backgrounds
- Expand the world with new culturally specific locales and characters as the story demands
- Physical descriptions should remain consistent with established character appearances`;

const CONTINUATION_SYSTEM_PROMPT = `You are an expert screenplay writer specializing in crafting SERIES and EPISODIC content. You write professional screenplays that continue ongoing storylines while maintaining character consistency, thematic coherence, and narrative momentum across episodes.

SCREENPLAY FORMAT:
- Standard screenplay format with SCENE HEADINGS (INT./EXT. LOCATION - TIME)
- Proper character introductions with action lines
- Natural, compelling dialogue
- Clear action descriptions that are visually descriptive
- Professional formatting with scene transitions

SERIES CONTINUATION RULES:
1. MAINTAIN CHARACTER CONSISTENCY — characters must behave, speak, and look the same as in previous episodes. Their growth should be organic and build on established arcs.
2. HONOR CONTINUITY — reference events, relationships, and consequences from previous episodes. The world has memory.
3. ADVANCE THE STORY — don't repeat or rehash. Push the narrative forward with new developments, escalations, revelations, or complications.
4. DEEPEN RELATIONSHIPS — evolve character dynamics based on shared history.
5. NEW CHALLENGES — introduce fresh obstacles, conflicts, or mysteries while connecting to the ongoing narrative thread.
6. CONSISTENT TONE — maintain the genre, mood, and style established by the series.
7. CALLBACKS — organically reference moments from previous episodes to reward continuity.
8. CLIFFHANGERS & HOOKS — end with story threads that invite further episodes.

CREATIVE DIRECTION:
- Create a compelling narrative with proper dramatic structure (setup, confrontation, resolution)
- Build on existing character arcs — show growth, regression, revelation
- Maintain the established visual and tonal identity of the series
- Introduce new elements that feel natural extensions of the existing world
${CULTURAL_DIVERSITY_DIRECTIVE}

Pacing: Approximately 1 page = 1 minute of screen time.

REQUIRED OUTPUT SECTIONS:
After the screenplay, include:
---CHARACTER DESCRIPTIONS---
For EACH character (both returning and new) provide: Full name, age, physical appearance (height, build, hair color/style, eye color, skin tone, distinguishing features), clothing/wardrobe, demeanor, emotional state, mannerisms. Note any changes from previous episodes.

---ENVIRONMENT DESCRIPTIONS---
For EACH location (both returning and new) provide: Detailed physical description, lighting conditions, atmosphere/mood, specific props and set dressing, sounds, textures, colors, time of day, weather if applicable. Note any changes from previous episodes.`;

export async function POST(request: NextRequest) {
  try {
    const {
      previousEpisodes,  // Array of { title, content, episodeNumber }
      characters,         // Current characters from latest episode
      environments,       // Current environments from latest episode
      genre,              // Genre (stays the same)
      runtime,            // Target runtime for new episode
      newTrope,           // Optional new trope
      newIdea,            // Optional new story idea/direction
      newConcept,         // Optional new concept
      seriesTitle,        // Series/story title
    } = await request.json();

    if (!previousEpisodes || previousEpisodes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one previous episode is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!runtime || runtime < 1 || runtime > 240) {
      return new Response(
        JSON.stringify({ error: 'Runtime must be between 1 and 240 minutes' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const nextEpisodeNumber = previousEpisodes.length + 1;

    // Build series history context — include full content of recent episodes, summaries of older ones
    let seriesContext = '';
    for (const ep of previousEpisodes) {
      const epContent = ep.content || '';
      // For recent episodes (last 2), include more detail
      const isRecent = ep.episodeNumber >= previousEpisodes.length - 1;
      if (isRecent) {
        // Include full screenplay but cap at 30k chars per episode
        const trimmed = epContent.length > 30000
          ? epContent.slice(0, 30000) + '\n[...truncated for length]'
          : epContent;
        seriesContext += `\n\n=== EPISODE ${ep.episodeNumber}: "${ep.title}" (FULL) ===\n${trimmed}`;
      } else {
        // For older episodes, include just the first 5000 chars as summary context
        const summary = epContent.slice(0, 5000);
        seriesContext += `\n\n=== EPISODE ${ep.episodeNumber}: "${ep.title}" (SUMMARY) ===\n${summary}\n[...earlier episode, see characters and events referenced]`;
      }
    }

    // Build character context
    let charContext = '';
    if (characters && characters.length > 0) {
      charContext = '\nESTABLISHED CHARACTERS (maintain consistency):\n';
      characters.forEach((c: { name: string; description?: string }) => {
        charContext += `- ${c.name}: ${c.description || 'No description provided'}\n`;
      });
    }

    // Build environment context
    let envContext = '';
    if (environments && environments.length > 0) {
      envContext = '\nESTABLISHED ENVIRONMENTS (can revisit or introduce new ones):\n';
      environments.forEach((e: { name: string; description?: string }) => {
        envContext += `- ${e.name}: ${e.description || 'No description provided'}\n`;
      });
    }

    // Build optional direction change
    let directionBlock = '';
    if (newTrope || newIdea || newConcept) {
      directionBlock = '\nNEW CREATIVE DIRECTION FOR THIS EPISODE:';
      if (newTrope) directionBlock += `\nNew Trope/Theme: ${newTrope}`;
      if (newIdea) directionBlock += `\nNew Story Direction: ${newIdea}`;
      if (newConcept) directionBlock += `\nNew Concept: ${newConcept}`;
      directionBlock += '\n(Integrate these new elements while maintaining series continuity)';
    }

    const userPrompt = `Write EPISODE ${nextEpisodeNumber} of the series "${seriesTitle || 'Untitled Series'}".

GENRE: ${genre || 'Drama'}
TARGET RUNTIME: ${runtime} minutes (${runtime} pages)

SERIES HISTORY:
${seriesContext}
${charContext}
${envContext}
${directionBlock}

EPISODE ${nextEpisodeNumber} REQUIREMENTS:
1. Create a compelling new episode that CONTINUES the story from where Episode ${nextEpisodeNumber - 1} left off
2. Use the same characters (you may introduce new ones as needed)
3. Reference events and consequences from previous episodes naturally
4. Maintain the established genre (${genre || 'Drama'}) and tone
5. Advance character arcs — show growth, change, or revelation
6. Introduce new conflicts, complications, or mysteries that build on the existing narrative
7. Create a satisfying episode arc (beginning, middle, climax) while leaving threads for future episodes
8. Total runtime: approximately ${runtime} minutes
9. Title this episode with a unique, evocative title (not just "Episode ${nextEpisodeNumber}")
10. Make EVERY character and environment visually specific and detailed

Provide the COMPLETE screenplay for Episode ${nextEpisodeNumber}, then the REQUIRED sections:

---CHARACTER DESCRIPTIONS---
For EACH character (returning AND new):
- Full name
- Age
- Physical appearance: height, build, hair color/style, eye color, skin tone, facial features
- Clothing/wardrobe details (note any changes from previous episodes)
- Demeanor and mannerisms
- Emotional state in this episode
- Relationship to other characters

---ENVIRONMENT DESCRIPTIONS---
For EACH location (returning AND new):
- Detailed physical description
- Lighting conditions
- Atmosphere and mood
- Props and set dressing
- Any changes from how it appeared in previous episodes`;

    const llm = await getLLMConfig('screenplay');
    const useStream = llm.supportsStreaming;
    const response = await fetch(llm.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          { role: 'system', content: withSonnetSoul('screenplay', CONTINUATION_SYSTEM_PROMPT) },
          { role: 'user', content: userPrompt }
        ],
        stream: useStream,
        max_tokens: 12000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`Continue LLM API error ${response.status}:`, errBody);
      throw new Error(`LLM API error: ${response.status} - ${errBody.slice(0, 200)}`);
    }

    trackUsage({ eventType: 'screenplay_continue', apiModel: llm.model, apiType: 'llm', provider: llm.provider });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch {}
        }, 15000);

        try {
          if (!useStream) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'streaming', content })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', screenplay: content })}\n\n`));
            }
          } else {
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let partialRead = '';

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
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', screenplay: buffer })}\n\n`));
                    clearInterval(heartbeat);
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    buffer += content;
                    if (content) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'streaming', content })}\n\n`));
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
            if (buffer) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', screenplay: buffer })}\n\n`));
            }
          }
        } catch (error) {
          console.error('Continue stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: 'Stream processing failed' })}\n\n`));
        } finally {
          clearInterval(heartbeat);
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
    console.error('Screenplay continuation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate episode continuation' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

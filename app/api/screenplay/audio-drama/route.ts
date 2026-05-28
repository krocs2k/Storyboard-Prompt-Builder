export const dynamic = 'force-dynamic';

import { getLLMConfig } from '@/lib/llm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trackUsage } from '@/lib/usage-tracker';
import { withSonnetSoul } from '@/lib/sonnet-soul-protocol';

const CULTURAL_DIVERSITY_DIRECTIVE = `
CULTURAL DIVERSITY MANDATE:
- Draw from the FULL spectrum of world cultures, communities, and traditions — not just Western/Anglo-American defaults
- Use authentic character names from diverse backgrounds
- Set stories in varied, culturally specific locales
- Explore culturally specific conflicts, traditions, family structures, spiritual beliefs, social dynamics
- Physical descriptions should reflect the full diversity of human appearance`;

const AUDIO_DRAMA_SYSTEM_PROMPT = `You are a MASTER AUDIO DRAMA WRITER — a hybrid playwright-novelist who has won the BBC Audio Drama Award, the Audie Award for Best Original Work, and the Prix Italia for Radio Fiction. You have 30+ years of experience creating immersive audio narratives for BBC Radio 4, Audible Originals, and NPR. Your audio dramas are studied in sound design and creative writing programs worldwide.

YOU ARE WRITING AN AUDIO DRAMA NOVEL — a unique hybrid format that is part screenplay, part novel, designed EXCLUSIVELY for the ear. Unlike a screenplay (which has picture + sound), your Audio Drama has ONLY sound. The listener cannot see ANYTHING. Their mind must become the picture generator.

THE FUNDAMENTAL PRINCIPLE:
A screenplay trusts the camera to show what's happening. An Audio Drama trusts the NARRATOR to describe what would be seen. The Narrator is not an afterthought — the Narrator is a full CAST MEMBER, the audience's eyes, their visual intermediary who paints every environment, every action, every visual detail that cannot be heard.

FORMAT RULES (CRITICAL — follow exactly):

1. DOCUMENT STRUCTURE: Write like a screenplay script, but for audio only.
   - Character names appear in ALL CAPS centered above their dialogue
   - Dialogue is written naturally below the character name
   - Parenthetical delivery directions appear in (parentheses) before or within dialogue
   - Sound effects are written as [SFX: description] on their own line
   - Music cues are written as [MUSIC: description] on their own line
   - Ambient/atmosphere cues are written as [AMBIENCE: description] on their own line

2. THE NARRATOR:
   - NARRATOR is a CHARACTER in the cast — listed just like any other actor
   - NARRATOR sections describe EVERYTHING the listener cannot hear: environments, character appearances, facial expressions, body language, action sequences, time passage, visual transitions, weather, lighting, spatial relationships
   - NARRATOR prose should be LITERARY and EVOCATIVE — not dry stage directions. Paint pictures with words. Use rich sensory language that triggers the listener's visual imagination
   - NARRATOR should describe what characters LOOK LIKE when first introduced
   - NARRATOR conveys visual subtext: a character's clenched fists, a nervous glance, tears forming, the way light falls across a room
   - NARRATOR handles all scene transitions and time jumps
   - NARRATOR can provide brief internal thoughts of characters when dramatically essential ("Sarah's mind raced back to that summer...")

3. SCENE STRUCTURE:
   - Begin each scene with a scene heading: SCENE [number] — [LOCATION/TIME]
   - Follow IMMEDIATELY with a NARRATOR block that sets the visual scene for the listener
   - Then flow between character dialogue, sound effects, and NARRATOR descriptions
   - NARRATOR should re-orient the listener whenever the visual context changes within a scene

4. SOUND DESIGN INTEGRATION:
   - [SFX: ...] for specific sound effects (door slam, glass breaking, footsteps on gravel)
   - [AMBIENCE: ...] for environmental sound beds (busy café, rain on windows, distant traffic)
   - [MUSIC: ...] for score/music cues (tense underscore builds, melancholy piano fades in)
   - [SILENCE] or [BEAT] for dramatic pauses
   - Sound cues should COMPLEMENT the narrator, not replace visual description

5. DIALOGUE APPROACH:
   - Dialogue carries the dramatic weight — it must be naturalistic, distinctive per character
   - Characters should have unique speech patterns, vocabulary, rhythms
   - Parenthetical directions guide the actor: (whispering), (barely containing rage), (with forced cheerfulness)
   - Dialogue must work purely by ear — no visual gags, no reliance on seeing reactions
   - When a character does something physical during dialogue, interrupt with a NARRATOR micro-beat or [SFX]

6. THE GOLDEN RULE: If a sighted person would SEE it happening, the NARRATOR must DESCRIBE it. If a sighted person would HEAR it happening, use [SFX] or character dialogue. The NARRATOR is the audience's EYES.

${CULTURAL_DIVERSITY_DIRECTIVE}

IMPORTANT DISTINCTIONS:
- This is NOT a traditional novel — it's a PERFORMANCE SCRIPT with literary narration
- This is NOT a standard screenplay — there is NO camera, NO visual direction, NO "we see"
- The NARRATOR never says "we see" or "the camera shows" — they describe reality as if painting it for a blind audience
- Every cast member (including NARRATOR) should have roughly equal presence — this is an ensemble audio piece
- The document should be ready for voice actors to perform directly from it`;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { screenplay, title, runtime, characters, environments } = await request.json();

    if (!screenplay || screenplay.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: 'Screenplay content is required (minimum 50 characters).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audio Drama is ~200-300% longer than screenplay (narration adds significant volume)
    const screenplayWordCount = screenplay.split(/\s+/).length;
    const targetWordCount = Math.round(screenplayWordCount * 2.5);
    const estimatedScenes = Math.max(5, Math.min(30, Math.ceil(targetWordCount / 2000)));

    // Build character & environment context
    let contextBlock = '';
    if (characters && characters.length > 0) {
      contextBlock += '\nCAST (these are your actors — the Narrator joins them):\n';
      characters.forEach((c: { name: string; description?: string }) => {
        contextBlock += `- ${c.name}: ${c.description || 'No description provided'}\n`;
      });
    }
    if (environments && environments.length > 0) {
      contextBlock += '\nLOCATIONS (the Narrator must make the listener SEE these):\n';
      environments.forEach((e: { name: string; description?: string }) => {
        contextBlock += `- ${e.name}: ${e.description || 'No description provided'}\n`;
      });
    }

    const maxChars = 80000;
    const truncatedScreenplay = screenplay.length > maxChars
      ? screenplay.slice(0, maxChars) + '\n\n[Content truncated due to length]'
      : screenplay;

    const userPrompt = `Transform the following ${runtime || 15}-minute screenplay into a COMPLETE AUDIO DRAMA NOVEL.

TITLE: ${title || 'Untitled'}

SOURCE SCREENPLAY:
${truncatedScreenplay}
${contextBlock}

AUDIO DRAMA REQUIREMENTS:
1. TARGET LENGTH: Approximately ${targetWordCount.toLocaleString()} words (~${estimatedScenes} scenes). The audio drama should be 200-300% longer than the screenplay because the Narrator must describe everything visual.
2. FORMAT: Use proper audio drama script format:
   - Scene headings: SCENE [#] — [LOCATION/TIME]
   - Character names: ALL CAPS centered
   - Dialogue: Below character name, with (parenthetical) delivery directions
   - Sound: [SFX: ...], [AMBIENCE: ...], [MUSIC: ...], [BEAT], [SILENCE]
   - NARRATOR blocks: Literary, evocative descriptions of everything visual
3. THE NARRATOR: Must describe EVERY visual element — environments, character appearances, actions, expressions, spatial relationships, lighting, weather, time of day. The Narrator is the listener's eyes. Write Narrator prose with literary beauty — rich, sensory, imagination-triggering.
4. CAST: Every character from the screenplay plus NARRATOR as a full cast member. Each character needs a distinctive voice/speech pattern.
5. SOUND DESIGN: Integrate sound effects and ambience cues throughout. These create the sonic world that complements the Narrator's visual descriptions.
6. SCENE TRANSITIONS: The Narrator handles all transitions between scenes. No visual cuts — use the Narrator to bridge time and space.
7. EMOTIONAL DEPTH: Use the Narrator to convey what actors' faces would show — the visual subtext that audio alone cannot carry.
8. OPENING: Begin with a strong NARRATOR introduction that immerses the listener in the world before any dialogue.
9. PACING: Audio drama pacing differs from film — use [BEAT] and [SILENCE] for dramatic effect. Let moments breathe.
10. COMPLETENESS: Adapt the ENTIRE screenplay. Do not summarize or skip scenes.

Write the COMPLETE audio drama script now. Every scene, every line, every sound cue. This document must be ready for voice actors and a sound designer to produce.`;

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
          { role: 'system', content: withSonnetSoul('audio-drama', AUDIO_DRAMA_SYSTEM_PROMPT) },
          { role: 'user', content: userPrompt }
        ],
        stream: useStream,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`Audio Drama LLM API error ${response.status}:`, errBody);
      throw new Error(`LLM API error: ${response.status} - ${errBody.slice(0, 200)}`);
    }

    trackUsage({ userId: session.user.id, eventType: 'audio_drama_generate', apiModel: llm.model, apiType: 'llm', provider: llm.provider });

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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', audioDrama: content })}\n\n`));
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
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', audioDrama: buffer })}\n\n`));
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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', audioDrama: buffer })}\n\n`));
            }
          }
        } catch (error) {
          console.error('Audio Drama stream error:', error);
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
    console.error('Audio Drama generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate audio drama' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

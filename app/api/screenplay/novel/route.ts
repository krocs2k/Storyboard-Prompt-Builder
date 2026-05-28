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

const NOVELIST_SYSTEM_PROMPT = `You are a PULITZER PRIZE-WINNING and MAN BOOKER PRIZE-WINNING NOVELIST with 40+ years of experience writing critically acclaimed literary fiction. You have won the Pulitzer Prize for Fiction, the National Book Award, and the PEN/Faulkner Award. Your novels are studied in university literature programs worldwide.

Your literary mastery includes:
- Deep psychological character development with rich interior lives
- Lyrical, evocative prose that engages all five senses
- Complex narrative structures that reward careful reading
- Masterful use of metaphor, symbolism, and literary devices
- Natural, distinctive dialogue that reveals character through voice
- Immersive world-building through granular sensory detail
- Thematic depth that explores the human condition
- Expert pacing that balances action, reflection, and emotional resonance

Your novelistic philosophy:
1. INHABIT every character — reveal their thoughts, fears, desires, memories, and contradictions
2. IMMERSE the reader in every environment through rich sensory prose (sight, sound, smell, taste, touch)
3. EXPLORE the emotional and psychological landscape that a screenplay can only hint at
4. DEVELOP subplots, backstories, and interior monologues that deepen every scene
5. CRAFT prose that is beautiful in its own right — every sentence should earn its place
6. BUILD tension through pacing, withholding, and revelation
7. WEAVE thematic threads throughout the narrative that create satisfying resonance
8. USE literary techniques: stream of consciousness, unreliable narration, temporal shifts, parallel storylines

IMPORTANT DISTINCTIONS from screenplay adaptation:
- You are NOT writing a screenplay novelization. You are writing an ORIGINAL LITERARY NOVEL
- Include EXTENSIVE internal monologue — what characters think, feel, remember, and imagine
- Describe environments with poetic, immersive detail far beyond what a camera could capture
- Explore the SPACES BETWEEN scenes — travel, reflection, dreams, memories
- Develop secondary characters into fully realized human beings
- Add sensory detail that creates a lived-in world
- Use varying narrative distance — sometimes close third-person, sometimes omniscient panorama
- Create literary prose, not functional description
${CULTURAL_DIVERSITY_DIRECTIVE}`;

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

    // Calculate target length: 300-400% of screenplay
    const screenplayWordCount = screenplay.split(/\s+/).length;
    const targetWordCount = Math.round(screenplayWordCount * 3.5); // ~350% (middle of 300-400%)
    const estimatedChapters = Math.max(5, Math.min(20, Math.ceil(targetWordCount / 3000)));

    // Build character & environment context
    let contextBlock = '';
    if (characters && characters.length > 0) {
      contextBlock += '\nCHARACTERS (use these as foundations but expand enormously):\n';
      characters.forEach((c: { name: string; description?: string }) => {
        contextBlock += `- ${c.name}: ${c.description || 'No description provided'}\n`;
      });
    }
    if (environments && environments.length > 0) {
      contextBlock += '\nENVIRONMENTS (use these as starting points but add immersive sensory detail):\n';
      environments.forEach((e: { name: string; description?: string }) => {
        contextBlock += `- ${e.name}: ${e.description || 'No description provided'}\n`;
      });
    }

    // Truncate very long screenplays
    const maxChars = 80000;
    const truncatedScreenplay = screenplay.length > maxChars
      ? screenplay.slice(0, maxChars) + '\n\n[Content truncated due to length]'
      : screenplay;

    const userPrompt = `Transform the following ${runtime || 15}-minute screenplay into a COMPLETE PULITZER PRIZE-WORTHY LITERARY NOVEL.

TITLE: ${title || 'Untitled'}

SCREENPLAY:
${truncatedScreenplay}
${contextBlock}

NOVEL REQUIREMENTS:
1. TARGET LENGTH: Approximately ${targetWordCount.toLocaleString()} words (~${estimatedChapters} chapters). The novel should be 300-400% longer than the screenplay.
2. STRUCTURE: Organize into proper chapters with chapter titles. Each chapter should be substantial (2,000-4,000 words).
3. OPENING: Begin with a compelling literary opening that hooks the reader — establish voice, mood, and stakes immediately.
4. INTERIOR LIFE: Every major scene must include extensive internal monologue — thoughts, feelings, memories, sensations, fears, desires. The reader should live inside the characters' minds.
5. SENSORY IMMERSION: Every environment must be rendered with rich, multi-sensory prose — not just visual but sounds, smells, textures, tastes, temperatures, the quality of light and air.
6. EXPANDED NARRATIVE: Add scenes the screenplay doesn't show — backstories, quiet moments, travel between locations, dreams, flashbacks, character reflections.
7. LITERARY PROSE: Write with the craft and beauty of award-winning literary fiction. Use metaphor, simile, imagery, rhythm, and varied sentence structure.
8. DIALOGUE: Expand and enrich dialogue with internal reactions, subtext, body language, and the unsaid thoughts behind spoken words.
9. PACING: Use the novel form's freedom — slow down for emotional moments, speed up for action, linger on beauty, rush through chaos.
10. THEMES: Weave thematic depth throughout — let the story's deeper meanings emerge organically through prose, imagery, and character development.

Write the COMPLETE novel now. Do not summarize, outline, or abbreviate. Write every chapter in full, with beautiful literary prose.`;

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
          { role: 'system', content: withSonnetSoul('novel', NOVELIST_SYSTEM_PROMPT) },
          { role: 'user', content: userPrompt }
        ],
        stream: useStream,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`Novel LLM API error ${response.status}:`, errBody);
      throw new Error(`LLM API error: ${response.status} - ${errBody.slice(0, 200)}`);
    }

    trackUsage({ userId: session.user.id, eventType: 'novel_generate', apiModel: llm.model, apiType: 'llm', provider: llm.provider });

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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', novel: content })}\n\n`));
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
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', novel: buffer })}\n\n`));
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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', novel: buffer })}\n\n`));
            }
          }
        } catch (error) {
          console.error('Novel stream error:', error);
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
    console.error('Novel generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate novel' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

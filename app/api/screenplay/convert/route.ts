export const dynamic = 'force-dynamic';

import { getLLMConfig } from '@/lib/llm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import mammoth from 'mammoth';
import { trackUsage } from '@/lib/usage-tracker';

const CULTURAL_DIVERSITY_DIRECTIVE = `
CULTURAL DIVERSITY MANDATE:
- Draw from the FULL spectrum of world cultures, communities, and traditions — not just Western/Anglo-American defaults
- Use authentic character names from diverse backgrounds: East Asian, South Asian, Southeast Asian, Middle Eastern, African, Latin American, Indigenous, Eastern European, Polynesian, Caribbean, Nordic, Mediterranean, Central Asian, and many more
- Set stories in varied, culturally specific locales — rural villages, megacities, island communities, mountain towns, desert settlements, arctic outposts, tropical coasts, ancient cities, modern suburbs of any country
- Explore culturally specific conflicts, traditions, family structures, spiritual beliefs, social dynamics, and ways of life
- NEVER default to generic Western names like "Jack", "Sarah", "Mike", "Emily" — every character should have a name authentic to their cultural background
- Physical descriptions should reflect the full diversity of human appearance
- When the source material lacks cultural specificity, ADD cultural richness through your adaptation choices`;

const SCREENWRITER_SYSTEM_PROMPT = `You are an AWARD-WINNING PROFESSIONAL SCREENWRITER with 30+ years of experience writing for major Hollywood studios, premium television networks, and independent film. You have won multiple Academy Awards, Emmy Awards, and WGA Awards for your work.

Your expertise includes:
- Adapting novels, short stories, true stories, and transcripts into compelling screenplays
- Master of dramatic structure (three-act, five-act, non-linear)
- Expert in visual storytelling — showing rather than telling
- Deep understanding of pacing, subtext, and character-driven narratives
- Fluent in standard industry screenplay format (Final Draft / Courier 12pt conventions)
- Experience across all genres: drama, thriller, horror, sci-fi, comedy, action, documentary-style

Your adaptation philosophy:
1. HONOR the source material's core emotional truth and narrative essence
2. ENHANCE for the visual medium — translate prose descriptions into cinematic scene descriptions
3. RESTRUCTURE where necessary for dramatic impact and proper pacing
4. CREATE compelling dialogue that sounds natural when spoken aloud
5. ADD visual directions, transitions, and cinematic techniques that elevate the story
6. DEVELOP characters with distinct voices, physicality, and visual presence
7. FORMAT in proper industry-standard screenplay format

When adapting, you identify:
- The emotional spine of the story
- Key dramatic moments that translate powerfully to screen
- Opportunities for visual storytelling
- Natural act breaks and dramatic turning points
- Character moments that define relationships and arcs
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

    const contentType = request.headers.get('content-type') || '';
    let sourceText = '';
    let sourceTitle = 'Untitled';
    let runtime = 15;

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const runtimeStr = formData.get('runtime') as string;
      runtime = Math.max(1, Math.min(240, parseInt(runtimeStr) || 15));

      if (!file) {
        return new Response(
          JSON.stringify({ error: 'File is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      sourceTitle = file.name.replace(/\.[^.]+$/, '');
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        sourceText = buffer.toString('utf-8');
      } else if (file.name.endsWith('.docx')) {
        try {
          const result = await mammoth.extractRawText({ buffer });
          sourceText = result.value;
        } catch {
          try {
            const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer as ArrayBuffer });
            sourceText = result.value;
          } catch (e) {
            return new Response(
              JSON.stringify({ error: 'Failed to extract text from DOCX file' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      } else if (file.name.endsWith('.doc')) {
        // Use word-extractor for legacy .doc files
        try {
          const WordExtractor = (await import('word-extractor')).default;
          const extractor = new WordExtractor();
          const doc = await extractor.extract(buffer);
          sourceText = doc.getBody();
        } catch (e) {
          return new Response(
            JSON.stringify({ error: 'Failed to extract text from DOC file' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // For PDF, use LLM with base64
        const base64String = buffer.toString('base64');
        const llm = await getLLMConfig();
        const extractResponse = await fetch(llm.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llm.apiKey}`
          },
          body: JSON.stringify({
            model: llm.model,
            messages: [{
              role: 'user',
              content: [
                { type: 'file', file: { filename: file.name, file_data: `data:application/pdf;base64,${base64String}` } },
                { type: 'text', text: 'Extract ALL text content from this PDF. Return the complete text, preserving paragraph structure. Do not summarize or skip any content.' }
              ]
            }],
            max_tokens: 16000,
          }),
        });
        if (!extractResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to extract text from PDF' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const extractData = await extractResponse.json();
        sourceText = extractData.choices?.[0]?.message?.content || '';
      } else {
        return new Response(
          JSON.stringify({ error: 'Unsupported file type. Please use .txt, .md, .doc, .docx, or .pdf' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // JSON body (pasted text)
      const body = await request.json();
      sourceText = body.sourceText;
      sourceTitle = body.sourceTitle || 'Untitled';
      runtime = Math.max(1, Math.min(240, body.runtime || 15));
    }

    if (!sourceText || sourceText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: 'Source text is too short. Please provide at least 50 characters of content.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Truncate very long sources to avoid token limits
    const maxSourceChars = 80000;
    const truncatedSource = sourceText.length > maxSourceChars
      ? sourceText.slice(0, maxSourceChars) + '\n\n[Content truncated due to length]'
      : sourceText;

    const userPrompt = `ADAPT the following source material into a professional ${runtime}-minute screenplay for TV/Film production.

SOURCE TITLE: ${sourceTitle}

SOURCE MATERIAL:
${truncatedSource}

ADAPTATION REQUIREMENTS:
1. Analyze the source material to identify its core narrative, characters, themes, and emotional beats
2. Restructure the content into proper dramatic screenplay format with:
   - Scene headings (INT./EXT. LOCATION - TIME)
   - Action/description lines (visual, cinematic, present tense)
   - Character introductions with brief visual descriptions on first appearance
   - Natural, speakable dialogue with character names in CAPS
   - Parenthetical directions where necessary
   - Proper transitions (CUT TO:, DISSOLVE TO:, etc.)
3. Enhance for the visual medium:
   - Convert narration/prose into visual scenes and action
   - Add cinematic directions where they enhance the storytelling
   - Create subtext in dialogue rather than on-the-nose exposition
4. Maintain the source material's essential story, characters, and emotional truth
5. Target runtime: approximately ${runtime} minutes (${runtime} pages)
6. Make EVERY character and environment visually specific and detailed

Provide the complete adapted screenplay, then REQUIRED sections:

---CHARACTER DESCRIPTIONS---
For EACH character appearing in the screenplay:
- Full name
- Age
- Physical appearance: height, build, hair color/style, eye color, skin tone, facial features
- Clothing/wardrobe details
- Demeanor and mannerisms
- Emotional state

---ENVIRONMENT DESCRIPTIONS---
For EACH location in the screenplay:
- Detailed physical description
- Lighting conditions (specific sources, color temperature, shadows)
- Atmosphere and mood
- Props and set dressing
- Sounds and textures
- Time of day
- Weather/environmental conditions if applicable`;

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
          { role: 'system', content: SCREENWRITER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        stream: true,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    trackUsage({ userId: session.user.id, eventType: 'screenplay_convert', apiModel: llm.model, apiType: 'llm', provider: llm.provider });

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
          // If we got here without [DONE], send what we have
          if (buffer) {
            const finalData = JSON.stringify({
              status: 'completed',
              screenplay: buffer
            });
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          }
        } catch (error) {
          console.error('Stream error:', error);
          const errorData = JSON.stringify({ status: 'error', message: 'Stream processing failed' });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
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
    console.error('Screenplay conversion error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to convert to screenplay' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

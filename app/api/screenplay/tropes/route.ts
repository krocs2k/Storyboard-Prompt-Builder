import { NextRequest, NextResponse } from 'next/server';
import { getLLMConfig } from '@/lib/llm';
import { trackUsage } from '@/lib/usage-tracker';
import { withSonnetSoul } from '@/lib/sonnet-soul-protocol';
import { repairJSON } from '@/lib/repair-json';

export async function POST(request: NextRequest) {
  try {
    const { genre, genreName } = await request.json();

    if (!genre || !genreName) {
      return NextResponse.json(
        { error: 'Genre is required' },
        { status: 400 }
      );
    }

    const systemPrompt = withSonnetSoul('ideas', `You are a world-class story analyst and screenwriting expert with encyclopedic knowledge of storytelling tropes, narrative patterns, and genre conventions across film, television, animation, and literature. You understand which tropes resonate with audiences, drive compelling narratives, and have proven track records of commercial and critical success.`);

    const llm = await getLLMConfig('ideas');
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Generate exactly 30 popular and successful storytelling TROPES for the "${genreName}" genre.

These should be well-known narrative patterns, character archetypes, plot devices, and story structures that are proven to work brilliantly in this genre. Think of the tropes that define the most beloved and successful stories in this space.

For each trope provide:
1. A clear, recognizable name (the commonly known trope name)
2. A concise 1-sentence description of what the trope is
3. A famous example from a well-known movie, TV show, book, or cartoon that uses this trope brilliantly

Organize them roughly by popularity/recognition — put the most iconic and universally recognized tropes first.

Respond in JSON format:
{
  "tropes": [
    {
      "id": 1,
      "name": "The Chosen One",
      "description": "An ordinary person discovers they are destined for greatness and must rise to meet an extraordinary challenge.",
      "example": "Harry Potter, Avatar: The Last Airbender, The Matrix"
    }
  ]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`LLM API error ${response.status}:`, errBody);
      throw new Error(`LLM API error: ${response.status} - ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[Tropes] Empty LLM response:', JSON.stringify(data).slice(0, 300));
      throw new Error('Empty response from AI');
    }
    const repaired = repairJSON(content);
    const result = JSON.parse(repaired);

    trackUsage({ eventType: 'story_tropes', apiModel: llm.model, apiType: 'llm', provider: llm.provider });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Story tropes generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate story tropes' },
      { status: 500 }
    );
  }
}

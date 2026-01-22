import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { genre, genreName } = await request.json();
    
    if (!genre || !genreName) {
      return NextResponse.json(
        { error: 'Genre is required' },
        { status: 400 }
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
          {
            role: 'system',
            content: `You are a creative screenwriter and story developer. Generate unique, compelling story ideas that would make excellent screenplays. Each idea should be specific enough to develop into a full story but open enough for creative interpretation.`
          },
          {
            role: 'user',
            content: `Generate 10 unique and compelling story ideas/subjects for the ${genreName} genre.

Each idea should be:
- A specific, intriguing premise or concept (1-2 sentences)
- Original and fresh, avoiding common tropes
- Rich with potential for character development and conflict
- Suitable for screenplay adaptation

Respond in JSON format:
{
  "ideas": [
    {
      "id": 1,
      "title": "Short catchy title (3-5 words)",
      "premise": "A compelling 1-2 sentence story premise"
    }
  ]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const ideas = JSON.parse(data.choices[0].message.content);
    
    return NextResponse.json(ideas);
  } catch (error) {
    console.error('Story ideas generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate story ideas' },
      { status: 500 }
    );
  }
}

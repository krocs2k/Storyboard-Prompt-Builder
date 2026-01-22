import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { storyIdea, runtime, genre } = await request.json();
    
    if (!storyIdea) {
      return NextResponse.json(
        { error: 'Story idea/subject is required' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a creative screenwriter and story developer. Generate unique, compelling story concepts that would make excellent screenplays. Each concept should have strong dramatic potential, memorable characters, and engaging plots.`;

    const userPrompt = `Based on this story idea/subject: "${storyIdea}"
${genre ? `Genre context: ${genre}` : ''}

Generate 10 unique and compelling story concepts for a ${runtime || 15}-minute screenplay.

Each concept should include:
- A catchy, memorable title
- A 2-3 sentence synopsis with dramatic potential
- The central dramatic element (the core conflict or hook)
- The emotional hook that makes it compelling to audiences

Respond in JSON format:
{
  "concepts": [
    {
      "id": 1,
      "title": "Title here",
      "synopsis": "A compelling 2-3 sentence synopsis",
      "dramaticElement": "The central conflict or hook",
      "emotionalHook": "What makes it emotionally compelling"
    }
  ]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

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
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const concepts = JSON.parse(data.choices[0].message.content);
    
    return NextResponse.json(concepts);
  } catch (error) {
    console.error('Concepts generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate concepts' },
      { status: 500 }
    );
  }
}

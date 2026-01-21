import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { storyIdea, runtime } = await request.json();
    
    if (!storyIdea) {
      return NextResponse.json(
        { error: 'Story idea/subject is required' },
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
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are a creative writer specializing in paranormal and supernatural storytelling for TV shows like "Ghostly Encounters". Generate compelling story concepts that would make engaging episodes.`
          },
          {
            role: 'user',
            content: `Based on this story idea/subject: "${storyIdea}"

Generate 5 unique and compelling story concepts for a ${runtime || 15}-minute paranormal TV episode in the style of "Ghostly Encounters".

Each concept should include:
- A catchy title
- A brief 2-3 sentence synopsis
- The main paranormal element
- The emotional hook

Respond in JSON format:
{
  "concepts": [
    {
      "id": 1,
      "title": "Title here",
      "synopsis": "Synopsis here",
      "paranormalElement": "What supernatural aspect is involved",
      "emotionalHook": "What makes it emotionally compelling"
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

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
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are a creative writer specializing in paranormal, cryptid, and supernatural storytelling for the TV show "CRYPTID JOURNAL" - a documentary-style series featuring a government informant host revealing classified encounters from a secret underground facility. Generate compelling story concepts with drama, suspense, and entertainment value.`
          },
          {
            role: 'user',
            content: `Based on this story idea/subject: "${storyIdea}"

Generate 5 unique and compelling story concepts for a ${runtime || 15}-minute "CRYPTID JOURNAL" episode.

The show format:
- A mysterious government informant Host introduces cases from a secret underground facility
- Witnesses are interviewed in a dim, stark room
- Their stories are shown through silent, dramatic re-enactments
- The Host provides an ominous wrap-up

Each concept should include:
- A catchy, mysterious title
- A brief 2-3 sentence synopsis with dramatic potential
- The main paranormal/cryptid element
- The emotional hook that makes it compelling

Respond in JSON format:
{
  "concepts": [
    {
      "id": 1,
      "title": "Title here",
      "synopsis": "Synopsis here",
      "paranormalElement": "What supernatural/cryptid aspect is involved",
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

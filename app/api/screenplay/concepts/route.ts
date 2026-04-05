import { NextRequest, NextResponse } from 'next/server';
import { getLLMConfig } from '@/lib/llm';
import { storyGenres } from '@/lib/data/story-genres';
import { trackUsage } from '@/lib/usage-tracker';

export async function POST(request: NextRequest) {
  try {
    const { storyIdea, runtime, genre } = await request.json();
    
    if (!storyIdea) {
      return NextResponse.json(
        { error: 'Story idea/subject is required' },
        { status: 400 }
      );
    }

    // Look up genre personas
    const genreData = genre ? storyGenres.find(g => g.name === genre || g.id === genre) : null;
    const personas = genreData?.personas;
    const isPromoAd = genreData?.id === 'promo' || genreData?.id === 'advertisement';

    let systemPrompt: string;
    if (personas && personas.length > 0) {
      const personaDescriptions = personas.map((p, i) => 
        `${i + 1}. **${p.role}**: ${p.background}`
      ).join('\n');

      systemPrompt = `You are a collaborative team of world-class experts developing outstanding ${isPromoAd ? 'promotional and advertising' : 'creative'} concepts. Your team consists of:

${personaDescriptions}

Each expert contributes their specialized knowledge to craft concepts that are strategically brilliant, creatively compelling, emotionally resonant, and commercially viable. Every concept benefits from all five perspectives working in harmony.

CULTURAL DIVERSITY MANDATE:
- Draw from the FULL spectrum of world cultures, communities, and traditions — not just Western/Anglo-American settings
- Use authentic names from diverse backgrounds: East Asian, South Asian, Southeast Asian, Middle Eastern, African, Latin American, Indigenous, Eastern European, Polynesian, Caribbean, Nordic, Mediterranean, Central Asian, and many more
- Set concepts in varied locales worldwide — reflect the diversity of global markets, audiences, and communities
- NEVER default to generic Western names — every concept should feel rooted in a specific, authentic cultural context
- Vary cultures ACROSS the set of concepts — do not cluster around any single region or ethnicity`;
    } else {
      systemPrompt = `You are a creative screenwriter and story developer with a deep appreciation for global cultures and diverse communities. Generate unique, compelling story concepts that would make excellent screenplays. Each concept should have strong dramatic potential, memorable characters, and engaging plots.

CULTURAL DIVERSITY MANDATE:
- Draw from the FULL spectrum of world cultures, communities, and traditions — not just Western/Anglo-American settings
- Use authentic character names from diverse backgrounds: East Asian, South Asian, Southeast Asian, Middle Eastern, African, Latin American, Indigenous, Eastern European, Polynesian, Caribbean, Nordic, Mediterranean, Central Asian, and many more
- Set stories in varied locales worldwide — rural villages, megacities, island communities, mountain towns, desert settlements, arctic outposts, tropical coasts, ancient cities
- Explore culturally specific conflicts, traditions, family structures, spiritual beliefs, social dynamics, and ways of life
- NEVER default to generic Western names like "Jack", "Sarah", "Mike", "Emily" — every concept should feel rooted in a specific cultural context
- Vary cultures ACROSS the set of concepts — do not cluster around any single region or ethnicity`;
    }

    const promoAdGuidance = isPromoAd
      ? `\n\nFocus on ${genreData?.name} concepts:
- Target audience identification and emotional triggers
- Visual storytelling hooks for video production
- Clear brand narrative and value proposition
- Call-to-action strategy and conversion potential
- Platform optimization (TV, social, digital, cinema)`
      : '';

    const userPrompt = `Based on this ${isPromoAd ? 'concept' : 'story idea/subject'}: "${storyIdea}"
${genre ? `Genre context: ${genre}` : ''}${promoAdGuidance}

Generate 10 unique and compelling ${isPromoAd ? 'campaign concepts' : 'story concepts'} for a ${runtime || 15}-minute ${isPromoAd ? 'video production' : 'screenplay'}.

Each concept should include:
- A catchy, memorable title
- A 2-3 sentence synopsis with ${isPromoAd ? 'campaign strategy and visual potential' : 'dramatic potential'}
- The central ${isPromoAd ? 'hook or selling point' : 'dramatic element (the core conflict or hook)'}
- The emotional hook that makes it compelling to audiences

Respond in JSON format:
{
  "concepts": [
    {
      "id": 1,
      "title": "Title here",
      "synopsis": "A compelling 2-3 sentence synopsis",
      "dramaticElement": "The central ${isPromoAd ? 'hook or selling point' : 'conflict or hook'}",
      "emotionalHook": "What makes it emotionally compelling"
    }
  ]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

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
    
    trackUsage({ eventType: 'story_concept', apiModel: llm.model, apiType: 'llm', provider: llm.provider });
    return NextResponse.json(concepts);
  } catch (error) {
    console.error('Concepts generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate concepts' },
      { status: 500 }
    );
  }
}

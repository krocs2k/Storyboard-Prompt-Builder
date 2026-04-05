import { NextRequest, NextResponse } from 'next/server';
import { getLLMConfig } from '@/lib/llm';
import { storyGenres } from '@/lib/data/story-genres';
import { trackUsage } from '@/lib/usage-tracker';

interface PersonaInfo {
  role: string;
  background: string;
}

function buildPersonaSystemPrompt(personas?: PersonaInfo[]): string {
  if (!personas || personas.length === 0) {
    return `You are a creative screenwriter and story developer with a deep appreciation for the richness of global cultures. Generate unique, compelling story ideas that would make excellent screenplays. Each idea should be specific enough to develop into a full story but open enough for creative interpretation.

CULTURAL DIVERSITY MANDATE:
- Draw from the FULL spectrum of world cultures, communities, and traditions — not just Western/Anglo-American settings
- Use authentic names from diverse backgrounds: East Asian, South Asian, Southeast Asian, Middle Eastern, African, Latin American, Indigenous, Eastern European, Polynesian, Caribbean, Nordic, Mediterranean, Central Asian, and many more
- Set stories in varied locales worldwide — rural villages, megacities, island communities, mountain towns, desert settlements, arctic outposts, tropical coasts, ancient cities
- Explore culturally specific conflicts, traditions, family structures, spiritual beliefs, social dynamics, and ways of life
- NEVER default to generic Western names like "Jack", "Sarah", "Mike", "Emily" — every story should feel rooted in a specific cultural context
- Vary cultures ACROSS the set of ideas — do not cluster around any single region or ethnicity`;
  }

  const personaDescriptions = personas.map((p, i) => 
    `${i + 1}. **${p.role}**: ${p.background}`
  ).join('\n');

  return `You are a collaborative team of world-class experts working together to generate brilliant creative concepts. Your team consists of:

${personaDescriptions}

Each team member contributes their unique expertise to every idea generated. The Marketing Expert ensures brand impact and audience resonance. The Copywriting Expert crafts compelling hooks and messaging. The Sales Expert structures persuasive narratives that drive action. The Digital Media Expert optimizes for modern platforms and attention spans. The Communications Expert ensures clear, trustworthy messaging.

Together, you generate ideas that are strategically sound, creatively compelling, emotionally resonant, platform-optimized, and commercially viable.

CULTURAL DIVERSITY MANDATE:
- Draw from the FULL spectrum of world cultures, communities, and traditions — not just Western/Anglo-American settings
- Use authentic names from diverse backgrounds: East Asian, South Asian, Southeast Asian, Middle Eastern, African, Latin American, Indigenous, Eastern European, Polynesian, Caribbean, Nordic, Mediterranean, Central Asian, and many more
- Set concepts in varied locales worldwide — reflect the diversity of global markets, audiences, and communities
- NEVER default to generic Western names — every concept should feel rooted in a specific, authentic cultural context
- Vary cultures ACROSS the set of ideas — do not cluster around any single region or ethnicity`;
}

export async function POST(request: NextRequest) {
  try {
    const { genre, genreName } = await request.json();
    
    if (!genre || !genreName) {
      return NextResponse.json(
        { error: 'Genre is required' },
        { status: 400 }
      );
    }

    // Look up the genre to get personas if available
    const genreData = storyGenres.find(g => g.id === genre);
    const personas = genreData?.personas;
    const isPromoAd = genre === 'promo' || genre === 'advertisement';

    const systemPrompt = buildPersonaSystemPrompt(personas);

    const genreSpecificGuidance = isPromoAd
      ? `\n\nIMPORTANT: These are ${genreName} concepts — each idea should be a specific product, brand, service, or campaign concept that would make an outstanding promotional/advertising video. Think about:
- Target audience and emotional hooks
- Visual storytelling potential for video production
- Clear value propositions and calls to action
- Brand narrative arcs that build trust and desire
- Platform-appropriate formats (TV spots, social media ads, brand films, product launches)`
      : '';

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
            content: `Generate 10 unique and compelling ${isPromoAd ? 'concepts' : 'story ideas/subjects'} for the ${genreName} genre.${genreSpecificGuidance}

Each idea should be:
- A specific, intriguing premise or concept (1-2 sentences)
- Original and fresh, avoiding common tropes
- Rich with potential for ${isPromoAd ? 'visual storytelling and audience engagement' : 'character development and conflict'}
- Suitable for ${isPromoAd ? 'video production and campaign adaptation' : 'screenplay adaptation'}

Respond in JSON format:
{
  "ideas": [
    {
      "id": 1,
      "title": "Short catchy title (3-5 words)",
      "premise": "A compelling 1-2 sentence ${isPromoAd ? 'concept description' : 'story premise'}"
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
    
    trackUsage({ eventType: 'story_idea', apiModel: llm.model, apiType: 'llm', provider: llm.provider });
    return NextResponse.json(ideas);
  } catch (error) {
    console.error('Story ideas generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate story ideas' },
      { status: 500 }
    );
  }
}

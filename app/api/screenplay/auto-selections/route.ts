export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getLLMConfig } from '@/lib/llm';
import { trackUsage } from '@/lib/usage-tracker';
import { mapIdsToSelections, type AutoSelectionIds } from '@/lib/auto-select-helpers';
import { imageTypes } from '@/lib/data/image-types';
import { cameraBodies } from '@/lib/data/camera-bodies';
import { focalLengths } from '@/lib/data/focal-lengths';
import { lensTypes } from '@/lib/data/lens-types';
import { filmStocks } from '@/lib/data/film-stocks';
import { aspectRatios } from '@/lib/data/aspect-ratios';
import { photographerStyles } from '@/lib/data/photographer-styles';
import { movieStyles } from '@/lib/data/movie-styles';
import { filterEffects } from '@/lib/data/filter-effects';

/**
 * POST /api/screenplay/auto-selections
 * 
 * An award-winning expert cinematographer analyzes the screenplay and
 * automatically selects the best GLOBAL aesthetic options for:
 *   - Section 1: Visual style (imageType)
 *   - Section 4: Camera gear (camera, focalLength, lensType, filmStock, aspectRatio)
 *   - Section 5: Style & aesthetics (photographer, movie, filter)
 * 
 * NOTE: Sections 2 (framing) & 3 (lighting/mood) are handled PER-SHOT
 * by the prompts and storyboard APIs via the cinematographer persona.
 * 
 * OPTIMIZATION: We send only id+name for small lists, and only names
 * (newline-delimited) for large lists (movies, filters, photographers)
 * to keep the payload under ~3k tokens and avoid 524 timeouts.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { screenplayContent, title, genre, mood } = body;

    if (!screenplayContent) {
      return NextResponse.json({ error: 'Screenplay content is required' }, { status: 400 });
    }

    const config = await getLLMConfig();

    // Truncate screenplay to first ~2000 chars to save tokens
    const truncatedScreenplay = screenplayContent.length > 2000
      ? screenplayContent.slice(0, 2000) + '\n[...]'
      : screenplayContent;

    // Build compact option lists — use names only for large categories
    const compact = (items: {id: string; name: string}[]) => items.map(i => i.id).join(', ');
    const withNames = (items: {id: string; name: string}[]) => items.map(i => `${i.id}: ${i.name}`).join('\n');

    const systemPrompt = `You are an expert cinematographer. Analyze the screenplay and pick the single best option from each category. Return ONLY a JSON object.

IMAGE TYPES: ${compact(imageTypes)}
CAMERA BODIES: ${compact(cameraBodies)}
FOCAL LENGTHS: ${compact(focalLengths)}
LENS TYPES: ${compact(lensTypes)}
FILM STOCKS: ${compact(filmStocks)}
ASPECT RATIOS: ${compact(aspectRatios)}
PHOTOGRAPHER STYLES: ${compact(photographerStyles)}
MOVIE STYLES: ${compact(movieStyles)}
FILTER EFFECTS: ${compact(filterEffects)}

Return JSON: {"imageType":"<id>","camera":"<id>","focalLength":"<id>","lensType":"<id>","filmStock":"<id>","aspectRatio":"<id>","photographer":"<id>","movie":"<id>","filter":"<id>"}`;

    const userPrompt = `"${title || 'Untitled'}" — ${genre || 'Unknown'} genre, ${mood || 'unspecified'} mood\n\n${truncatedScreenplay}\n\nPick the best option from each category. JSON only.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 300,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('[AutoSelect] LLM error:', response.status, errText.slice(0, 200));
        return NextResponse.json({ error: 'Failed to get AI recommendations' }, { status: 500 });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
      }

      // Parse the JSON response
      let selectionIds: AutoSelectionIds;
      try {
        const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
        selectionIds = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[AutoSelect] Failed to parse LLM JSON:', content.slice(0, 300));
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
      }

      // Map IDs back to full selection objects
      const selections = mapIdsToSelections(selectionIds);

      trackUsage({
        eventType: 'auto_select',
        apiModel: config.model,
        apiType: 'llm',
        provider: config.provider as 'gemini' | 'openai' | 'abacus',
        metadata: { title, genre, selectionsCount: Object.keys(selections).length },
      });

      return NextResponse.json({ selections, rawIds: selectionIds });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr?.name === 'AbortError') {
        console.warn('[AutoSelect] Request timed out after 30s');
        return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
      }
      throw fetchErr;
    }
  } catch (error) {
    console.error('[AutoSelect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

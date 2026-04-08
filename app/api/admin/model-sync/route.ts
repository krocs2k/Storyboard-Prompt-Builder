export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ALL_ABACUS_MODELS,
  TEXT_GENERATION_MODELS,
  IMAGE_GENERATION_MODELS,
  VIDEO_GENERATION_MODELS,
  AUDIO_GENERATION_MODELS,
  AbacusModel,
} from '@/lib/data/abacus-models';

/* ──────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────── */

interface ApiModel {
  id: string;
  object: string;
  owned_by?: string;
  display_name?: string;
  category?: string;
  rate?: number;                    // credits for flat-rate (image/video) — divide by 100 for USD
  input_token_rate?: number;        // USD per token
  output_token_rate?: number;       // USD per token
  cached_input_token_rate?: number; // USD per token
}

interface ModelDiscrepancy {
  modelId: string;
  field: string;
  registryValue: string | number | undefined;
  apiValue: string | number | undefined;
}

interface SyncResult {
  timestamp: string;
  registryCount: number;
  apiCount: number;
  matched: number;
  missingFromRegistry: { id: string; display_name?: string; category?: string }[];
  missingFromApi: { id: string; name: string; category: string }[];
  discrepancies: ModelDiscrepancy[];
  categoryBreakdown: {
    category: string;
    registry: number;
    api: number;
    matched: number;
  }[];
  connectivityTest?: {
    success: boolean;
    model?: string;
    latencyMs?: number;
    error?: string;
    responseSnippet?: string;
  };
}

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

function mapApiCategory(cat?: string): string {
  if (!cat) return 'unknown';
  const c = cat.toLowerCase();
  if (c.includes('text') || c.includes('chat')) return 'text_generation';
  if (c.includes('image')) return 'image_generation';
  if (c.includes('video')) return 'video_generation';
  if (c.includes('audio') || c.includes('speech') || c.includes('tts')) return 'audio_generation';
  return c;
}

function approxEqual(a: number | undefined, b: number | undefined, tolerance = 0.001): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  if (a === 0 && b === 0) return true;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) < tolerance;
}

/* ──────────────────────────────────────────────────────────
   GET handler
   ────────────────────────────────────────────────────────── */

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const runConnectivity = url.searchParams.get('connectivity') === 'true';

  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ABACUSAI_API_KEY not configured' }, { status: 500 });
  }

  try {
    /* ── 1. Fetch live models from Abacus API ── */
    const res = await fetch('https://apps.abacus.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Abacus API returned ${res.status}: ${text}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const apiModels: ApiModel[] = data.data || data;

    /* ── 2. Build lookup maps ── */
    const apiMap = new Map<string, ApiModel>();
    for (const m of apiModels) apiMap.set(m.id, m);

    const registryMap = new Map<string, AbacusModel>();
    for (const m of ALL_ABACUS_MODELS) registryMap.set(m.id, m);

    /* ── 3. Find mismatches ── */
    const missingFromRegistry: SyncResult['missingFromRegistry'] = [];
    const missingFromApi: SyncResult['missingFromApi'] = [];
    const discrepancies: ModelDiscrepancy[] = [];
    let matched = 0;

    // Models in API but not in registry
    for (const [id, apiM] of apiMap) {
      if (!registryMap.has(id)) {
        missingFromRegistry.push({
          id,
          display_name: apiM.display_name,
          category: apiM.category,
        });
      }
    }

    // Models in registry — compare or flag missing
    for (const [id, regM] of registryMap) {
      const apiM = apiMap.get(id);
      if (!apiM) {
        missingFromApi.push({ id, name: regM.name, category: regM.category });
        continue;
      }

      matched++;
      const modelDiscreps: ModelDiscrepancy[] = [];

      // Check display name
      if (apiM.display_name && apiM.display_name !== regM.name) {
        modelDiscreps.push({
          modelId: id,
          field: 'name',
          registryValue: regM.name,
          apiValue: apiM.display_name,
        });
      }

      // Check token rates (text/audio)
      if (regM.inputTokenRate !== undefined) {
        if (!approxEqual(regM.inputTokenRate, apiM.input_token_rate)) {
          modelDiscreps.push({
            modelId: id,
            field: 'inputTokenRate',
            registryValue: regM.inputTokenRate,
            apiValue: apiM.input_token_rate,
          });
        }
      }
      if (regM.outputTokenRate !== undefined) {
        if (!approxEqual(regM.outputTokenRate, apiM.output_token_rate)) {
          modelDiscreps.push({
            modelId: id,
            field: 'outputTokenRate',
            registryValue: regM.outputTokenRate,
            apiValue: apiM.output_token_rate,
          });
        }
      }

      // Check flat rate (image/video) — API returns credits, registry stores USD (credits/100)
      if (regM.rate !== undefined && apiM.rate !== undefined) {
        const apiRateUsd = apiM.rate / 100;
        if (!approxEqual(regM.rate, apiRateUsd)) {
          modelDiscreps.push({
            modelId: id,
            field: 'rate (USD)',
            registryValue: regM.rate,
            apiValue: apiRateUsd,
          });
        }
      }

      discrepancies.push(...modelDiscreps);
    }

    /* ── 4. Category breakdown ── */
    const categories = [
      { category: 'text_generation', models: TEXT_GENERATION_MODELS },
      { category: 'image_generation', models: IMAGE_GENERATION_MODELS },
      { category: 'video_generation', models: VIDEO_GENERATION_MODELS },
      { category: 'audio_generation', models: AUDIO_GENERATION_MODELS },
    ];

    const categoryBreakdown = categories.map(({ category, models }) => {
      const apiInCat = apiModels.filter(m => mapApiCategory(m.category) === category);
      const regIds = new Set(models.map(m => m.id));
      const apiIds = new Set(apiInCat.map(m => m.id));
      const matchedInCat = [...regIds].filter(id => apiIds.has(id)).length;
      return {
        category,
        registry: models.length,
        api: apiInCat.length,
        matched: matchedInCat,
      };
    });

    /* ── 5. Optional connectivity test ── */
    let connectivityTest: SyncResult['connectivityTest'] | undefined;
    if (runConnectivity) {
      try {
        const start = Date.now();
        const chatRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Reply with exactly: SYNC_OK' }],
            max_tokens: 10,
          }),
        });
        const latencyMs = Date.now() - start;

        if (!chatRes.ok) {
          const errText = await chatRes.text();
          connectivityTest = {
            success: false,
            model: 'claude-sonnet-4-20250514',
            latencyMs,
            error: `HTTP ${chatRes.status}: ${errText.slice(0, 200)}`,
          };
        } else {
          const chatData = await chatRes.json();
          const content = chatData?.choices?.[0]?.message?.content || '';
          connectivityTest = {
            success: true,
            model: 'claude-sonnet-4-20250514',
            latencyMs,
            responseSnippet: content.slice(0, 100),
          };
        }
      } catch (err) {
        connectivityTest = {
          success: false,
          model: 'claude-sonnet-4-20250514',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    /* ── 6. Return ── */
    const result: SyncResult = {
      timestamp: new Date().toISOString(),
      registryCount: ALL_ABACUS_MODELS.length,
      apiCount: apiModels.length,
      matched,
      missingFromRegistry,
      missingFromApi,
      discrepancies,
      categoryBreakdown,
      ...(connectivityTest ? { connectivityTest } : {}),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[model-sync] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

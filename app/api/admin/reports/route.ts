export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GEMINI_COST_RATES } from '@/lib/usage-tracker';

/**
 * GET - Return usage statistics for the reporting dashboard.
 * Returns current month stats, 6-month history, and cost estimates.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    // Start of current month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // Go back 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // ── Current month summary ──
    const currentMonthEvents = await prisma.usageEvent.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: currentMonthStart } },
      _sum: { count: true },
      _count: { id: true },
    });

    // ── Current month API model breakdown ──
    const currentMonthModels = await prisma.usageEvent.groupBy({
      by: ['apiModel', 'apiType'],
      where: {
        createdAt: { gte: currentMonthStart },
        apiModel: { not: null },
      },
      _sum: { count: true },
      _count: { id: true },
    });

    // ── 6-month history ──
    // Get raw events grouped by month, eventType
    const historicalEvents = await prisma.$queryRaw<
      Array<{ month: string; event_type: string; total_count: string; call_count: string }>
    >`
      SELECT
        to_char("createdAt", 'YYYY-MM') as month,
        "eventType" as event_type,
        COALESCE(SUM("count"), 0)::text as total_count,
        COUNT(*)::text as call_count
      FROM "UsageEvent"
      WHERE "createdAt" >= ${sixMonthsAgo}
      GROUP BY month, "eventType"
      ORDER BY month ASC
    `;

    // ── 6-month API model history ──
    const historicalModels = await prisma.$queryRaw<
      Array<{ month: string; api_model: string; api_type: string; total_count: string; call_count: string }>
    >`
      SELECT
        to_char("createdAt", 'YYYY-MM') as month,
        "apiModel" as api_model,
        "apiType" as api_type,
        COALESCE(SUM("count"), 0)::text as total_count,
        COUNT(*)::text as call_count
      FROM "UsageEvent"
      WHERE "createdAt" >= ${sixMonthsAgo}
        AND "apiModel" IS NOT NULL
      GROUP BY month, "apiModel", "apiType"
      ORDER BY month ASC
    `;

    // ── Content stats from actual DB tables ──
    const [projectCount, screenplayCount, storyboardCount, imageCount, userCount] = await Promise.all([
      prisma.project.count(),
      prisma.screenplay.count(),
      prisma.storyboard.count(),
      prisma.storyboardImage.count(),
      prisma.user.count(),
    ]);

    // ── Build month labels ──
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // ── Build current month summary ──
    const currentMonth: Record<string, { calls: number; count: number }> = {};
    for (const e of currentMonthEvents) {
      currentMonth[e.eventType] = {
        calls: e._count.id,
        count: e._sum.count || 0,
      };
    }

    // ── Build current month cost estimate ──
    const currentMonthCosts: Array<{
      model: string;
      label: string;
      apiType: string;
      calls: number;
      units: number;
      costPerUnit: number;
      unitLabel: string;
      totalCost: number;
    }> = [];

    for (const m of currentMonthModels) {
      const model = m.apiModel || 'unknown';
      const rate = GEMINI_COST_RATES[model];
      const units = m._sum.count || 0;
      const calls = m._count.id;
      const costPerUnit = rate?.costPerUnit || 0;
      const totalCost = units * costPerUnit;

      currentMonthCosts.push({
        model,
        label: rate?.label || model,
        apiType: m.apiType || 'unknown',
        calls,
        units,
        costPerUnit,
        unitLabel: rate?.unit || 'unit',
        totalCost: Math.round(totalCost * 1000) / 1000,
      });
    }

    // ── Build 6-month history arrays ──
    const history: Record<string, number[]> = {};
    const EVENT_TYPES = [
      'story_idea', 'story_concept', 'screenplay_generate', 'screenplay_convert',
      'screenplay_analyze', 'storyboard_generate', 'prompt_generate', 'image_generate', 'image_grid_detect'
    ];
    for (const et of EVENT_TYPES) {
      history[et] = months.map(() => 0);
    }
    for (const row of historicalEvents) {
      const idx = months.indexOf(row.month);
      if (idx >= 0 && history[row.event_type]) {
        history[row.event_type][idx] = parseInt(row.total_count, 10);
      }
    }

    // ── Build 6-month cost history ──
    const costHistory: Record<string, number[]> = {};
    for (const row of historicalModels) {
      const model = row.api_model;
      if (!costHistory[model]) {
        costHistory[model] = months.map(() => 0);
      }
      const idx = months.indexOf(row.month);
      if (idx >= 0) {
        const rate = GEMINI_COST_RATES[model];
        const units = parseInt(row.total_count, 10);
        costHistory[model][idx] = Math.round(units * (rate?.costPerUnit || 0) * 1000) / 1000;
      }
    }

    return NextResponse.json({
      months,
      currentMonth,
      currentMonthCosts,
      history,
      costHistory,
      totals: {
        projects: projectCount,
        screenplays: screenplayCount,
        storyboards: storyboardCount,
        images: imageCount,
        users: userCount,
      },
      costRates: GEMINI_COST_RATES,
    });
  } catch (err) {
    console.error('Reports API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate report' },
      { status: 500 }
    );
  }
}

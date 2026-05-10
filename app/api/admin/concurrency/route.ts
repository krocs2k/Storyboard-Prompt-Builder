export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConcurrencyStats, updateConcurrencyLimits, reloadConcurrencyConfig } from '@/lib/concurrency';

/**
 * GET — Return current concurrency stats + effective limits
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string })?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = getConcurrencyStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Concurrency stats error:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

/**
 * POST — Update concurrency limits
 * Body: { limits: Partial<ConcurrencyLimits> }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string })?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { limits } = body;

    if (!limits || typeof limits !== 'object') {
      return NextResponse.json({ error: 'limits object required' }, { status: 400 });
    }

    await updateConcurrencyLimits(limits);
    const stats = getConcurrencyStats();

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Update concurrency error:', error);
    return NextResponse.json({ error: 'Failed to update limits' }, { status: 500 });
  }
}

/**
 * PUT — Force reload config from DB
 */
export async function PUT() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string })?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await reloadConcurrencyConfig();
    const stats = getConcurrencyStats();

    return NextResponse.json({ success: true, message: 'Config reloaded', stats });
  } catch (error) {
    console.error('Reload concurrency error:', error);
    return NextResponse.json({ error: 'Failed to reload' }, { status: 500 });
  }
}

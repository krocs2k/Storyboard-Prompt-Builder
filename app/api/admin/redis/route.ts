export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { testRedisConnection } from '@/lib/redis';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'redis_url' },
    });
    // Mask the URL for security - just show it's configured or not
    return NextResponse.json({
      configured: !!config?.value,
      url: config?.value ? config.value.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') : null,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url, action } = await req.json();

    if (action === 'test') {
      if (!url) {
        return NextResponse.json({ error: 'Redis URL is required' }, { status: 400 });
      }
      const result = await testRedisConnection(url);
      return NextResponse.json(result);
    }

    if (action === 'save') {
      if (!url) {
        return NextResponse.json({ error: 'Redis URL is required' }, { status: 400 });
      }
      // Test before saving
      const testResult = await testRedisConnection(url);
      if (!testResult.success) {
        return NextResponse.json({ error: `Connection failed: ${testResult.error}` }, { status: 400 });
      }
      await prisma.systemConfig.upsert({
        where: { key: 'redis_url' },
        update: { value: url },
        create: { key: 'redis_url', value: url },
      });
      return NextResponse.json({ success: true, latency: testResult.latency });
    }

    if (action === 'delete') {
      await prisma.systemConfig.deleteMany({
        where: { key: 'redis_url' },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Redis config error:', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface ApiModel {
  id: string;
  category?: string;
  display_name?: string;
}

let cache: { at: number; ids: string[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use stored API key first, then env
  const apiKeyConfig = await prisma.systemConfig.findUnique({ where: { key: 'ABACUS_API_KEY' } }).catch(() => null);
  const apiKey = apiKeyConfig?.value || process.env.ABACUSAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ supportedIds: [], error: 'No API key configured' }, { status: 200 });
  }

  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ supportedIds: cache.ids, cached: true });
  }

  try {
    const res = await fetch('https://apps.abacus.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ supportedIds: [], error: `Abacus API ${res.status}` }, { status: 200 });
    }
    const data = await res.json();
    const apiModels: ApiModel[] = data.data || data || [];
    const ids = apiModels.map(m => m.id).filter(Boolean);
    cache = { at: Date.now(), ids };
    return NextResponse.json({ supportedIds: ids });
  } catch (e) {
    return NextResponse.json({ supportedIds: [], error: String(e) }, { status: 200 });
  }
}

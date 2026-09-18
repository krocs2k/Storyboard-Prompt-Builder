export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CREATION_BIBLE_KEYS, BibleKind } from '@/lib/creation-bible';

function isValidKind(kind: unknown): kind is BibleKind {
  return kind === 'novel' || kind === 'screenplay';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await prisma.systemConfig.findMany({
      where: { key: { in: [CREATION_BIBLE_KEYS.novel, CREATION_BIBLE_KEYS.screenplay] } },
    });
    const byKey: Record<string, string> = {};
    for (const r of rows) byKey[r.key] = r.value || '';
    return NextResponse.json({
      novel: byKey[CREATION_BIBLE_KEYS.novel] || '',
      screenplay: byKey[CREATION_BIBLE_KEYS.screenplay] || '',
    });
  } catch (err) {
    console.error('Creation bible GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch creation bibles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { kind, content } = await req.json();
    if (!isValidKind(kind)) {
      return NextResponse.json({ error: 'Invalid bible kind' }, { status: 400 });
    }
    const value = typeof content === 'string' ? content : '';
    const key = CREATION_BIBLE_KEYS[kind];
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return NextResponse.json({ success: true, length: value.length });
  } catch (err) {
    console.error('Creation bible POST error:', err);
    return NextResponse.json({ error: 'Failed to save creation bible' }, { status: 500 });
  }
}

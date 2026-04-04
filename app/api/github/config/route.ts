import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await prisma.gitHubConfig.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      githubUsername: true,
      githubRepository: true,
      lastBackupAt: true,
      lastBackupCommit: true,
      lastBackupStatus: true,
      lastBackupError: true,
    },
  });

  return NextResponse.json({
    config: config ? { ...config, hasToken: true } : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { githubUsername, githubRepository, githubToken } = await req.json();

  if (!githubUsername || !githubRepository) {
    return NextResponse.json({ error: 'Username and repository are required' }, { status: 400 });
  }

  // Check if existing config exists (to allow token reuse)
  const existing = await prisma.gitHubConfig.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const tokenToUse = githubToken || existing?.githubToken;
  if (!tokenToUse) {
    return NextResponse.json({ error: 'Personal Access Token is required' }, { status: 400 });
  }

  await prisma.gitHubConfig.deleteMany({});

  const config = await prisma.gitHubConfig.create({
    data: { githubUsername, githubRepository, githubToken: tokenToUse },
  });

  return NextResponse.json({ success: true, config: { id: config.id } });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.gitHubConfig.deleteMany({});
  return NextResponse.json({ success: true });
}

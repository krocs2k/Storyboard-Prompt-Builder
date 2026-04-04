import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { testGitHubConnection } from '@/lib/github';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { githubUsername, githubRepository, githubToken } = await req.json();

  if (!githubUsername || !githubRepository) {
    return NextResponse.json({ error: 'Username and repository are required' }, { status: 400 });
  }

  // Use provided token, or fall back to the saved token in DB
  let tokenToUse = githubToken;
  if (!tokenToUse) {
    const existing = await prisma.gitHubConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    tokenToUse = existing?.githubToken;
  }

  if (!tokenToUse) {
    return NextResponse.json({ error: 'No token provided and no saved token found' }, { status: 400 });
  }

  const result = await testGitHubConnection({
    username: githubUsername,
    repository: githubRepository,
    token: tokenToUse,
  });

  return NextResponse.json(result);
}

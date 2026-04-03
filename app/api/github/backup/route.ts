import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { backupToGitHub } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await prisma.gitHubConfig.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!config) {
    return NextResponse.json(
      { error: 'GitHub configuration not found' },
      { status: 400 }
    );
  }

  // Update status to IN_PROGRESS
  await prisma.gitHubConfig.update({
    where: { id: config.id },
    data: { lastBackupStatus: 'IN_PROGRESS' },
  });

  const projectPath = process.cwd();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      };

      send({ status: 'scanning', message: 'Initializing backup...', filesScanned: 0, filesUploaded: 0, totalFiles: 0 });

      try {
        const result = await backupToGitHub(
          {
            username: config.githubUsername,
            repository: config.githubRepository,
            token: config.githubToken,
          },
          projectPath,
          undefined, // no sessionId needed for in-memory progress
          (progress) => {
            // Direct progress callback — streams inline
            send(progress);
          }
        );

        // Update DB with result
        try {
          await prisma.gitHubConfig.update({
            where: { id: config.id },
            data: {
              lastBackupAt: new Date(),
              lastBackupCommit: result.commitSha || null,
              lastBackupStatus: result.success ? 'SUCCESS' : 'FAILED',
              lastBackupError: result.success ? null : (result.error || null),
            },
          });
        } catch (e) {
          console.error('Failed to update backup status:', e);
        }

        if (result.success) {
          send({ status: 'complete', message: result.message, filesUploaded: result.filesUploaded, totalFiles: result.filesUploaded });
        } else {
          send({ status: 'error', message: result.message, error: result.error });
        }
      } catch (err: unknown) {
        const error = err as { message?: string };
        send({ status: 'error', message: 'Backup failed', error: error.message || 'Unknown error' });

        try {
          await prisma.gitHubConfig.update({
            where: { id: config.id },
            data: {
              lastBackupStatus: 'FAILED',
              lastBackupError: error.message || 'Unknown error',
            },
          });
        } catch { /* ignore */ }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

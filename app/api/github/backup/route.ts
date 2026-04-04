import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { backupToGitHub } from '@/lib/github';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Resolve the actual source directory for backup.
 * 
 * In the Abacus.AI production environment, `process.cwd()` points to the
 * standalone build output (e.g., .build/standalone/nextjs_space/) which only
 * contains compiled chunks — no source .ts/.tsx files, no Dockerfile, etc.
 * 
 * The actual source files live at ~/<project>/nextjs_space/ (the dev workspace).
 * We detect this by checking for the presence of the app/ directory with .tsx files.
 */
function resolveSourcePath(): string {
  const cwd = process.cwd();

  // Check if cwd has source files (works in dev and Docker)
  if (fs.existsSync(path.join(cwd, 'app', 'layout.tsx'))) {
    return cwd;
  }

  // Abacus.AI production: source is at the dev workspace path
  // Construct path dynamically using os.homedir()
  const os = require('os');
  const homeDir = os.homedir();
  if (homeDir && fs.existsSync(homeDir)) {
    try {
      const projectDirs = fs.readdirSync(homeDir).filter((d: string) => {
        try {
          return fs.statSync(path.join(homeDir, d)).isDirectory() && !d.startsWith('.');
        } catch { return false; }
      });
      for (const pdir of projectDirs) {
        const candidates = [
          path.join(homeDir, pdir, 'nextjs_space'),
          path.join(homeDir, pdir),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(path.join(candidate, 'app', 'layout.tsx'))) {
            return candidate;
          }
        }
      }
    } catch { /* ignore read errors */ }
  }

  // Last resort: walk up from cwd to find a directory with app/layout.tsx
  let dir = cwd;
  for (let i = 0; i < 5; i++) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    if (fs.existsSync(path.join(dir, 'app', 'layout.tsx'))) {
      return dir;
    }
  }

  // Fallback to cwd
  console.warn('[GitHub Backup] Could not find source directory, falling back to cwd:', cwd);
  return cwd;
}

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

  const projectPath = resolveSourcePath();
  console.log('[GitHub Backup] Using source path:', projectPath, '(cwd:', process.cwd(), ')');
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

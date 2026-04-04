import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addProgressListener, removeProgressListener, getProgress, BackupProgress } from '@/lib/github-progress';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const initialProgress = getProgress(sessionId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialProgress)}\n\n`));

      const listener = (_sid: string, progress: BackupProgress) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
          if (progress.status === 'complete' || progress.status === 'error') {
            setTimeout(() => {
              removeProgressListener(sessionId, listener);
              try { controller.close(); } catch { /* already closed */ }
            }, 1000);
          }
        } catch (error) {
          console.error('Error sending progress:', error);
        }
      };

      addProgressListener(sessionId, listener);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          removeProgressListener(sessionId, listener);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        removeProgressListener(sessionId, listener);
        try { controller.close(); } catch { /* already closed */ }
      });
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

/**
 * GitHub Backup Progress Tracker
 * In-memory storage for tracking backup progress across requests
 */

export interface BackupProgress {
  status: 'idle' | 'scanning' | 'uploading' | 'committing' | 'complete' | 'error';
  message: string;
  filesScanned: number;
  filesUploaded: number;
  totalFiles: number;
  currentFile?: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

type ProgressListener = (sessionId: string, progress: BackupProgress) => void;

const progressStore = new Map<string, BackupProgress>();
const listeners = new Map<string, Set<ProgressListener>>();

export function getProgress(sessionId: string): BackupProgress {
  return progressStore.get(sessionId) || {
    status: 'idle',
    message: 'Waiting to start...',
    filesScanned: 0,
    filesUploaded: 0,
    totalFiles: 0,
  };
}

export function updateProgress(sessionId: string, progress: Partial<BackupProgress>) {
  const current = getProgress(sessionId);
  const updated = { ...current, ...progress };
  progressStore.set(sessionId, updated);

  const sessionListeners = listeners.get(sessionId);
  if (sessionListeners) {
    sessionListeners.forEach(listener => listener(sessionId, updated));
  }
}

export function resetProgress(sessionId: string) {
  progressStore.delete(sessionId);
  listeners.delete(sessionId);
}

export function addProgressListener(sessionId: string, listener: ProgressListener) {
  if (!listeners.has(sessionId)) {
    listeners.set(sessionId, new Set());
  }
  listeners.get(sessionId)!.add(listener);
}

export function removeProgressListener(sessionId: string, listener: ProgressListener) {
  const sessionListeners = listeners.get(sessionId);
  if (sessionListeners) {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0) {
      listeners.delete(sessionId);
    }
  }
}

export function generateSessionId(): string {
  return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

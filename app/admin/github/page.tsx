'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, ArrowLeft, Github, Save, TestTube2, Trash2,
  CloudUpload, CheckCircle2, XCircle, AlertCircle, FileCode,
  Eye, EyeOff,
} from 'lucide-react';
import Link from 'next/link';

interface BackupProgressState {
  status: string;
  message: string;
  filesScanned: number;
  filesUploaded: number;
  totalFiles: number;
  currentFile?: string;
}

export default function GitHubBackupPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Config state
  const [githubUsername, setGithubUsername] = useState('');
  const [githubRepository, setGithubRepository] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubHasToken, setGithubHasToken] = useState(false);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Backup state
  const [githubLastBackup, setGithubLastBackup] = useState<string | null>(null);
  const [githubLastBackupStatus, setGithubLastBackupStatus] = useState<string | null>(null);
  const [githubLastBackupError, setGithubLastBackupError] = useState<string | null>(null);
  const [githubLastBackupCommit, setGithubLastBackupCommit] = useState<string | null>(null);
  const [githubBackupInProgress, setGithubBackupInProgress] = useState(false);
  const [githubBackupProgress, setGithubBackupProgress] = useState<BackupProgressState>({
    status: 'idle',
    message: '',
    filesScanned: 0,
    filesUploaded: 0,
    totalFiles: 0,
  });

  // Toast messages
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.replace('/');
    }
  }, [status, session, router, mounted]);

  const fetchGitHubConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/github/config');
      const data = await res.json();
      if (data.config) {
        setGithubUsername(data.config.githubUsername || '');
        setGithubRepository(data.config.githubRepository || '');
        setGithubHasToken(data.config.hasToken || false);
        setGithubConfigured(true);
        setGithubLastBackup(data.config.lastBackupAt);
        setGithubLastBackupStatus(data.config.lastBackupStatus);
        setGithubLastBackupError(data.config.lastBackupError);
        setGithubLastBackupCommit(data.config.lastBackupCommit || null);
        setGithubHasToken(!!data.config.hasToken);
        setGithubToken('');
      }
    } catch (error) {
      console.error('Failed to fetch GitHub config:', error);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetchGitHubConfig();
    }
  }, [session, fetchGitHubConfig]);

  const handleGitHubTest = async () => {
    if (!githubUsername || !githubRepository) {
      showToast('Please fill in username and repository', 'error');
      return;
    }
    if (!githubToken && !githubHasToken) {
      showToast('Please enter a Personal Access Token', 'error');
      return;
    }
    setGithubLoading(true);
    try {
      const res = await fetch('/api/github/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUsername, githubRepository, githubToken }),
      });
      const data = await res.json();
      showToast(data.message || (data.success ? 'Connection successful' : 'Connection failed'), data.success ? 'success' : 'error');
    } catch {
      showToast('Failed to test connection', 'error');
    }
    setGithubLoading(false);
  };

  const handleGitHubSave = async () => {
    // For new configs, token is required. For existing configs, token is optional (keeps existing).
    if (!githubUsername || !githubRepository) {
      showToast('Please fill in username and repository', 'error');
      return;
    }
    if (!githubConfigured && !githubToken) {
      showToast('Please enter a Personal Access Token', 'error');
      return;
    }
    setGithubLoading(true);
    try {
      const res = await fetch('/api/github/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUsername, githubRepository, githubToken }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Configuration saved!', 'success');
        setGithubConfigured(true);
        fetchGitHubConfig();
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch {
      showToast('Failed to save configuration', 'error');
    }
    setGithubLoading(false);
  };

  const handleGitHubBackup = async () => {
    setGithubBackupInProgress(true);
    setGithubBackupProgress({
      status: 'starting',
      message: 'Starting backup...',
      filesScanned: 0,
      filesUploaded: 0,
      totalFiles: 0,
    });

    try {
      const res = await fetch('/api/github/backup', { method: 'POST' });

      if (!res.ok || !res.body) {
        const text = await res.text();
        let errorMsg = 'Backup failed to start';
        try { errorMsg = JSON.parse(text).error || errorMsg; } catch { /* ignore */ }
        showToast(errorMsg, 'error');
        setGithubBackupInProgress(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const match = line.match(/^data:\s*(.+)/);
          if (!match) continue;
          try {
            const progress = JSON.parse(match[1]);
            setGithubBackupProgress(progress);

            if (progress.status === 'complete') {
              showToast(progress.message, 'success');
              fetchGitHubConfig();
              setGithubBackupInProgress(false);
            } else if (progress.status === 'error') {
              showToast(progress.error || progress.message, 'error');
              setGithubBackupInProgress(false);
            }
          } catch { /* skip malformed */ }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const match = buffer.match(/^data:\s*(.+)/);
        if (match) {
          try {
            const progress = JSON.parse(match[1]);
            setGithubBackupProgress(progress);
            if (progress.status === 'complete') {
              showToast(progress.message, 'success');
              fetchGitHubConfig();
            } else if (progress.status === 'error') {
              showToast(progress.error || progress.message, 'error');
            }
          } catch { /* skip */ }
        }
      }

      setGithubBackupInProgress(false);
    } catch {
      showToast('Failed to start backup', 'error');
      setGithubBackupInProgress(false);
    }
  };

  const handleGitHubDelete = async () => {
    if (!confirm('Delete GitHub configuration? This cannot be undone.')) return;
    setGithubLoading(true);
    try {
      await fetch('/api/github/config', { method: 'DELETE' });
      setGithubUsername('');
      setGithubRepository('');
      setGithubToken('');
      setGithubHasToken(false);
      setGithubConfigured(false);
      setGithubLastBackup(null);
      setGithubLastBackupStatus(null);
      setGithubLastBackupError(null);
      setGithubLastBackupCommit(null);
      showToast('Configuration deleted', 'success');
    } catch {
      showToast('Failed to delete configuration', 'error');
    }
    setGithubLoading(false);
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null;
  }

  const progressPercent = githubBackupProgress.totalFiles > 0
    ? Math.round((githubBackupProgress.filesUploaded / githubBackupProgress.totalFiles) * 100)
    : 0;

  return (
    <div className="min-h-screen ">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
              <Github className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GitHub Backup</h1>
              <p className="text-gray-500 text-sm">Backup your application source code to GitHub</p>
            </div>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">GitHub Username</label>
              <input
                type="text"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                placeholder="e.g., krocs2k"
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Repository Name</label>
              <input
                type="text"
                value={githubRepository}
                onChange={(e) => setGithubRepository(e.target.value)}
                placeholder="e.g., Storyboard-Prompt-Builder"
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Personal Access Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder={githubHasToken ? 'Token saved — leave blank to keep existing' : 'ghp_xxxxxxxxxxxxxxxxxxxx'}
                  className="w-full px-3 py-2 pr-10 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Needs repo scope. Generate at github.com/settings/tokens</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleGitHubTest}
                disabled={githubLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {githubLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
                Test Connection
              </button>

              <button
                onClick={handleGitHubSave}
                disabled={githubLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition-colors disabled:opacity-50"
              >
                {githubLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Configuration
              </button>

              {githubConfigured && (
                <button
                  onClick={handleGitHubDelete}
                  disabled={githubLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900/70 transition-colors disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Backup Card */}
        {githubConfigured && (
          <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CloudUpload className="w-5 h-5 text-gray-400" />
              Backup
            </h2>

            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-1">
                Backup destination: <span className="text-white font-mono">{githubUsername}/{githubRepository}</span>
              </p>
              <p className="text-gray-500 text-xs">
                Backs up all source code with GitHub Readiness applied (Prisma fix, Docker support, health check)
              </p>
            </div>

            {/* Progress */}
            {githubBackupInProgress && (
              <div className="mb-4 bg-gray-900/50 border border-gray-600 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  <span className="text-sm text-white font-medium">
                    {githubBackupProgress.message || 'Processing...'}
                  </span>
                </div>

                {githubBackupProgress.totalFiles > 0 && (
                  <>
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                      <div
                        className="bg-rose-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{githubBackupProgress.filesUploaded}/{githubBackupProgress.totalFiles} files</span>
                      <span>{progressPercent}%</span>
                    </div>
                  </>
                )}

                {githubBackupProgress.currentFile && (
                  <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                    <FileCode className="w-3 h-3 inline mr-1" />
                    {githubBackupProgress.currentFile}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleGitHubBackup}
              disabled={githubBackupInProgress}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 font-medium"
            >
              {githubBackupInProgress
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Backing Up...</>
                : <><CloudUpload className="w-4 h-4" /> Backup Now</>
              }
            </button>
          </div>
        )}

        {/* Last Backup Status */}
        {githubConfigured && githubLastBackupStatus && (
          <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Last Backup</h2>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm w-20">Status:</span>
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                  githubLastBackupStatus === 'SUCCESS'
                    ? 'text-green-400'
                    : githubLastBackupStatus === 'FAILED'
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}>
                  {githubLastBackupStatus === 'SUCCESS' && <CheckCircle2 className="w-4 h-4" />}
                  {githubLastBackupStatus === 'FAILED' && <XCircle className="w-4 h-4" />}
                  {githubLastBackupStatus === 'IN_PROGRESS' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {githubLastBackupStatus}
                </span>
              </div>

              {githubLastBackup && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm w-20">Date:</span>
                  <span className="text-white text-sm">{new Date(githubLastBackup).toLocaleString()}</span>
                </div>
              )}

              {githubLastBackupCommit && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm w-20">Commit:</span>
                  <span className="text-white text-sm font-mono">{githubLastBackupCommit.substring(0, 8)}</span>
                </div>
              )}

              {githubLastBackupError && githubLastBackupStatus === 'FAILED' && (
                <div className="flex items-start gap-2 mt-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-red-400 text-sm">{githubLastBackupError}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Settings({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

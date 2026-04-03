'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, Database, CheckCircle, XCircle, Trash2, Zap } from 'lucide-react';
import Link from 'next/link';

export default function RedisConfigPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [redisUrl, setRedisUrl] = useState('');
  const [configured, setConfigured] = useState(false);
  const [maskedUrl, setMaskedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; latency?: number } | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetch('/api/admin/redis')
        .then(res => res.json())
        .then(data => {
          setConfigured(data.configured);
          setMaskedUrl(data.url);
        })
        .catch(console.error);
    }
  }, [session]);

  const handleTest = async () => {
    if (!redisUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/redis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: redisUrl, action: 'test' }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Request failed' });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!redisUrl.trim()) return;
    setLoading(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/admin/redis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: redisUrl, action: 'save' }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({ type: 'success', text: `Connected! Latency: ${data.latency}ms` });
        setConfigured(true);
        setMaskedUrl(redisUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
        setRedisUrl('');
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Request failed' });
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm('Remove Redis configuration? Caching will be disabled.')) return;
    setLoading(true);
    try {
      await fetch('/api/admin/redis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      setConfigured(false);
      setMaskedUrl(null);
      setSaveMessage({ type: 'success', text: 'Redis configuration removed' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to delete' });
    }
    setLoading(false);
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen ">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4">
            <ArrowLeft size={18} /> Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Database className="text-red-400" /> Redis Cache
          </h1>
          <p className="text-gray-500">Configure Redis for caching prompts, API responses, and improving performance.</p>
        </div>

        {/* Current Status */}
        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Status</h2>
          <div className="flex items-center gap-3">
            {configured ? (
              <>
                <CheckCircle className="text-green-400" size={20} />
                <div>
                  <span className="text-green-400 font-medium">Connected</span>
                  {maskedUrl && <p className="text-gray-500 text-sm font-mono mt-1">{maskedUrl}</p>}
                </div>
              </>
            ) : (
              <>
                <XCircle className="text-gray-500" size={20} />
                <span className="text-gray-400">Not configured — caching is disabled</span>
              </>
            )}
          </div>
          {configured && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
            >
              <Trash2 size={14} /> Remove Configuration
            </button>
          )}
        </div>

        {/* Configure */}
        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">{configured ? 'Update' : 'Configure'} Redis</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Redis URL</label>
              <input
                type="password"
                value={redisUrl}
                onChange={e => { setRedisUrl(e.target.value); setTestResult(null); setSaveMessage(null); }}
                placeholder="redis://username:password@host:port"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:outline-none font-mono text-sm"
              />
              <p className="text-gray-500 text-xs mt-1">Supports redis://, rediss:// (TLS), and Upstash/Redis Cloud URLs</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTest}
                disabled={testing || !redisUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                Test Connection
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !redisUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                Save & Connect
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                {testResult.success ? (
                  <p className="text-green-400 text-sm flex items-center gap-2">
                    <CheckCircle size={16} /> Connection successful! Latency: {testResult.latency}ms
                  </p>
                ) : (
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <XCircle size={16} /> {testResult.error}
                  </p>
                )}
              </div>
            )}

            {saveMessage && (
              <div className={`p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <p className={`text-sm ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{saveMessage.text}</p>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-gray-800/30 border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-white font-medium mb-2">What gets cached?</h3>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>• Generated prompts and AI responses</li>
            <li>• Project data and storyboard metadata</li>
            <li>• Frequently accessed configurations</li>
          </ul>
          <p className="text-gray-500 text-xs mt-3">Recommended: Upstash (free tier) or Redis Cloud (30MB free)</p>
        </div>
      </div>
    </div>
  );
}

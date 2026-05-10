'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, ArrowLeft, Zap, Save, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { authFetch } from '@/lib/utils';

interface ConcurrencyStats {
  totalActive: number;
  totalQueued: number;
  activeByUser: Record<string, number>;
  activeByProvider: Record<string, number>;
  activeByJobType: Record<string, number>;
  rateLimitEvents: number;
  effectiveLimits: {
    maxSystemConcurrent: number;
    maxPerUser: number;
    maxPerProvider: Record<string, number>;
    maxPerJobType: Record<string, number>;
    backoffMultiplier: number;
    recoveryRateMs: number;
  };
}

export default function ConcurrencyAdmin() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [stats, setStats] = useState<ConcurrencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Editable limits
  const [maxSystem, setMaxSystem] = useState(20);
  const [maxPerUser, setMaxPerUser] = useState(10);
  const [providerLimits, setProviderLimits] = useState<Record<string, number>>({
    gemini: 8, openai: 5, abacus: 6, generic: 4,
  });
  const [jobTypeLimits, setJobTypeLimits] = useState<Record<string, number>>({
    video: 4, image: 10, llm: 8, generic: 6,
  });
  const [backoffMultiplier, setBackoffMultiplier] = useState(0.5);
  const [recoveryRateMs, setRecoveryRateMs] = useState(30000);

  const loadStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/concurrency');
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
        const el = data.stats.effectiveLimits;
        setMaxSystem(el.maxSystemConcurrent);
        setMaxPerUser(el.maxPerUser);
        setProviderLimits(el.maxPerProvider);
        setJobTypeLimits(el.maxPerJobType);
        setBackoffMultiplier(el.backoffMultiplier);
        setRecoveryRateMs(el.recoveryRateMs);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (session && (session.user as { role?: string })?.role !== 'admin') router.push('/');
    if (session) loadStats();
  }, [session, status, router, loadStats]);

  // Auto-refresh stats every 5s
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [session, loadStats]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/admin/concurrency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limits: {
            maxSystemConcurrent: maxSystem,
            maxPerUser,
            maxPerProvider: providerLimits,
            maxPerJobType: jobTypeLimits,
            backoffMultiplier,
            recoveryRateMs,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setMessage({ text: 'Limits saved successfully!', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Failed to save', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Failed to save limits', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Zap className="w-7 h-7 text-orange-400" />
              Concurrency Manager
            </h1>
            <p className="text-gray-400 text-sm mt-1">Configure parallel API execution limits for optimal performance</p>
          </div>
        </div>

        {/* Live Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Active Jobs</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalActive}</p>
              <p className="text-xs text-gray-500">of {maxSystem} max</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Queued</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalQueued}</p>
              <p className="text-xs text-gray-500">waiting for slots</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Rate Limits</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.rateLimitEvents}</p>
              <p className="text-xs text-gray-500">total events</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Active Users</span>
              </div>
              <p className="text-2xl font-bold text-white">{Object.keys(stats.activeByUser).length}</p>
              <p className="text-xs text-gray-500">concurrent sessions</p>
            </div>
          </div>
        )}

        {/* Live breakdown */}
        {stats && (stats.totalActive > 0 || stats.totalQueued > 0) && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-8">
            <h3 className="text-sm font-medium text-white mb-3">Live Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">By Provider</p>
                {Object.entries(stats.activeByProvider).map(([p, count]) => (
                  <div key={p} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 capitalize">{p}</span>
                    <span className="text-orange-300 font-mono">{count}/{stats.effectiveLimits.maxPerProvider[p] || '?'}</span>
                  </div>
                ))}
                {Object.keys(stats.activeByProvider).length === 0 && <p className="text-xs text-gray-600">No active jobs</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">By Job Type</p>
                {Object.entries(stats.activeByJobType).map(([jt, count]) => (
                  <div key={jt} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 capitalize">{jt}</span>
                    <span className="text-orange-300 font-mono">{count}/{stats.effectiveLimits.maxPerJobType[jt] || '?'}</span>
                  </div>
                ))}
                {Object.keys(stats.activeByJobType).length === 0 && <p className="text-xs text-gray-600">No active jobs</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">By User</p>
                {Object.entries(stats.activeByUser).map(([u, count]) => (
                  <div key={u} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 truncate max-w-[120px]">{u}</span>
                    <span className="text-orange-300 font-mono">{count}/{maxPerUser}</span>
                  </div>
                ))}
                {Object.keys(stats.activeByUser).length === 0 && <p className="text-xs text-gray-600">No active jobs</p>}
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-6">
          {/* System-wide Limits */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-400" />
              System-Wide Limits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-300 block mb-2">Max System Concurrent Jobs</label>
                <input
                  type="number" min={1} max={100} value={maxSystem}
                  onChange={(e) => setMaxSystem(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">Total concurrent API calls across all users</p>
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-2">Max Per-User Concurrent Jobs</label>
                <input
                  type="number" min={1} max={50} value={maxPerUser}
                  onChange={(e) => setMaxPerUser(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">Fair share limit for any single user</p>
              </div>
            </div>
          </div>

          {/* Per-Provider Limits */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Per-Provider Limits</h3>
            <p className="text-xs text-gray-400 mb-4">Respect external API rate limits per provider</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(providerLimits).map(([provider, limit]) => (
                <div key={provider}>
                  <label className="text-sm text-gray-300 block mb-1 capitalize">{provider}</label>
                  <input
                    type="number" min={1} max={50} value={limit}
                    onChange={(e) => setProviderLimits(prev => ({ ...prev, [provider]: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Per-Job-Type Limits */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Per-Job-Type Limits</h3>
            <p className="text-xs text-gray-400 mb-4">Control max concurrent jobs per operation type</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(jobTypeLimits).map(([jt, limit]) => (
                <div key={jt}>
                  <label className="text-sm text-gray-300 block mb-1 capitalize">{jt}</label>
                  <input
                    type="number" min={1} max={50} value={limit}
                    onChange={(e) => setJobTypeLimits(prev => ({ ...prev, [jt]: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Adaptive Throttling */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Adaptive Throttling</h3>
            <p className="text-xs text-gray-400 mb-4">Auto-reduces concurrency when rate limits are hit</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-300 block mb-2">Backoff Multiplier</label>
                <input
                  type="number" min={0.1} max={1} step={0.1} value={backoffMultiplier}
                  onChange={(e) => setBackoffMultiplier(parseFloat(e.target.value) || 0.5)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">0.5 = halve effective limit on rate-limit (lower = more aggressive)</p>
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-2">Recovery Time (seconds)</label>
                <input
                  type="number" min={5} max={300} value={recoveryRateMs / 1000}
                  onChange={(e) => setRecoveryRateMs((parseInt(e.target.value) || 30) * 1000)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">How long before limits recover to normal after a rate-limit event</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-500 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
            <button
              onClick={loadStats}
              className="flex items-center gap-2 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Stats
            </button>
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

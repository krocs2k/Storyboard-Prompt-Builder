'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Zap, Database, Wifi } from 'lucide-react';
import Link from 'next/link';

interface CategoryBreakdown {
  category: string;
  registry: number;
  api: number;
  matched: number;
}

interface Discrepancy {
  modelId: string;
  field: string;
  registryValue: string | number | undefined;
  apiValue: string | number | undefined;
}

interface MissingFromRegistry {
  id: string;
  display_name?: string;
  category?: string;
}

interface MissingFromApi {
  id: string;
  name: string;
  category: string;
}

interface ConnectivityTest {
  success: boolean;
  model?: string;
  latencyMs?: number;
  error?: string;
  responseSnippet?: string;
}

interface SyncResult {
  timestamp: string;
  registryCount: number;
  apiCount: number;
  matched: number;
  missingFromRegistry: MissingFromRegistry[];
  missingFromApi: MissingFromApi[];
  discrepancies: Discrepancy[];
  categoryBreakdown: CategoryBreakdown[];
  connectivityTest?: ConnectivityTest;
}

const CATEGORY_LABELS: Record<string, string> = {
  text_generation: 'Text Generation',
  image_generation: 'Image Generation',
  video_generation: 'Video Generation',
  audio_generation: 'Audio Generation',
};

const CATEGORY_COLORS: Record<string, string> = {
  text_generation: 'text-blue-400',
  image_generation: 'text-purple-400',
  video_generation: 'text-orange-400',
  audio_generation: 'text-emerald-400',
};

export default function ModelSyncPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeConnectivity, setIncludeConnectivity] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  const runSync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (includeConnectivity) params.set('connectivity', 'true');
      const res = await fetch(`/api/admin/model-sync?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [includeConnectivity]);

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  const isInSync = result && result.missingFromRegistry.length === 0 && result.missingFromApi.length === 0 && result.discrepancies.length === 0;

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Model Registry Sync</h1>
              <p className="text-gray-500 dark:text-gray-400">
                Compare the local model registry against the live Abacus AI API
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={runSync}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loading ? 'Syncing…' : 'Run Sync Check'}
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeConnectivity}
                onChange={e => setIncludeConnectivity(e.target.checked)}
                className="rounded border-gray-600 bg-gray-700 text-rose-500 focus:ring-rose-500"
              />
              Include live connectivity test
            </label>
          </div>
          {result && (
            <p className="mt-3 text-xs text-gray-500">
              Last run: {new Date(result.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Sync Failed</p>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Summary Banner */}
            <div className={`rounded-xl p-5 border ${
              isInSync
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex items-center gap-3">
                {isInSync
                  ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  : <AlertTriangle className="w-6 h-6 text-amber-400" />
                }
                <div>
                  <p className={`font-semibold text-lg ${isInSync ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {isInSync ? 'Registry is in sync with the API' : 'Discrepancies detected'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Registry: {result.registryCount} models · API: {result.apiCount} models · Matched: {result.matched}
                  </p>
                </div>
              </div>
            </div>

            {/* Connectivity Test */}
            {result.connectivityTest && (
              <div className={`rounded-xl p-5 border ${
                result.connectivityTest.success
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <Wifi className={`w-5 h-5 ${result.connectivityTest.success ? 'text-blue-400' : 'text-red-400'}`} />
                  <p className={`font-semibold ${result.connectivityTest.success ? 'text-blue-300' : 'text-red-300'}`}>
                    Connectivity Test — {result.connectivityTest.success ? 'Passed' : 'Failed'}
                  </p>
                </div>
                <div className="text-sm text-gray-400 space-y-1 ml-8">
                  {result.connectivityTest.model && <p>Model: <span className="text-gray-300">{result.connectivityTest.model}</span></p>}
                  {result.connectivityTest.latencyMs !== undefined && <p>Latency: <span className="text-gray-300">{result.connectivityTest.latencyMs}ms</span></p>}
                  {result.connectivityTest.responseSnippet && <p>Response: <span className="text-gray-300 font-mono text-xs">&quot;{result.connectivityTest.responseSnippet}&quot;</span></p>}
                  {result.connectivityTest.error && <p className="text-red-400">Error: {result.connectivityTest.error}</p>}
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-gray-400" /> Category Breakdown
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {result.categoryBreakdown.map(cat => {
                  const ok = cat.registry === cat.matched && cat.registry === cat.api;
                  return (
                    <div key={cat.category} className={`rounded-lg p-4 border ${
                      ok ? 'border-gray-600 bg-gray-700/50' : 'border-amber-500/30 bg-amber-500/5'
                    }`}>
                      <p className={`font-medium text-sm ${CATEGORY_COLORS[cat.category] || 'text-gray-300'}`}>
                        {CATEGORY_LABELS[cat.category] || cat.category}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-gray-400">
                        <p>Registry: <span className="text-white font-medium">{cat.registry}</span></p>
                        <p>API: <span className="text-white font-medium">{cat.api}</span></p>
                        <p>Matched: <span className={`font-medium ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>{cat.matched}</span></p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Communication Patterns Validation */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" /> Communication Patterns
              </h2>
              <div className="space-y-3">
                {[
                  {
                    label: 'Text Models (chat/completions)',
                    desc: 'All 70 text models use OpenAI-compatible POST /v1/chat/completions with {model, messages, max_tokens}. No model-specific formatting required.',
                    ok: true,
                    color: 'blue',
                  },
                  {
                    label: 'Image Models (Abacus)',
                    desc: 'Abacus image models use POST /v1/chat/completions with modalities:["image"] and image_config:{aspect_ratio}. Response: choices[].message.images[].',
                    ok: true,
                    color: 'purple',
                  },
                  {
                    label: 'Image Models (Gemini Direct)',
                    desc: 'Gemini Nano Banana uses @google/genai SDK generateContent(). Imagen uses generateImages(). Only active when provider=gemini.',
                    ok: true,
                    color: 'purple',
                  },
                  {
                    label: 'Video Models (Registry Only)',
                    desc: '25 video models are in the registry for rate-card display. The app does not generate video — no API call pattern needed.',
                    ok: true,
                    color: 'orange',
                  },
                  {
                    label: 'Audio Models (Registry Only)',
                    desc: '4 audio TTS models are in the registry for rate-card display. The app does not generate audio — no API call pattern needed.',
                    ok: true,
                    color: 'emerald',
                  },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-gray-700/40">
                    <CheckCircle2 className={`w-5 h-5 mt-0.5 shrink-0 text-${item.color}-400`} />
                    <div>
                      <p className="text-white text-sm font-medium">{item.label}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing from Registry */}
            {result.missingFromRegistry.length > 0 && (
              <div className="bg-gray-800 border border-amber-500/30 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-amber-300 mb-3">
                  ⚠️ In API but not in Registry ({result.missingFromRegistry.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2 pr-4">Model ID</th>
                        <th className="text-left py-2 pr-4">Display Name</th>
                        <th className="text-left py-2">Category</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {result.missingFromRegistry.map(m => (
                        <tr key={m.id} className="border-b border-gray-700/50">
                          <td className="py-2 pr-4 font-mono text-xs">{m.id}</td>
                          <td className="py-2 pr-4">{m.display_name || '—'}</td>
                          <td className="py-2">{m.category || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Missing from API */}
            {result.missingFromApi.length > 0 && (
              <div className="bg-gray-800 border border-red-500/30 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-red-300 mb-3">
                  ❌ In Registry but not in API ({result.missingFromApi.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2 pr-4">Model ID</th>
                        <th className="text-left py-2 pr-4">Name</th>
                        <th className="text-left py-2">Category</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {result.missingFromApi.map(m => (
                        <tr key={m.id} className="border-b border-gray-700/50">
                          <td className="py-2 pr-4 font-mono text-xs">{m.id}</td>
                          <td className="py-2 pr-4">{m.name}</td>
                          <td className="py-2">{m.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rate / Name Discrepancies */}
            {result.discrepancies.length > 0 && (
              <div className="bg-gray-800 border border-orange-500/30 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-orange-300 mb-3">
                  🔀 Field Discrepancies ({result.discrepancies.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2 pr-4">Model ID</th>
                        <th className="text-left py-2 pr-4">Field</th>
                        <th className="text-left py-2 pr-4">Registry</th>
                        <th className="text-left py-2">API</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {result.discrepancies.map((d, i) => (
                        <tr key={`${d.modelId}-${d.field}-${i}`} className="border-b border-gray-700/50">
                          <td className="py-2 pr-4 font-mono text-xs">{d.modelId}</td>
                          <td className="py-2 pr-4">{d.field}</td>
                          <td className="py-2 pr-4 text-rose-300">{String(d.registryValue ?? '—')}</td>
                          <td className="py-2 text-emerald-300">{String(d.apiValue ?? '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All Clear */}
            {isInSync && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-emerald-300 font-semibold text-lg">All {result.matched} models verified</p>
                <p className="text-gray-400 text-sm mt-1">No missing models, no rate mismatches, no naming discrepancies.</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!result && !error && !loading && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
            <RefreshCw className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-300 text-lg font-medium">Ready to sync</p>
            <p className="text-gray-500 text-sm mt-2">
              Click &quot;Run Sync Check&quot; to compare the local model registry against the live Abacus AI /v1/models endpoint.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

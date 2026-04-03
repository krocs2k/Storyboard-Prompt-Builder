'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  Loader2, ArrowLeft, BarChart3, TrendingUp, DollarSign,
  Film, Image as ImageIcon, Sparkles, Bot, Cpu, Activity,
  Users, FolderOpen, Clapperboard, LayoutGrid
} from 'lucide-react';
import Link from 'next/link';

interface ReportData {
  months: string[];
  currentMonth: Record<string, { calls: number; count: number }>;
  currentMonthCosts: Array<{
    model: string;
    label: string;
    apiType: string;
    calls: number;
    units: number;
    costPerUnit: number;
    unitLabel: string;
    totalCost: number;
  }>;
  history: Record<string, number[]>;
  costHistory: Record<string, number[]>;
  totals: {
    projects: number;
    screenplays: number;
    storyboards: number;
    images: number;
    users: number;
  };
  costRates: Record<string, { label: string; costPerUnit: number; unit: string }>;
}

const EVENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  story_idea: { label: 'Story Ideas', icon: 'sparkles', color: 'amber' },
  story_concept: { label: 'Story Concepts', icon: 'sparkles', color: 'amber' },
  screenplay_generate: { label: 'Screenplays Generated', icon: 'film', color: 'violet' },
  screenplay_convert: { label: 'Screenplays Converted', icon: 'film', color: 'violet' },
  screenplay_analyze: { label: 'Screenplays Analyzed', icon: 'film', color: 'violet' },
  storyboard_generate: { label: 'Storyboards Generated', icon: 'layout', color: 'cyan' },
  prompt_generate: { label: 'Prompts Generated', icon: 'bot', color: 'emerald' },
  image_generate: { label: 'Images Generated', icon: 'image', color: 'rose' },
  image_grid_detect: { label: 'Grid Detections', icon: 'cpu', color: 'blue' },
};

function MiniBarChart({ data, maxVal, color }: { data: number[]; maxVal: number; color: string }) {
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500',
    violet: 'bg-violet-500',
    cyan: 'bg-cyan-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
  };
  const bgClass = colorMap[color] || 'bg-gray-500';

  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((val, i) => {
        const height = maxVal > 0 ? Math.max(2, (val / maxVal) * 48) : 2;
        return (
          <div
            key={i}
            className={`flex-1 rounded-t ${bgClass} opacity-70 hover:opacity-100 transition-opacity relative group`}
            style={{ height: `${height}px` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
              {val}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CostBarChart({ months, costHistory, costRates }: {
  months: string[];
  costHistory: Record<string, number[]>;
  costRates: Record<string, { label: string; costPerUnit: number; unit: string }>;
}) {
  const models = Object.keys(costHistory);
  if (models.length === 0) {
    return <p className="text-gray-500 text-sm">No API cost data yet.</p>;
  }

  // Calculate total per month
  const monthlyTotals = months.map((_, i) =>
    models.reduce((sum, m) => sum + (costHistory[m]?.[i] || 0), 0)
  );
  const maxCost = Math.max(...monthlyTotals, 0.01);

  const modelColors: Record<string, string> = {
    'gemini-3-flash-preview': 'bg-emerald-500',
    'imagen-4.0-generate-001': 'bg-rose-500',
    'imagen-4.0-fast-generate-001': 'bg-orange-500',
    'gemini-3.1-flash-image-preview': 'bg-violet-500',
  };

  return (
    <div>
      <div className="flex items-end gap-2 h-32 mb-2">
        {months.map((month, i) => {
          const total = monthlyTotals[i];
          const barHeight = maxCost > 0 ? Math.max(2, (total / maxCost) * 120) : 2;
          return (
            <div key={month} className="flex-1 flex flex-col items-center group">
              <div className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 mb-1 transition-opacity">
                ${total.toFixed(2)}
              </div>
              <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${barHeight}px` }}>
                {models.map((m) => {
                  const val = costHistory[m]?.[i] || 0;
                  const pct = total > 0 ? (val / total) * 100 : 0;
                  return (
                    <div
                      key={m}
                      className={`w-full ${modelColors[m] || 'bg-gray-500'}`}
                      style={{ height: `${pct}%` }}
                    />
                  );
                })}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                {month.split('-')[1]}/{month.split('-')[0].slice(2)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {models.map((m) => (
          <div key={m} className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className={`w-2.5 h-2.5 rounded-full ${modelColors[m] || 'bg-gray-500'}`} />
            {costRates[m]?.label || m}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetch('/api/admin/reports')
        .then(res => res.json())
        .then(d => {
          if (d.error) throw new Error(d.error);
          setData(d);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [session]);

  const totalCurrentMonthCost = useMemo(() => {
    if (!data) return 0;
    return data.currentMonthCosts.reduce((sum, c) => sum + c.totalCost, 0);
  }, [data]);

  const totalAllTimeCost = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.costHistory).reduce((sum, arr) =>
      sum + arr.reduce((s, v) => s + v, 0), 0
    );
  }, [data]);

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  const currentMonthLabel = data ? new Date(data.months[data.months.length - 1] + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Usage Reports</h1>
          <p className="text-gray-400">Track app activity, API usage, and estimated costs</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">{error}</div>
        ) : data ? (
          <div className="space-y-8">

            {/* ── Lifetime Totals ── */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" /> Lifetime Totals
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {[
                  { label: 'Projects', value: data.totals.projects, icon: FolderOpen, color: 'text-amber-400' },
                  { label: 'Screenplays', value: data.totals.screenplays, icon: Clapperboard, color: 'text-violet-400' },
                  { label: 'Storyboards', value: data.totals.storyboards, icon: LayoutGrid, color: 'text-cyan-400' },
                  { label: 'Images', value: data.totals.images, icon: ImageIcon, color: 'text-rose-400' },
                  { label: 'Users', value: data.totals.users, icon: Users, color: 'text-emerald-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-4 text-center">
                    <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                    <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
                    <div className="text-gray-400 text-xs mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Current Month Activity ── */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" /> {currentMonthLabel} Activity
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(EVENT_LABELS).map(([key, { label, color }]) => {
                  const stats = data.currentMonth[key];
                  return (
                    <div key={key} className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-4">
                      <div className="text-gray-400 text-xs mb-1">{label}</div>
                      <div className="text-2xl font-bold text-white">{stats?.count?.toLocaleString() || 0}</div>
                      <div className="text-gray-500 text-xs">{stats?.calls || 0} API call{(stats?.calls || 0) !== 1 ? 's' : ''}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Current Month Cost Estimate ── */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" /> {currentMonthLabel} Estimated API Cost
              </h2>
              {data.currentMonthCosts.length === 0 ? (
                <p className="text-gray-500 text-sm">No API usage recorded this month yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left text-gray-400 font-medium py-2 pr-4">Model</th>
                          <th className="text-left text-gray-400 font-medium py-2 pr-4">Type</th>
                          <th className="text-right text-gray-400 font-medium py-2 pr-4">Calls</th>
                          <th className="text-right text-gray-400 font-medium py-2 pr-4">Units</th>
                          <th className="text-right text-gray-400 font-medium py-2 pr-4">Rate</th>
                          <th className="text-right text-gray-400 font-medium py-2">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.currentMonthCosts.map((c) => (
                          <tr key={c.model} className="border-b border-gray-800">
                            <td className="py-2 pr-4 text-white font-medium">{c.label}</td>
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                c.apiType === 'imagen' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {c.apiType === 'imagen' ? 'Image Gen' : 'LLM'}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-300">{c.calls.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-right text-gray-300">{c.units.toLocaleString()} {c.unitLabel}{c.units !== 1 ? 's' : ''}</td>
                            <td className="py-2 pr-4 text-right text-gray-400">${c.costPerUnit}/{c.unitLabel}</td>
                            <td className="py-2 text-right text-white font-medium">${c.totalCost.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-600">
                          <td colSpan={5} className="py-2 pr-4 text-right text-gray-300 font-medium">Total Estimated Cost</td>
                          <td className="py-2 text-right text-green-400 font-bold text-lg">${totalCurrentMonthCost.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="text-gray-500 text-xs mt-3">* Costs are estimates based on published Gemini API rates. Actual billing may differ based on token counts, free-tier usage, and billing plan.</p>
                </>
              )}
            </div>

            {/* ── 6-Month Activity Trends ── */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-400" /> 6-Month Activity Trends
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(EVENT_LABELS).map(([key, { label, color }]) => {
                  const values = data.history[key] || data.months.map(() => 0);
                  const maxVal = Math.max(...values, 1);
                  const total = values.reduce((s, v) => s + v, 0);
                  return (
                    <div key={key} className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-300 text-sm font-medium">{label}</span>
                        <span className="text-gray-500 text-xs">{total.toLocaleString()} total</span>
                      </div>
                      <MiniBarChart data={values} maxVal={maxVal} color={color} />
                      <div className="flex justify-between mt-1">
                        {data.months.map((m) => (
                          <div key={m} className="text-[9px] text-gray-600 flex-1 text-center">
                            {m.split('-')[1]}/{m.split('-')[0].slice(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 6-Month Cost Trend ── */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" /> 6-Month Cost Trend
                </h2>
                <div className="text-gray-400 text-sm">
                  6-month total: <span className="text-green-400 font-bold">${totalAllTimeCost.toFixed(2)}</span>
                </div>
              </div>
              <CostBarChart months={data.months} costHistory={data.costHistory} costRates={data.costRates} />
            </div>

            {/* ── Rate Card ── */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" /> Gemini API Rate Card
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(data.costRates).map(([model, { label, costPerUnit, unit }]) => (
                  <div key={model} className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-white font-medium text-sm mb-1">{label}</div>
                    <div className="text-gray-500 text-xs mb-2 truncate" title={model}>{model}</div>
                    <div className="text-green-400 font-bold text-lg">${costPerUnit}</div>
                    <div className="text-gray-400 text-xs">per {unit}</div>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-3">Rates sourced from published Google Gemini API pricing (March 2026). LLM cost is averaged per call (~1K input + ~2K output tokens).</p>
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}

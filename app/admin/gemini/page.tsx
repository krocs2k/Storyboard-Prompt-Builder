'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, Key, Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle, ImageIcon, Zap, Sparkles, ToggleLeft, ToggleRight, Server } from 'lucide-react';
import Link from 'next/link';

type Provider = 'gemini' | 'abacus';

export default function ApiConfigPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Provider
  const [provider, setProvider] = useState<Provider>('gemini');
  const [savingProvider, setSavingProvider] = useState(false);

  // Gemini
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState<string | null>(null);
  const [hasGeminiEnvKey, setHasGeminiEnvKey] = useState(false);
  const [imagenModel, setImagenModel] = useState('imagen-4.0-generate-001');
  const [savingModel, setSavingModel] = useState(false);

  // Abacus
  const [abacusApiKey, setAbacusApiKey] = useState('');
  const [showAbacusKey, setShowAbacusKey] = useState(false);
  const [hasAbacusKey, setHasAbacusKey] = useState(false);
  const [maskedAbacusKey, setMaskedAbacusKey] = useState<string | null>(null);
  const [hasAbacusEnvKey, setHasAbacusEnvKey] = useState(false);
  const [abacusImageModel, setAbacusImageModel] = useState('gpt-5.1');
  const [savingAbacusModel, setSavingAbacusModel] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gemini');
      const data = await res.json();
      setProvider(data.provider || 'gemini');
      setHasGeminiKey(data.hasGeminiKey);
      setMaskedGeminiKey(data.maskedGeminiKey);
      setHasGeminiEnvKey(data.hasGeminiEnvKey);
      setHasAbacusKey(data.hasAbacusKey);
      setMaskedAbacusKey(data.maskedAbacusKey);
      setHasAbacusEnvKey(data.hasAbacusEnvKey);
      if (data.imagenModel) setImagenModel(data.imagenModel);
      if (data.abacusImageModel) setAbacusImageModel(data.abacusImageModel);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === 'admin') fetchConfig();
  }, [session]);

  const handleSaveProvider = async (newProvider: Provider) => {
    setSavingProvider(true);
    setMessage(null);
    setProvider(newProvider);
    try {
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Switched to ${newProvider === 'abacus' ? 'Abacus.AI' : 'Google Gemini'} provider` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to switch provider' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to switch provider' });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleSaveKey = async (type: 'gemini' | 'abacus') => {
    const key = type === 'gemini' ? geminiApiKey : abacusApiKey;
    if (!key.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const body = type === 'gemini' ? { apiKey: key.trim() } : { abacusApiKey: key.trim() };
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `${type === 'gemini' ? 'Gemini' : 'Abacus.AI'} API key saved successfully` });
        type === 'gemini' ? setGeminiApiKey('') : setAbacusApiKey('');
        fetchConfig();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (type: 'gemini' | 'abacus') => {
    const label = type === 'gemini' ? 'Gemini' : 'Abacus.AI';
    if (!confirm(`Remove the stored ${label} API key?`)) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/gemini?type=${type}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `${label} API key removed` });
        fetchConfig();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove API key' });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  const ABACUS_IMAGE_MODELS = [
    { id: 'gpt-5.1', label: 'GPT-5.1', desc: 'High quality, versatile image generation', cost: '~$0.04/image' },
    { id: 'flux2_pro', label: 'Flux 2 Pro', desc: 'Fast, high-fidelity image generation', cost: '~$0.05/image' },
    { id: 'flux_pro_ultra', label: 'Flux Pro Ultra', desc: 'Premium quality Flux generation', cost: '~$0.06/image' },
    { id: 'seedream', label: 'Seedream', desc: 'Creative and artistic image generation', cost: '~$0.03/image' },
    { id: 'ideogram', label: 'Ideogram', desc: 'Excellent text rendering in images', cost: '~$0.04/image' },
    { id: 'recraft', label: 'Recraft', desc: 'Design-oriented image generation', cost: '~$0.04/image' },
    { id: 'dalle', label: 'DALL-E', desc: 'OpenAI image generation model', cost: '~$0.04/image' },
    { id: 'nano_banana_pro', label: 'Nano Banana Pro', desc: 'Fast multimodal image generation', cost: '~$0.03/image' },
    { id: 'nano_banana2', label: 'Nano Banana 2', desc: 'Multimodal with text rendering', cost: '~$0.03/image' },
    { id: 'imagen', label: 'Imagen', desc: 'Google Imagen via Abacus', cost: '~$0.04/image' },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">API Configuration</h1>
          <p className="text-gray-500">Manage AI provider, API keys, and image generation models</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Provider Toggle ── */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                Active AI Provider
              </h2>
              <p className="text-gray-400 text-sm mb-4">Choose which AI provider to use for all LLM and image generation calls.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleSaveProvider('gemini')}
                  disabled={savingProvider}
                  className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                    provider === 'gemini'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-white font-semibold">Google Gemini</span>
                  </div>
                  <p className="text-gray-400 text-xs">Google&apos;s Gemini API for LLM + Imagen/Nano Banana for images</p>
                  {provider === 'gemini' && (
                    <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-blue-400" />
                  )}
                </button>
                <button
                  onClick={() => handleSaveProvider('abacus')}
                  disabled={savingProvider}
                  className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                    provider === 'abacus'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Server className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-white font-semibold">Abacus.AI</span>
                  </div>
                  <p className="text-gray-400 text-xs">Abacus.AI RouteLLM for LLM + multi-model image generation</p>
                  {provider === 'abacus' && (
                    <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-emerald-400" />
                  )}
                </button>
              </div>
            </div>

            {/* ── Gemini Configuration ── */}
            <div className={`bg-gray-800 border shadow-lg rounded-xl p-6 transition-all ${provider === 'gemini' ? 'border-blue-500/30' : 'border-gray-700 opacity-60'}`}>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-400" />
                Gemini API Key
                {provider === 'gemini' && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Active</span>}
              </h2>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Database Key</span>
                  {hasGeminiKey ? (
                    <span className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      {maskedGeminiKey}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-500 text-sm">
                      <AlertCircle className="w-4 h-4" /> Not set
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Env Fallback</span>
                  {hasGeminiEnvKey ? (
                    <span className="text-green-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Available</span>
                  ) : (
                    <span className="text-gray-500 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Not set</span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key..."
                    className="w-full px-4 py-3 pr-12 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showGeminiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSaveKey('gemini')}
                    disabled={saving || !geminiApiKey.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Key
                  </button>
                  {hasGeminiKey && (
                    <button
                      onClick={() => handleDeleteKey('gemini')}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors font-medium text-sm"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Gemini Image Model ── */}
            {provider === 'gemini' && (
              <div className="bg-gray-800 border border-blue-500/30 shadow-lg rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                  Gemini Image Model
                </h2>
                <p className="text-gray-400 text-sm mb-4">Choose which Gemini model to use for image generation.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <button
                    onClick={() => setImagenModel('imagen-4.0-generate-001')}
                    className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                      imagenModel === 'imagen-4.0-generate-001'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ImageIcon className="w-4 h-4 text-purple-400" />
                      <span className="text-white font-semibold text-sm">Imagen 4</span>
                    </div>
                    <p className="text-gray-400 text-xs">Higher quality, up to 2K resolution.</p>
                    <p className="text-gray-500 text-xs mt-1">$0.04/image · ~8-12s</p>
                    {imagenModel === 'imagen-4.0-generate-001' && <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-purple-400" />}
                  </button>
                  <button
                    onClick={() => setImagenModel('imagen-4.0-fast-generate-001')}
                    className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                      imagenModel === 'imagen-4.0-fast-generate-001'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-white font-semibold text-sm">Imagen 4 Fast</span>
                    </div>
                    <p className="text-gray-400 text-xs">Optimized for speed.</p>
                    <p className="text-gray-500 text-xs mt-1">$0.02/image · ~2-3s</p>
                    {imagenModel === 'imagen-4.0-fast-generate-001' && <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-amber-400" />}
                  </button>
                  <button
                    onClick={() => setImagenModel('gemini-3.1-flash-image-preview')}
                    className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                      imagenModel === 'gemini-3.1-flash-image-preview'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-white font-semibold text-sm">Nano Banana 2</span>
                    </div>
                    <p className="text-gray-400 text-xs">Native image gen with text rendering.</p>
                    <p className="text-gray-500 text-xs mt-1">Multimodal · ~3-5s</p>
                    {imagenModel === 'gemini-3.1-flash-image-preview' && <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-cyan-400" />}
                  </button>
                </div>
                <button
                  onClick={async () => {
                    setSavingModel(true);
                    setMessage(null);
                    try {
                      const res = await fetch('/api/admin/gemini', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imagenModel })
                      });
                      const data = await res.json();
                      if (data.success) {
                        setMessage({ type: 'success', text: `Gemini image model updated` });
                      } else {
                        setMessage({ type: 'error', text: data.error || 'Failed to save' });
                      }
                    } catch { setMessage({ type: 'error', text: 'Failed to save' }); }
                    finally { setSavingModel(false); }
                  }}
                  disabled={savingModel}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  {savingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Model
                </button>
              </div>
            )}

            {/* ── Abacus.AI Configuration ── */}
            <div className={`bg-gray-800 border shadow-lg rounded-xl p-6 transition-all ${provider === 'abacus' ? 'border-emerald-500/30' : 'border-gray-700 opacity-60'}`}>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                Abacus.AI API Key
                {provider === 'abacus' && <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Active</span>}
              </h2>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Database Key</span>
                  {hasAbacusKey ? (
                    <span className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      {maskedAbacusKey}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-500 text-sm">
                      <AlertCircle className="w-4 h-4" /> Not set
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Env Fallback</span>
                  {hasAbacusEnvKey ? (
                    <span className="text-green-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Available</span>
                  ) : (
                    <span className="text-gray-500 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Not set</span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showAbacusKey ? 'text' : 'password'}
                    value={abacusApiKey}
                    onChange={(e) => setAbacusApiKey(e.target.value)}
                    placeholder="Enter your Abacus.AI API key..."
                    className="w-full px-4 py-3 pr-12 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowAbacusKey(!showAbacusKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showAbacusKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSaveKey('abacus')}
                    disabled={saving || !abacusApiKey.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Key
                  </button>
                  {hasAbacusKey && (
                    <button
                      onClick={() => handleDeleteKey('abacus')}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors font-medium text-sm"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Abacus Image Model ── */}
            {provider === 'abacus' && (
              <div className="bg-gray-800 border border-emerald-500/30 shadow-lg rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                  Abacus Image Model
                </h2>
                <p className="text-gray-400 text-sm mb-4">Choose which model Abacus.AI uses for image generation.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {ABACUS_IMAGE_MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setAbacusImageModel(m.id)}
                      className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                        abacusImageModel === m.id
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                      }`}
                    >
                      <span className="text-white font-semibold text-sm block mb-0.5">{m.label}</span>
                      <p className="text-gray-400 text-xs">{m.desc}</p>
                      <p className="text-gray-500 text-xs mt-1">{m.cost}</p>
                      {abacusImageModel === m.id && <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-emerald-400" />}
                    </button>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    setSavingAbacusModel(true);
                    setMessage(null);
                    try {
                      const res = await fetch('/api/admin/gemini', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ abacusImageModel })
                      });
                      const data = await res.json();
                      if (data.success) {
                        setMessage({ type: 'success', text: `Abacus image model set to ${abacusImageModel}` });
                      } else {
                        setMessage({ type: 'error', text: data.error || 'Failed to save' });
                      }
                    } catch { setMessage({ type: 'error', text: 'Failed to save' }); }
                    finally { setSavingAbacusModel(false); }
                  }}
                  disabled={savingAbacusModel}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  {savingAbacusModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Model
                </button>
              </div>
            )}

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-lg border ${
                message.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {message.text}
              </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
                <h3 className="text-blue-400 font-medium mb-2">Get a Gemini API Key</h3>
                <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Google AI Studio</a></li>
                  <li>Sign in with your Google account</li>
                  <li>Click &quot;Create API Key&quot;</li>
                  <li>Copy and paste above</li>
                </ol>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                <h3 className="text-emerald-400 font-medium mb-2">Get an Abacus.AI API Key</h3>
                <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://apps.abacus.ai/profile" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">Abacus.AI Profile</a></li>
                  <li>Sign in to your account</li>
                  <li>Navigate to API Keys section</li>
                  <li>Create and copy your key</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
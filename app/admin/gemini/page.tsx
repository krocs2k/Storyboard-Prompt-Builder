'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, Key, Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle, ImageIcon, Zap, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function GeminiConfigPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [imagenModel, setImagenModel] = useState('imagen-4.0-generate-001');
  const [savingModel, setSavingModel] = useState(false);
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
      setHasKey(data.hasKey);
      setMaskedKey(data.maskedKey);
      setHasEnvKey(data.hasEnvKey);
      if (data.imagenModel) setImagenModel(data.imagenModel);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === 'admin') fetchConfig();
  }, [session]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Gemini API key saved successfully' });
        setApiKey('');
        fetchConfig();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Remove the stored Gemini API key? The system will fall back to the environment variable if one exists.')) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/gemini', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'API key removed' });
        fetchConfig();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove API key' });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen ">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gemini API Configuration</h1>
          <p className="text-gray-500">Manage the Google Gemini / Imagen API key used for image generation</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current status */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                Current Status
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Database Key</span>
                  {hasKey ? (
                    <span className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Configured ({maskedKey})
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-500 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Not set
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Environment Variable Fallback</span>
                  {hasEnvKey ? (
                    <span className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Available
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-500 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Not set
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">The database key takes priority over the environment variable.</p>
              </div>
            </div>

            {/* Image Generation Model Selection */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-400" />
                Image Generation Model
              </h2>
              <p className="text-gray-400 text-sm mb-4">Choose which model to use for all image generation throughout the app.</p>
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
                  <p className="text-gray-400 text-xs">Higher quality, up to 2K resolution. Best for final production images.</p>
                  <p className="text-gray-500 text-xs mt-1">$0.04/image · ~8-12s</p>
                  {imagenModel === 'imagen-4.0-generate-001' && (
                    <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-purple-400" />
                  )}
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
                  <p className="text-gray-400 text-xs">Optimized for speed. Great for rapid prototyping and iteration.</p>
                  <p className="text-gray-500 text-xs mt-1">$0.02/image · ~2-3s</p>
                  {imagenModel === 'imagen-4.0-fast-generate-001' && (
                    <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-amber-400" />
                  )}
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
                  <p className="text-gray-400 text-xs">Gemini 3.1 Flash native image gen. Advanced text rendering &amp; consistency.</p>
                  <p className="text-gray-500 text-xs mt-1">Multimodal · ~3-5s</p>
                  {imagenModel === 'gemini-3.1-flash-image-preview' && (
                    <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-cyan-400" />
                  )}
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
                      const modelNames: Record<string, string> = {
                        'imagen-4.0-generate-001': 'Imagen 4 (Standard)',
                        'imagen-4.0-fast-generate-001': 'Imagen 4 Fast',
                        'gemini-3.1-flash-image-preview': 'Nano Banana 2',
                      };
                      setMessage({ type: 'success', text: `Image model set to ${modelNames[imagenModel] || imagenModel}` });
                    } else {
                      setMessage({ type: 'error', text: data.error || 'Failed to save model preference' });
                    }
                  } catch {
                    setMessage({ type: 'error', text: 'Failed to save model preference' });
                  } finally {
                    setSavingModel(false);
                  }
                }}
                disabled={savingModel}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
              >
                {savingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Model Preference
              </button>
            </div>

            {/* Set new key */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">{hasKey ? 'Update' : 'Set'} API Key</h2>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key..."
                    className="w-full px-4 py-3 pr-12 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving || !apiKey.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Key
                  </button>
                  {hasKey && (
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Key
                    </button>
                  )}
                </div>
              </div>
            </div>

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

            {/* Info */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
              <h3 className="text-amber-400 font-medium mb-2">How to get a Gemini API Key</h3>
              <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline">Google AI Studio</a></li>
                <li>Sign in with your Google account</li>
                <li>Click &quot;Create API Key&quot;</li>
                <li>Copy the generated key and paste it above</li>
              </ol>
              <p className="text-gray-500 text-xs mt-3">This key is used for Imagen 4 image generation throughout the app.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

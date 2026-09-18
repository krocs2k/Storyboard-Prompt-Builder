'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, ArrowLeft, Key, Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle, Zap, Sparkles, Server, Video, ImageIcon, Cpu, ShieldCheck, ShieldX, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import {
  PROVIDERS,
  FUNCTION_LABELS,
  getProviderModels,
  getProvidersForFunction,
  type ApiProviderType,
  type FunctionType,
} from '@/lib/data/provider-models';
import {
  IMAGE_GENERATION_MODELS,
  TEXT_GENERATION_MODELS,
} from '@/lib/data/abacus-models';

type KeyStatus = { hasKey: boolean; maskedKey: string | null; hasEnvKey: boolean; valid?: boolean; validating?: boolean };
type FnConfig = { provider: string; model: string };

const ICON_MAP: Record<string, React.ElementType> = { Zap, Sparkles, ImageIcon, Video, Server, Cpu, Key };
const COLOR_MAP: Record<string, { border: string; bg: string; text: string; check: string }> = {
  blue: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', check: 'text-blue-400' },
  green: { border: 'border-green-500', bg: 'bg-green-500/10', text: 'text-green-400', check: 'text-green-400' },
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', check: 'text-emerald-400' },
};

export default function ApiConfigPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Key state for each provider
  const [keyStatus, setKeyStatus] = useState<Record<ApiProviderType, KeyStatus>>({
    gemini: { hasKey: false, maskedKey: null, hasEnvKey: false },
    openai: { hasKey: false, maskedKey: null, hasEnvKey: false },
    abacus: { hasKey: false, maskedKey: null, hasEnvKey: false },
  });
  const [keyInputs, setKeyInputs] = useState<Record<ApiProviderType, string>>({ gemini: '', openai: '', abacus: '' });
  const [showKeys, setShowKeys] = useState<Record<ApiProviderType, boolean>>({ gemini: false, openai: false, abacus: false });

  // Per-function configuration
  const [fnConfig, setFnConfig] = useState<Record<FunctionType, FnConfig>>({
    llm_ideas: { provider: '', model: '' },
    llm_screenplay: { provider: '', model: '' },
    image: { provider: '', model: '' },
    video: { provider: '', model: '' },
  });
  const [savingFn, setSavingFn] = useState<Record<FunctionType, boolean>>({
    llm_ideas: false, llm_screenplay: false, image: false, video: false,
  });

  // Model search filters per function
  const [modelSearch, setModelSearch] = useState<Record<FunctionType, string>>({
    llm_ideas: '', llm_screenplay: '', image: '', video: '',
  });

  // BunnyCDN storage state
  type BunnyStatus = {
    hasApiKey: boolean; maskedKey: string | null; provisioned: boolean;
    storageZone: string | null; pullZone: string | null; cdnUrl: string | null; region: string | null;
  };
  const [bunny, setBunny] = useState<BunnyStatus>({
    hasApiKey: false, maskedKey: null, provisioned: false,
    storageZone: null, pullZone: null, cdnUrl: null, region: null,
  });
  const [bunnyKeyInput, setBunnyKeyInput] = useState('');
  const [showBunnyKey, setShowBunnyKey] = useState(false);
  const [bunnyRegion, setBunnyRegion] = useState('DE');
  const [bunnySaving, setBunnySaving] = useState(false);
  const [bunnyProvisioning, setBunnyProvisioning] = useState(false);
  const [bunnyTesting, setBunnyTesting] = useState(false);
  const [bunnyMigrating, setBunnyMigrating] = useState(false);

  // ── Image Model Registry state ──
  type ImgModelEntry = { apiName: string; displayName: string; pricePerImage: number; active: boolean };
  const [imgRegistry, setImgRegistry] = useState<ImgModelEntry[]>([]);
  const [imgCheapest, setImgCheapest] = useState<string | null>(null);
  const [imgLive, setImgLive] = useState<string[] | null>(null);
  const [imgLiveError, setImgLiveError] = useState<string | null>(null);
  const [imgRegLoading, setImgRegLoading] = useState(true);
  const [imgRegSaving, setImgRegSaving] = useState(false);
  const [imgRegRefreshing, setImgRegRefreshing] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gemini');
      const data = await res.json();
      if (data.keys) {
        setKeyStatus(prev => ({
          gemini: { ...prev.gemini, ...data.keys.gemini },
          openai: { ...prev.openai, ...data.keys.openai },
          abacus: { ...prev.abacus, ...data.keys.abacus },
        }));
      }
      if (data.functionConfig) {
        setFnConfig(prev => {
          const next = { ...prev };
          for (const [fn, cfg] of Object.entries(data.functionConfig) as [FunctionType, FnConfig][]) {
            if (next[fn]) next[fn] = { provider: cfg.provider || '', model: cfg.model || '' };
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBunny = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bunny');
      if (!res.ok) return;
      const data = await res.json();
      setBunny({
        hasApiKey: !!data.hasApiKey,
        maskedKey: data.maskedKey || null,
        provisioned: !!data.provisioned,
        storageZone: data.storageZone || null,
        pullZone: data.pullZone || null,
        cdnUrl: data.cdnUrl || null,
        region: data.region || null,
      });
      if (data.region) setBunnyRegion(data.region);
    } catch (err) {
      console.error('Failed to fetch BunnyCDN status:', err);
    }
  }, []);

  const fetchImgRegistry = useCallback(async (refresh = false) => {
    if (refresh) setImgRegRefreshing(true); else setImgRegLoading(true);
    try {
      const res = await fetch(`/api/admin/gemini/models${refresh ? '?refresh=true' : ''}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.registry)) setImgRegistry(data.registry);
      setImgCheapest(data.cheapestActive || null);
      if (refresh) {
        setImgLive(Array.isArray(data.live) ? data.live : null);
        setImgLiveError(data.liveError || null);
        if (data.liveError) {
          setMessage({ type: 'error', text: `Could not reach the provider: ${data.liveError}` });
        } else {
          setMessage({ type: 'success', text: `Refreshed. Provider reports ${Array.isArray(data.live) ? data.live.length : 0} valid image model(s).` });
        }
      }
    } catch (err) {
      console.error('Failed to fetch image model registry:', err);
    } finally {
      setImgRegLoading(false);
      setImgRegRefreshing(false);
    }
  }, []);

  const saveImgRegistry = async () => {
    setImgRegSaving(true);
    setMessage(null);
    try {
      const cleaned = imgRegistry
        .map(m => ({ ...m, apiName: m.apiName.trim() }))
        .filter(m => m.apiName);
      if (cleaned.length === 0) {
        setMessage({ type: 'error', text: 'Add at least one model with an API name.' });
        setImgRegSaving(false);
        return;
      }
      const res = await fetch('/api/admin/gemini/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (Array.isArray(data.registry)) setImgRegistry(data.registry);
      setImgCheapest(data.cheapestActive || null);
      setMessage({ type: 'success', text: 'Image model registry saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save registry' });
    } finally {
      setImgRegSaving(false);
    }
  };

  const updateImgRow = (idx: number, patch: Partial<ImgModelEntry>) => {
    setImgRegistry(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };
  const removeImgRow = (idx: number) => setImgRegistry(prev => prev.filter((_, i) => i !== idx));
  const addImgRow = () => setImgRegistry(prev => [...prev, { apiName: '', displayName: '', pricePerImage: 0, active: true }]);
  const addLiveModel = (name: string) => {
    setImgRegistry(prev => prev.some(m => m.apiName === name)
      ? prev
      : [...prev, { apiName: name, displayName: name, pricePerImage: 0, active: false }]);
  };

  useEffect(() => {
    if (session?.user?.role === 'admin') { fetchConfig(); fetchBunny(); fetchImgRegistry(false); }
  }, [session, fetchConfig, fetchBunny, fetchImgRegistry]);

  // ── BunnyCDN management ──

  const saveBunnyKey = async () => {
    const key = bunnyKeyInput.trim();
    if (!key) return;
    setBunnySaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/bunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveKey', apiKey: key }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'BunnyCDN API key saved' });
        setBunnyKeyInput('');
        await fetchBunny();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save key' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save BunnyCDN key' });
    } finally {
      setBunnySaving(false);
    }
  };

  const provisionBunny = async () => {
    setBunnyProvisioning(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/bunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'provision', apiKey: bunnyKeyInput.trim() || undefined, region: bunnyRegion }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'CDN & Cloud Storage set up successfully' });
        setBunnyKeyInput('');
        await fetchBunny();
      } else {
        setMessage({ type: 'error', text: data.error || 'Setup failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'CDN setup failed' });
    } finally {
      setBunnyProvisioning(false);
    }
  };

  const testBunny = async () => {
    setBunnyTesting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/bunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'BunnyCDN test succeeded' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Test failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'BunnyCDN test failed' });
    } finally {
      setBunnyTesting(false);
    }
  };

  const migrateBundledImages = async (dryRun: boolean) => {
    setBunnyMigrating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/bunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'migrate-static', dryRun }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Migration complete' });
        // After a dry-run preview that found files to upload, offer to upload now.
        if (dryRun && data.toUpload > 0) {
          if (confirm(`${data.toUpload} bundled image(s) are not on the CDN yet (~${(data.bytes / 1048576).toFixed(1)} MB). Upload them now?`)) {
            await migrateBundledImages(false);
            return;
          }
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Migration failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Migration failed' });
    } finally {
      setBunnyMigrating(false);
    }
  };

  const deleteBunny = async () => {
    if (!confirm('Remove BunnyCDN configuration? New media will fall back to local storage.')) return;
    setBunnySaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/bunny', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'BunnyCDN configuration removed' });
        await fetchBunny();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove configuration' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove BunnyCDN configuration' });
    } finally {
      setBunnySaving(false);
    }
  };

  // ── Key management ──

  const validateKey = async (prov: ApiProviderType) => {
    // Get the key - either from input or existing
    const inputKey = keyInputs[prov].trim();
    if (!inputKey && !keyStatus[prov].hasKey) return;

    setKeyStatus(prev => ({ ...prev, [prov]: { ...prev[prov], validating: true } }));

    try {
      // If there's a new input key, save it first
      if (inputKey) {
        const bodyKey = prov === 'gemini' ? 'apiKey' : prov === 'abacus' ? 'abacusApiKey' : 'openaiApiKey';
        const saveRes = await fetch('/api/admin/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [bodyKey]: inputKey }),
        });
        if (!saveRes.ok) {
          setMessage({ type: 'error', text: 'Failed to save key' });
          setKeyStatus(prev => ({ ...prev, [prov]: { ...prev[prov], validating: false } }));
          return;
        }
        setKeyInputs(prev => ({ ...prev, [prov]: '' }));
      }

      // Now validate the stored key
      const valRes = await fetch('/api/admin/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: prov, apiKey: inputKey || '__stored__' }),
      });

      // Re-fetch to get latest mask
      await fetchConfig();

      const valData = await valRes.json();
      setKeyStatus(prev => ({
        ...prev,
        [prov]: { ...prev[prov], valid: valData.valid, validating: false },
      }));

      if (valData.valid) {
        setMessage({ type: 'success', text: `${PROVIDERS[prov].name} API key ${inputKey ? 'saved and ' : ''}verified ✓` });
      } else {
        setMessage({ type: 'error', text: `${PROVIDERS[prov].name} key validation failed: ${valData.error || 'Unknown error'}` });
      }
    } catch {
      setKeyStatus(prev => ({ ...prev, [prov]: { ...prev[prov], validating: false } }));
      setMessage({ type: 'error', text: 'Validation failed' });
    }
  };

  const saveKey = async (prov: ApiProviderType) => {
    const key = keyInputs[prov].trim();
    if (!key) return;
    setSaving(true);
    setMessage(null);
    try {
      const bodyKey = prov === 'gemini' ? 'apiKey' : prov === 'abacus' ? 'abacusApiKey' : 'openaiApiKey';
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: key }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `${PROVIDERS[prov].name} API key saved` });
        setKeyInputs(prev => ({ ...prev, [prov]: '' }));
        fetchConfig();
        // Auto-validate after save
        setTimeout(() => validateStoredKey(prov, key), 100);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setSaving(false);
    }
  };

  const validateStoredKey = async (prov: ApiProviderType, key: string) => {
    setKeyStatus(prev => ({ ...prev, [prov]: { ...prev[prov], validating: true } }));
    try {
      const res = await fetch('/api/admin/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: prov, apiKey: key }),
      });
      const data = await res.json();
      setKeyStatus(prev => ({ ...prev, [prov]: { ...prev[prov], valid: data.valid, validating: false } }));
    } catch {
      setKeyStatus(prev => ({ ...prev, [prov]: { ...prev[prov], validating: false } }));
    }
  };

  const deleteKey = async (prov: ApiProviderType) => {
    if (!confirm(`Remove the stored ${PROVIDERS[prov].name} API key?`)) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/gemini?type=${prov}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `${PROVIDERS[prov].name} API key removed` });
        setKeyStatus(prev => ({ ...prev, [prov]: { ...prev[prov], hasKey: false, maskedKey: null, valid: undefined } }));
        fetchConfig();
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove' });
    } finally {
      setSaving(false);
    }
  };

  // ── Per-function config save ──

  const saveFnConfig = async (fn: FunctionType) => {
    setSavingFn(prev => ({ ...prev, [fn]: true }));
    setMessage(null);
    try {
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functionConfig: { [fn]: fnConfig[fn] } }),
      });
      const data = await res.json();
      if (data.success) {
        const provName = fnConfig[fn].provider ? PROVIDERS[fnConfig[fn].provider as ApiProviderType]?.name : 'Default';
        setMessage({ type: 'success', text: `${FUNCTION_LABELS[fn].title} → ${provName} ${fnConfig[fn].model ? '/ ' + fnConfig[fn].model : ''}` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSavingFn(prev => ({ ...prev, [fn]: false }));
    }
  };

  // ── Helpers ──

  const hasValidKey = (prov: ApiProviderType) => keyStatus[prov].hasKey || keyStatus[prov].hasEnvKey;

  /** Get models for the selected provider + function, merging Abacus proxied models where needed */
  const getModelsForFn = (fn: FunctionType, prov: ApiProviderType) => {
    if (prov === 'abacus') {
      // Abacus models come from abacus-models.ts
      if (fn === 'llm_ideas' || fn === 'llm_screenplay') {
        return [
          { id: '', name: 'Default (gemini-3-flash-preview)', description: 'System default model' },
          ...TEXT_GENERATION_MODELS.filter(m => m.id !== 'route-llm').map(m => ({ id: m.id, name: m.name, description: m.description, cost: m.cost })),
        ];
      }
      if (fn === 'image') {
        return IMAGE_GENERATION_MODELS.map(m => ({ id: m.id, name: m.name, description: m.description, cost: m.cost, supportsRefImage: m.supportsRefImage }));
      }
      return []; // Abacus doesn't support video
    }
    // Gemini / OpenAI - use provider-models.ts
    return getProviderModels(prov, fn).map(m => ({ ...m }));
  };

  /** Get the available providers for a function, filtered to those with keys */
  const getAvailableProviders = (fn: FunctionType) => {
    return getProvidersForFunction(fn).filter(p => hasValidKey(p.id));
  };

  // ── Render ──

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  const fnOrder: FunctionType[] = ['llm_ideas', 'llm_screenplay', 'image', 'video'];

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Hybrid API Configuration</h1>
          <p className="text-gray-500">Connect your API providers and assign models to each function independently.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* ═══ Section 1: API Keys ═══ */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                API Provider Keys
              </h2>
              <p className="text-gray-500 text-sm mb-4">Add your API keys below. Only providers with valid keys will appear as options for each function.</p>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {(['gemini', 'openai', 'abacus'] as ApiProviderType[]).map(prov => {
                  const info = PROVIDERS[prov];
                  const ks = keyStatus[prov];
                  const c = COLOR_MAP[info.color] || COLOR_MAP.blue;
                  const IconComp = ICON_MAP[info.icon] || Key;
                  return (
                    <div key={prov} className={`bg-gray-800 border shadow-lg rounded-xl p-5 transition-all ${
                      ks.hasKey || ks.hasEnvKey ? `${c.border}/30` : 'border-gray-700'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                          <IconComp className={`w-4 h-4 ${c.text}`} />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-sm">{info.name}</h3>
                          <p className="text-gray-500 text-[10px]">{info.description}</p>
                        </div>
                      </div>

                      {/* Status badges */}
                      <div className="space-y-1.5 mb-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Status</span>
                          {ks.hasKey ? (
                            <span className="flex items-center gap-1">
                              {ks.valid === true && <ShieldCheck className="w-3.5 h-3.5 text-green-400" />}
                              {ks.valid === false && <ShieldX className="w-3.5 h-3.5 text-red-400" />}
                              {ks.valid === undefined && <CheckCircle className="w-3.5 h-3.5 text-yellow-400" />}
                              <span className={ks.valid === false ? 'text-red-400' : 'text-green-400'}>{ks.maskedKey}</span>
                            </span>
                          ) : ks.hasEnvKey ? (
                            <span className="text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Env var only</span>
                          ) : (
                            <span className="text-gray-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Not set</span>
                          )}
                        </div>
                      </div>

                      {/* Key input */}
                      <div className="relative mb-2">
                        <input
                          type={showKeys[prov] ? 'text' : 'password'}
                          value={keyInputs[prov]}
                          onChange={e => setKeyInputs(prev => ({ ...prev, [prov]: e.target.value }))}
                          placeholder={`Enter ${info.name} API key...`}
                          className="w-full px-3 py-2 pr-9 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono text-xs"
                        />
                        <button
                          onClick={() => setShowKeys(prev => ({ ...prev, [prov]: !prev[prov] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showKeys[prov] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveKey(prov)}
                          disabled={saving || !keyInputs[prov].trim()}
                          className={`flex items-center gap-1.5 px-3 py-1.5 ${c.bg} hover:opacity-80 disabled:bg-gray-700 disabled:text-gray-500 ${c.text} rounded-lg transition-colors font-medium text-xs border ${c.border}/30`}
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save
                        </button>
                        {(ks.hasKey || ks.hasEnvKey) && (
                          <button
                            onClick={() => validateKey(prov)}
                            disabled={ks.validating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-xs"
                          >
                            {ks.validating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Verify
                          </button>
                        )}
                        {ks.hasKey && (
                          <button
                            onClick={() => deleteKey(prov)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Docs link */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <a href={info.docsUrl} target="_blank" rel="noopener noreferrer" className={`${c.text} text-xs hover:underline`}>
                          Get API Key →
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* ═══ Section: BunnyCDN Storage & CDN ═══ */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Server className="w-5 h-5 text-orange-500" />
                Cloud Storage &amp; CDN (BunnyCDN)
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Provide a BunnyCDN Account API key, then set up storage automatically. Once configured, all images, documents, video and audio generated by the app are stored on BunnyCDN and served over its global CDN.
              </p>

              <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-5">
                {/* Status banner */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bunny.provisioned ? 'bg-green-500/15' : 'bg-orange-500/10'}`}>
                      <Server className={`w-5 h-5 ${bunny.provisioned ? 'text-green-400' : 'text-orange-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">BunnyCDN</h3>
                      <p className="text-gray-500 text-xs">
                        {bunny.provisioned
                          ? 'Active — media is stored on and served from BunnyCDN'
                          : bunny.hasApiKey
                            ? 'API key saved — click "Set Up CDN & Cloud Storage" to provision'
                            : 'Not configured — media is served from local storage'}
                      </p>
                    </div>
                  </div>
                  {bunny.provisioned ? (
                    <span className="text-xs bg-green-500/15 text-green-400 px-2.5 py-1 rounded-full border border-green-500/30 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Provisioned
                    </span>
                  ) : bunny.hasApiKey ? (
                    <span className="text-xs bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/30">Key saved</span>
                  ) : null}
                </div>

                {/* API key input */}
                <label className="block text-gray-300 text-sm font-medium mb-1.5">Account API Key</label>
                <div className="flex items-center gap-2 mb-1">
                  <div className="relative flex-1">
                    <input
                      type={showBunnyKey ? 'text' : 'password'}
                      value={bunnyKeyInput}
                      onChange={e => setBunnyKeyInput(e.target.value)}
                      placeholder={bunny.hasApiKey ? (bunny.maskedKey || '••••••••') : 'Enter your BunnyCDN Account API key'}
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBunnyKey(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showBunnyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={saveBunnyKey}
                    disabled={bunnySaving || !bunnyKeyInput.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
                  >
                    {bunnySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Key
                  </button>
                </div>
                <div className="mb-4">
                  <a href="https://dash.bunny.net/account/settings" target="_blank" rel="noopener noreferrer" className="text-orange-400 text-xs hover:underline">
                    Get your Account API key from bunny.net → Account Settings → API →
                  </a>
                </div>

                {/* Region + provision */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-4 border-t border-gray-700">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1.5">Primary Region</label>
                    <select
                      value={bunnyRegion}
                      onChange={e => setBunnyRegion(e.target.value)}
                      disabled={bunny.provisioned}
                      className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60"
                    >
                      <option value="DE">Europe (Falkenstein, DE)</option>
                      <option value="UK">Europe (London, UK)</option>
                      <option value="SE">Europe (Stockholm, SE)</option>
                      <option value="NY">US East (New York)</option>
                      <option value="LA">US West (Los Angeles)</option>
                      <option value="BR">South America (São Paulo)</option>
                      <option value="SG">Asia (Singapore)</option>
                      <option value="SYD">Oceania (Sydney)</option>
                      <option value="JH">Africa (Johannesburg)</option>
                    </select>
                  </div>
                  <button
                    onClick={provisionBunny}
                    disabled={bunnyProvisioning || (!bunny.hasApiKey && !bunnyKeyInput.trim())}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
                  >
                    {bunnyProvisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                    {bunny.provisioned ? 'Re-provision Storage' : 'Set Up CDN & Cloud Storage'}
                  </button>
                  {bunny.provisioned && (
                    <>
                      <button
                        onClick={testBunny}
                        disabled={bunnyTesting}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg transition-colors text-sm"
                      >
                        {bunnyTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Test
                      </button>
                      <button
                        onClick={() => migrateBundledImages(true)}
                        disabled={bunnyMigrating}
                        title="Upload the app's bundled/default category images to the CDN so they still load if the local files are missing."
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg transition-colors text-sm"
                      >
                        {bunnyMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                        Migrate bundled images
                      </button>
                      <button
                        onClick={deleteBunny}
                        disabled={bunnySaving}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </>
                  )}
                </div>

                {/* Provisioned details */}
                {bunny.provisioned && (
                  <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Storage Zone</span>
                      <span className="text-gray-200 font-mono text-xs">{bunny.storageZone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Pull Zone</span>
                      <span className="text-gray-200 font-mono text-xs">{bunny.pullZone}</span>
                    </div>
                    <div className="flex items-center justify-between sm:col-span-2">
                      <span className="text-gray-500">CDN URL</span>
                      <a href={bunny.cdnUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-orange-400 font-mono text-xs hover:underline">{bunny.cdnUrl}</a>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Region</span>
                      <span className="text-gray-200 font-mono text-xs">{bunny.region}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>


            {/* ═══ Section 2: Per-Function Configuration ═══ */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Function Assignments
              </h2>
              <p className="text-gray-500 text-sm mb-4">Assign a specific provider and model to each function. Leave blank to use the system default.</p>

              <div className="space-y-5">
                {fnOrder.map(fn => {
                  const label = FUNCTION_LABELS[fn];
                  const FnIcon = ICON_MAP[label.icon] || Sparkles;
                  const availableProviders = getAvailableProviders(fn);
                  const selectedProv = fnConfig[fn].provider as ApiProviderType;
                  const models = selectedProv ? getModelsForFn(fn, selectedProv) : [];
                  const search = modelSearch[fn].toLowerCase();
                  const filteredModels = search
                    ? models.filter(m => m.name.toLowerCase().includes(search) || m.id.toLowerCase().includes(search) || (m.description || '').toLowerCase().includes(search))
                    : models;

                  return (
                    <div key={fn} className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <FnIcon className="w-5 h-5 text-amber-400" />
                          <div>
                            <h3 className="text-white font-semibold">{label.title}</h3>
                            <p className="text-gray-500 text-xs">{label.description}</p>
                          </div>
                        </div>
                        {fnConfig[fn].provider && fnConfig[fn].model && (
                          <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                            {PROVIDERS[selectedProv]?.name} / {fnConfig[fn].model}
                          </span>
                        )}
                      </div>

                      {/* Provider selection */}
                      <div className="mb-3">
                        <label className="text-xs text-gray-400 block mb-1.5">Provider</label>
                        {availableProviders.length === 0 ? (
                          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            No API keys configured for {fn === 'video' ? 'Gemini or OpenAI' : 'any provider'}. Add keys above first.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <button
                              onClick={() => setFnConfig(prev => ({ ...prev, [fn]: { provider: '', model: '' } }))}
                              className={`p-2.5 rounded-lg border-2 transition-all text-left text-xs ${
                                !fnConfig[fn].provider
                                  ? 'border-gray-400 bg-gray-400/10'
                                  : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                              }`}
                            >
                              <span className="text-white font-semibold">System Default</span>
                              <p className="text-gray-500 text-[10px] mt-0.5">Auto-select best available</p>
                              {!fnConfig[fn].provider && <CheckCircle className="w-3.5 h-3.5 text-gray-400 absolute top-1.5 right-1.5" />}
                            </button>
                            {availableProviders.map(p => {
                              const pc = COLOR_MAP[p.color] || COLOR_MAP.blue;
                              const PIcon = ICON_MAP[p.icon] || Key;
                              const isSelected = fnConfig[fn].provider === p.id;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => setFnConfig(prev => ({ ...prev, [fn]: { provider: p.id, model: '' } }))}
                                  className={`relative p-2.5 rounded-lg border-2 transition-all text-left text-xs ${
                                    isSelected
                                      ? `${pc.border} ${pc.bg}`
                                      : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <PIcon className={`w-3.5 h-3.5 ${pc.text}`} />
                                    <span className="text-white font-semibold">{p.name}</span>
                                  </div>
                                  <p className="text-gray-500 text-[10px]">{p.models.filter(m => m.functions.includes(fn)).length || (p.id === 'abacus' ? '100+' : '0')} models</p>
                                  {isSelected && <CheckCircle className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 ${pc.check}`} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Model selection */}
                      {selectedProv && models.length > 0 && (
                        <div className="mb-3">
                          <label className="text-xs text-gray-400 block mb-1.5">Model</label>
                          {models.length > 6 && (
                            <input
                              type="text"
                              placeholder="Search models..."
                              value={modelSearch[fn]}
                              onChange={e => setModelSearch(prev => ({ ...prev, [fn]: e.target.value }))}
                              className="w-full mb-2 px-3 py-1.5 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-xs placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                            />
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-1">
                            {filteredModels.map(m => (
                              <button
                                key={m.id}
                                onClick={() => setFnConfig(prev => ({ ...prev, [fn]: { ...prev[fn], model: m.id } }))}
                                className={`relative p-2.5 rounded-lg border-2 transition-all text-left ${
                                  fnConfig[fn].model === m.id
                                    ? 'border-amber-500 bg-amber-500/10'
                                    : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                                }`}
                              >
                                <span className="text-white font-semibold text-xs block mb-0.5">{m.name}</span>
                                {m.description && <p className="text-gray-400 text-[10px] leading-tight">{m.description}</p>}
                                {'cost' in m && m.cost && <p className="text-amber-400/60 text-[9px] mt-0.5 font-mono">{m.cost}</p>}
                                {fnConfig[fn].model === m.id && <CheckCircle className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-amber-400" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Save button */}
                      <button
                        onClick={() => saveFnConfig(fn)}
                        disabled={savingFn[fn]}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
                      >
                        {savingFn[fn] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save {label.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ Section: Image Model Registry ═══ */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                Image Model Registry
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Manage the image models the app is allowed to use — the exact <span className="font-mono">API name</span> sent in the provider call, a friendly name, and the price per image. The app always renders with the <strong>cheapest active</strong> model to protect margin, and if a model name stops being valid it is automatically replaced with the cheapest valid one (you&apos;ll be prompted to retry). Use <strong>Refresh from provider</strong> to pull the list of model names Google currently accepts.
              </p>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-gray-300">
                    {imgCheapest
                      ? <>Current render model (cheapest active): <span className="font-mono text-emerald-400">{imgCheapest}</span></>
                      : <span className="text-amber-400">No active model — add or activate one below.</span>}
                  </div>
                  <button
                    onClick={() => fetchImgRegistry(true)}
                    disabled={imgRegRefreshing}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    {imgRegRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Refresh from provider
                  </button>
                </div>

                {imgRegLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading registry…</div>
                ) : (
                  <>
                    {/* Header row */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <div className="col-span-4">API name (used in call)</div>
                      <div className="col-span-3">Display name</div>
                      <div className="col-span-2">Price / image (USD)</div>
                      <div className="col-span-2">Active</div>
                      <div className="col-span-1"></div>
                    </div>
                    {imgRegistry.map((m, idx) => {
                      const validOnProvider = imgLive ? imgLive.includes(m.apiName) : null;
                      return (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-gray-800/50 rounded-lg p-2">
                          <div className="md:col-span-4 flex items-center gap-2">
                            <input
                              value={m.apiName}
                              onChange={e => updateImgRow(idx, { apiName: e.target.value })}
                              placeholder="gemini-2.5-flash-image"
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                            />
                            {validOnProvider === true && <span title="Valid on provider"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /></span>}
                            {validOnProvider === false && <span title="Not reported by provider"><ShieldX className="w-4 h-4 text-red-400 shrink-0" /></span>}
                          </div>
                          <div className="md:col-span-3">
                            <input
                              value={m.displayName}
                              onChange={e => updateImgRow(idx, { displayName: e.target.value })}
                              placeholder="Friendly name"
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <input
                              type="number" step="0.001" min="0"
                              value={m.pricePerImage}
                              onChange={e => updateImgRow(idx, { pricePerImage: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <button
                              onClick={() => updateImgRow(idx, { active: !m.active })}
                              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${m.active ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                            >
                              {m.active ? 'Active' : 'Inactive'}
                            </button>
                          </div>
                          <div className="md:col-span-1 flex justify-end">
                            <button onClick={() => removeImgRow(idx)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title="Remove">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button onClick={addImgRow} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors">+ Add model</button>
                      <button
                        onClick={saveImgRegistry}
                        disabled={imgRegSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
                      >
                        {imgRegSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save registry
                      </button>
                    </div>

                    {/* Live provider results */}
                    {imgLiveError && (
                      <p className="text-sm text-red-400">Provider refresh error: {imgLiveError}. Check the Gemini API key above.</p>
                    )}
                    {imgLive && imgLive.length > 0 && (
                      <div className="border-t border-gray-800 pt-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Image models the provider currently accepts</p>
                        <div className="flex flex-wrap gap-2">
                          {imgLive.map(name => {
                            const inRegistry = imgRegistry.some(m => m.apiName === name);
                            return (
                              <button
                                key={name}
                                onClick={() => addLiveModel(name)}
                                disabled={inRegistry}
                                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${inRegistry ? 'bg-gray-800 text-gray-500 cursor-default' : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/40'}`}
                                title={inRegistry ? 'Already in registry' : 'Add to registry (inactive, set a price)'}
                              >
                                {inRegistry ? '✓ ' : '+ '}{name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
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

            {/* Info note */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
              <h3 className="text-amber-500 font-medium mb-2">How Hybrid Mode Works</h3>
              <ul className="text-gray-500 text-sm space-y-1 list-disc list-inside">
                <li>Each function can use a different provider and model independently</li>
                <li>Only providers with configured API keys appear as options</li>
                <li>Video generation is available through Gemini (Veo) and OpenAI (Sora)</li>
                <li>&quot;System Default&quot; will use the first available provider with a valid key</li>
                <li>Changes take effect immediately for new API calls</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

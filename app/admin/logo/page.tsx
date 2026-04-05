'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Loader2, Upload, Check, AlertCircle, ArrowLeft, Image as ImageIcon, Smartphone, Monitor, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface IconInfo {
  name: string;
  size: number;
  exists: boolean;
}

interface SplashInfo {
  name: string;
  width: number;
  height: number;
  label: string;
  exists: boolean;
}

export default function AdminLogoPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [icons, setIcons] = useState<IconInfo[]>([]);
  const [splashScreens, setSplashScreens] = useState<SplashInfo[]>([]);
  const [hasLogo, setHasLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  const fetchInfo = async () => {
    setLoadingInfo(true);
    try {
      const res = await fetch('/api/admin/logo');
      const data = await res.json();
      setIcons(data.icons || []);
      setSplashScreens(data.splashScreens || []);
      setHasLogo(data.hasLogo || false);
    } catch (err) {
      console.error('Failed to fetch logo info:', err);
    } finally {
      setLoadingInfo(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === 'admin') fetchInfo();
  }, [session]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch('/api/admin/logo', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setPreview(null);
        if (fileRef.current) fileRef.current.value = '';
        await fetchInfo();
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error during upload' });
    } finally {
      setUploading(false);
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

  const iconCount = icons.filter(i => i.exists).length;
  const splashCount = splashScreens.filter(s => s.exists).length;

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/admin" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Logo &amp; PWA Assets</h1>
              <p className="text-gray-600 text-sm">Upload your logo to generate all PWA icons, splash screens &amp; favicons</p>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-semibold">{loadingInfo ? '...' : `${iconCount}/${icons.length}`}</p>
                <p className="text-gray-400 text-xs">App Icons</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold">{loadingInfo ? '...' : `${splashCount}/${splashScreens.length}`}</p>
                <p className="text-gray-400 text-xs">Splash Screens</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasLogo ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {hasLogo ? <Check className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
              </div>
              <div>
                <p className="text-white font-semibold">{loadingInfo ? '...' : hasLogo ? 'Complete' : 'Incomplete'}</p>
                <p className="text-gray-400 text-xs">PWA Ready</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Upload Logo</h2>
          <p className="text-gray-400 text-sm mb-4">
            Upload a square PNG or SVG logo (512×512 or larger recommended). This will auto-generate:
          </p>
          <ul className="text-gray-400 text-sm mb-6 space-y-1 ml-4">
            <li>• 5 icon sizes (16px, 32px, 180px, 192px, 512px)</li>
            <li>• 12 Apple splash screens for all device sizes</li>
            <li>• SVG favicon</li>
          </ul>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            {preview && (
              <div className="w-24 h-24 rounded-xl border-2 border-amber-500/50 overflow-hidden bg-slate-900 flex items-center justify-center">
                <img src={preview} alt="Logo preview" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 file:cursor-pointer"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !preview}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 disabled:text-gray-400 text-slate-900 font-semibold text-sm rounded-lg transition-colors"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Upload className="w-4 h-4" /> Generate All Assets</>
              )}
            </button>
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Current Icons */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Current App Icons</h2>
          <div className="grid grid-cols-5 gap-4">
            {icons.map((icon) => (
              <div key={icon.name} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-lg bg-slate-900 border border-gray-600 flex items-center justify-center overflow-hidden">
                  {icon.exists ? (
                    <img src={`/${icon.name}?t=${Date.now()}`} alt={icon.name} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-300">{icon.size}px</p>
                  <p className={`text-xs ${icon.exists ? 'text-green-400' : 'text-red-400'}`}>
                    {icon.exists ? '✓' : '✗'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Splash Screens */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Apple Splash Screens</h2>
            <span className="text-xs text-gray-400">{splashCount}/{splashScreens.length} generated</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {splashScreens.map((splash) => (
              <div key={splash.name} className={`flex items-center gap-3 p-3 rounded-lg border ${splash.exists ? 'border-green-500/30 bg-green-500/5' : 'border-gray-600 bg-gray-700/30'}`}>
                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${splash.exists ? 'bg-green-500/20' : 'bg-gray-600/30'}`}>
                  {splash.exists ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Monitor className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-white font-medium truncate">{splash.label}</p>
                  <p className="text-xs text-gray-500">{splash.width}×{splash.height}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Save, BookOpen, ArrowLeft, CheckCircle2 } from 'lucide-react';

type BibleKind = 'novel' | 'screenplay';

interface Props {
  kind: BibleKind;
  title: string;
  subtitle: string;
  description: string;
  placeholder: string;
  iconWrapClass: string; // e.g. 'bg-indigo-500/20'
  iconClass: string; // e.g. 'text-indigo-400'
}

export default function CreationBibleEditor({ kind, title, subtitle, description, placeholder, iconWrapClass, iconClass }: Props) {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.replace('/');
    }
  }, [status, session, router, mounted]);

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetch('/api/admin/creation-bible')
        .then((res) => res.json())
        .then((data) => {
          setContent(typeof data?.[kind] === 'string' ? data[kind] : '');
        })
        .catch(() => setError('Failed to load saved content'))
        .finally(() => setLoading(false));
    }
  }, [session, kind]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/admin/creation-bible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Save failed');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/admin" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Administration
          </Link>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${iconWrapClass} flex items-center justify-center`}>
              <BookOpen className={`w-6 h-6 ${iconClass}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              <p className="text-gray-400 text-sm">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
          <p className="text-gray-300 text-sm mb-4 leading-relaxed">{description}</p>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : (
            <>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                spellCheck={false}
                className="w-full h-[460px] rounded-lg bg-gray-900 border border-gray-700 text-gray-100 text-sm p-4 font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/40"
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-500">{content.length.toLocaleString()} characters</span>
                <div className="flex items-center gap-3">
                  {error && <span className="text-sm text-red-400">{error}</span>}
                  {saved && (
                    <span className="inline-flex items-center gap-1 text-sm text-green-400">
                      <CheckCircle2 className="w-4 h-4" /> Saved
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white rounded-lg transition-colors font-medium"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save Bible'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

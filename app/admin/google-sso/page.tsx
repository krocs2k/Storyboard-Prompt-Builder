'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, Eye, EyeOff, Save, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function GoogleSSOPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [secretSet, setSecretSet] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      fetch('/api/admin/google-sso')
        .then(res => res.json())
        .then(data => {
          setClientId(data.clientId || '');
          setSecretSet(data.clientSecretSet || false);
          setEnabled(data.enabled || false);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const body: { clientId: string; clientSecret?: string; enabled: boolean } = {
        clientId,
        enabled
      };

      if (clientSecret) {
        body.clientSecret = clientSecret;
      }

      const res = await fetch('/api/admin/google-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Google SSO settings saved successfully' });
        if (clientSecret) {
          setSecretSet(true);
          setClientSecret('');
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null;
  }

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/callback/google`
    : '/api/auth/callback/google';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Google SSO Configuration</h1>
          <p className="text-gray-400">Configure Google OAuth for user authentication</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/50 text-green-400'
              : 'bg-red-500/10 border border-red-500/50 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            {message.text}
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Setup Instructions</h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-400 text-sm">
            <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
            <li>Create a new project or select an existing one</li>
            <li>Navigate to &quot;APIs &amp; Services&quot; → &quot;Credentials&quot;</li>
            <li>Click &quot;Create Credentials&quot; → &quot;OAuth client ID&quot;</li>
            <li>Select &quot;Web application&quot; as the application type</li>
            <li>Add the authorized redirect URI below</li>
            <li>Copy the Client ID and Client Secret</li>
          </ol>

          <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Authorized Redirect URI:</p>
            <code className="text-rose-400 text-sm break-all">{callbackUrl}</code>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${
                    enabled ? 'bg-rose-500' : 'bg-gray-600'
                  }`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? 'translate-x-5' : 'translate-x-0.5'
                    } mt-0.5`} />
                  </div>
                </div>
                <span className="text-white font-medium">Enable Google SSO</span>
              </label>
              <p className="text-gray-400 text-sm mt-2 ml-14">
                When enabled, users will see &quot;Sign in with Google&quot; on the login page
              </p>
            </div>

            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-300 mb-2">
                Client ID
              </label>
              <input
                id="clientId"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                placeholder="Enter Google Client ID"
              />
            </div>

            <div>
              <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-300 mb-2">
                Client Secret
                {secretSet && <span className="text-green-400 ml-2">(Already configured)</span>}
              </label>
              <div className="relative">
                <input
                  id="clientSecret"
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder={secretSet ? 'Enter new secret to update' : 'Enter Google Client Secret'}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {secretSet
                  ? 'Leave empty to keep the current secret'
                  : 'The client secret is securely stored and never exposed'}
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || (!clientId && !clientSecret)}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-purple-600 text-white font-semibold rounded-lg hover:from-rose-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/50 rounded-lg">
          <p className="text-amber-400 text-sm">
            <strong>Note:</strong> Changes to Google SSO settings take effect immediately. Make sure to test the login flow after making changes.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, Mail, CheckCircle, XCircle, Trash2, Zap, Send, Eye, EyeOff, Info } from 'lucide-react';
import Link from 'next/link';

interface SmtpFormData {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
}

const PRESETS: { name: string; host: string; port: string; note: string }[] = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: '587', note: 'Use an App Password (not your regular password)' },
  { name: 'Outlook / Office 365', host: 'smtp.office365.com', port: '587', note: '' },
  { name: 'SendGrid', host: 'smtp.sendgrid.net', port: '587', note: 'Username is "apikey", password is your API key' },
  { name: 'Mailgun', host: 'smtp.mailgun.org', port: '587', note: '' },
  { name: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: '587', note: 'Use your SES SMTP credentials (not IAM keys)' },
  { name: 'Zoho', host: 'smtp.zoho.com', port: '465', note: '' },
];

export default function EmailConfigPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [form, setForm] = useState<SmtpFormData>({ host: '', port: '587', user: '', pass: '', from: '' });
  const [configured, setConfigured] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{ host: string; user: string; from: string } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetch('/api/admin/email')
        .then(res => res.json())
        .then(data => {
          setConfigured(data.configured);
          if (data.configured) {
            setSavedInfo({ host: data.host, user: data.user, from: data.from });
            // Pre-fill non-secret fields
            setForm(f => ({ ...f, host: data.host || '', port: data.port || '587', user: data.user || '', from: data.from || '' }));
          }
          if (session.user?.email) setTestEmail(session.user.email);
        })
        .catch(console.error);
    }
  }, [session]);

  const updateForm = (field: keyof SmtpFormData, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setTestResult(null);
    setSaveMessage(null);
    setSendResult(null);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setForm(f => ({ ...f, host: preset.host, port: preset.port }));
    setTestResult(null);
    setSaveMessage(null);
  };

  // Save requires host + user + (new password OR existing saved config)
  const isFormValid = form.host.trim() && form.user.trim() && (form.pass.trim() || configured);
  // Test/send can work with saved config (no new password needed) or with full form
  const canTestOrSend = isFormValid || configured;

  const handleTest = async () => {
    if (!canTestOrSend) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', ...form }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Request failed' });
    }
    setTesting(false);
  };

  const handleSendTest = async () => {
    if (!canTestOrSend || !testEmail.trim()) return;
    setSendingTest(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_test', ...form, recipient: testEmail }),
      });
      const data = await res.json();
      setSendResult(data);
    } catch {
      setSendResult({ success: false, error: 'Request failed' });
    }
    setSendingTest(false);
  };

  const handleSave = async () => {
    if (!isFormValid) return;
    setLoading(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...form }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Mail server configured successfully!' });
        setConfigured(true);
        setSavedInfo({ host: form.host, user: form.user, from: form.from || form.user });
        setForm(f => ({ ...f, pass: '' }));
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Request failed' });
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm('Remove mail server configuration? Email sending will be disabled.')) return;
    setLoading(true);
    try {
      await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      setConfigured(false);
      setSavedInfo(null);
      setForm({ host: '', port: '587', user: '', pass: '', from: '' });
      setSaveMessage({ type: 'success', text: 'Mail server configuration removed' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to delete' });
    }
    setLoading(false);
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }
  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4">
            <ArrowLeft size={18} /> Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Mail className="text-blue-400" /> Mail Server (SMTP)
          </h1>
          <p className="text-gray-500">Configure SMTP for sending email verification, invitations, and notifications.</p>
        </div>

        {/* Current Status */}
        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Status</h2>
          <div className="flex items-center gap-3">
            {configured ? (
              <>
                <CheckCircle className="text-green-400" size={20} />
                <div>
                  <span className="text-green-400 font-medium">Configured</span>
                  {savedInfo && (
                    <p className="text-gray-500 text-sm font-mono mt-1">
                      {savedInfo.host} — {savedInfo.user}
                      {savedInfo.from && savedInfo.from !== savedInfo.user && (
                        <span className="text-gray-600"> (from: {savedInfo.from})</span>
                      )}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle className="text-gray-500" size={20} />
                <span className="text-gray-400">Not configured — emails will be logged to console</span>
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

        {/* Quick Presets */}
        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Quick Presets</h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm"
              >
                {preset.name}
              </button>
            ))}
          </div>
          {PRESETS.find(p => p.host === form.host)?.note && (
            <p className="text-amber-400/80 text-xs mt-3 flex items-start gap-1.5">
              <Info size={14} className="shrink-0 mt-0.5" />
              {PRESETS.find(p => p.host === form.host)?.note}
            </p>
          )}
        </div>

        {/* Configuration Form */}
        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">{configured ? 'Update' : 'Configure'} Mail Server</h2>
          <div className="space-y-4">
            {/* Host + Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm text-gray-300 mb-1.5">SMTP Host</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={e => updateForm('host', e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={e => updateForm('port', e.target.value)}
                  placeholder="587"
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                />
                <p className="text-gray-600 text-xs mt-1">{form.port === '465' ? 'SSL/TLS' : 'STARTTLS'}</p>
              </div>
            </div>

            {/* User */}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Username / Email</label>
              <input
                type="text"
                value={form.user}
                onChange={e => updateForm('user', e.target.value)}
                placeholder="your-email@gmail.com"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Password / App Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.pass}
                  onChange={e => updateForm('pass', e.target.value)}
                  placeholder={configured ? '(unchanged — enter new to update)' : 'Enter password or app-specific password'}
                  className="w-full px-4 py-2.5 pr-10 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* From */}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">From Address <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={form.from}
                onChange={e => updateForm('from', e.target.value)}
                placeholder={form.user || 'noreply@yourdomain.com'}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
              />
              <p className="text-gray-600 text-xs mt-1">Defaults to username if left empty</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleTest}
                disabled={testing || !canTestOrSend}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                Test Connection
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !isFormValid}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                Save & Connect
              </button>
            </div>

            {/* Test Connection Result */}
            {testResult && (
              <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                {testResult.success ? (
                  <p className="text-green-400 text-sm flex items-center gap-2">
                    <CheckCircle size={16} /> SMTP connection verified!
                  </p>
                ) : (
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <XCircle size={16} /> {testResult.error}
                  </p>
                )}
              </div>
            )}

            {/* Save Result */}
            {saveMessage && (
              <div className={`p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <p className={`text-sm ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{saveMessage.text}</p>
              </div>
            )}
          </div>
        </div>

        {/* Send Test Email */}
        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Send Test Email</h2>
          <p className="text-gray-400 text-sm mb-4">Verify that emails are actually delivered by sending a test message.</p>
          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={e => { setTestEmail(e.target.value); setSendResult(null); }}
              placeholder="recipient@example.com"
              className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
            />
            <button
              onClick={handleSendTest}
              disabled={sendingTest || !canTestOrSend || !testEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              {sendingTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send Test
            </button>
          </div>
          {sendResult && (
            <div className={`mt-3 p-3 rounded-lg ${sendResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <p className={`text-sm ${sendResult.success ? 'text-green-400' : 'text-red-400'} flex items-center gap-2`}>
                {sendResult.success ? <><CheckCircle size={16} /> Test email sent! Check your inbox.</> : <><XCircle size={16} /> {sendResult.error}</>}
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-white font-medium mb-2">What emails are sent?</h3>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>• <strong className="text-gray-300">Email Verification</strong> — when new users register</li>
            <li>• <strong className="text-gray-300">User Invitations</strong> — when you invite someone from User Management</li>
          </ul>
          <p className="text-gray-500 text-xs mt-3">
            Without SMTP configured, emails are logged to the server console. Registration still works — users just can&apos;t verify their email.
          </p>
        </div>
      </div>
    </div>
  );
}

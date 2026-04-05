'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Users, Settings, Shield, Github, Database, Key, Image as ImageIcon, BarChart3, Film, Mail, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [userCount, setUserCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
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
      fetch('/api/admin/users')
        .then(res => res.json())
        .then(data => {
          if (data.users) {
            setUserCount(data.users.length);
            setPendingCount(data.users.filter((u: { isActive: boolean; emailVerified: Date | null }) => !u.isActive && u.emailVerified).length);
          }
        })
        .catch(console.error);
    }
  }, [session]);

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Administration</h1>
              <p className="text-gray-600">Manage users and system settings</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to App
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/admin/users"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-rose-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-rose-500/20 flex items-center justify-center group-hover:bg-rose-500/30 transition-colors">
                <Users className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">User Management</h2>
                <p className="text-gray-400 text-sm">Manage user accounts</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total users: {userCount ?? '...'}</span>
              {pendingCount !== null && pendingCount > 0 && (
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs">
                  {pendingCount} pending
                </span>
              )}
            </div>
          </Link>

          <Link
            href="/admin/google-sso"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-purple-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Settings className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Google SSO</h2>
                <p className="text-gray-400 text-sm">Configure Google login</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Set up OAuth credentials</p>
          </Link>

          <Link
            href="/admin/github"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-gray-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-gray-600/30 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                <Github className="w-6 h-6 text-gray-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">GitHub Backup</h2>
                <p className="text-gray-400 text-sm">Backup source code to GitHub</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Configure credentials &amp; trigger backups</p>
          </Link>

          <Link
            href="/admin/redis"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-red-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                <Database className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Redis Cache</h2>
                <p className="text-gray-400 text-sm">Configure caching</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Improve performance with Redis caching</p>
          </Link>

          <Link
            href="/admin/email"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                <Mail className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Mail Server</h2>
                <p className="text-gray-400 text-sm">SMTP configuration</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Configure SMTP for email verification &amp; invitations</p>
          </Link>

          <Link
            href="/admin/gemini"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-amber-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                <Key className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">API Config</h2>
                <p className="text-gray-400 text-sm">AI provider settings</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Configure AI provider, API keys &amp; image models</p>
          </Link>

          <Link
            href="/admin/movie-styles"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-orange-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                <Film className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Movie Styles</h2>
                <p className="text-gray-400 text-sm">Style references</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Manage style images, prompts &amp; reference mode</p>
          </Link>

          <Link
            href="/admin/images"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-cyan-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                <ImageIcon className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Image Library</h2>
                <p className="text-gray-400 text-sm">Dropdown thumbnails</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Export &amp; import selection dropdown images</p>
          </Link>

          <Link
            href="/admin/reports"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-emerald-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Usage Reports</h2>
                <p className="text-gray-400 text-sm">Analytics &amp; costs</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Track activity, API usage &amp; cost estimates</p>
          </Link>

          <Link
            href="/admin/logo"
            className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6 hover:border-pink-500/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-pink-500/20 flex items-center justify-center group-hover:bg-pink-500/30 transition-colors">
                <Smartphone className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Logo &amp; PWA</h2>
                <p className="text-gray-400 text-sm">App branding</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Upload logo, generate icons &amp; splash screens</p>
          </Link>

          <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Your Role</h2>
                <p className="text-gray-400 text-sm">Administrator</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Logged in as {session.user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

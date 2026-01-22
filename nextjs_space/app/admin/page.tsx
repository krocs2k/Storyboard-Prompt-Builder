'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Users, Settings, Shield } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Administration</h1>
              <p className="text-gray-400">Manage users and system settings</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to App
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link
            href="/admin/users"
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-rose-500/50 transition-all group"
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
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-purple-500/50 transition-all group"
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

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
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

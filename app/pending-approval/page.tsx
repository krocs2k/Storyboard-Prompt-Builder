'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Clock, LogOut, Mail, RefreshCw, Film } from 'lucide-react';

export default function PendingApprovalPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  // If user becomes active or is already active, redirect to home
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isActive) {
      router.replace('/');
    }
  }, [status, session, router]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      // Force session update to check latest status
      await update();
      // Small delay to show checking state
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center  p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
          <p className="text-gray-400">Your account is awaiting administrator review</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl p-8">
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/50 rounded-lg">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-300 font-medium mb-1">Approval Required</p>
                <p className="text-gray-400 text-sm">
                  Your account has been created successfully, but requires administrator approval before you can access the application.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-gray-300 text-sm mb-6">
            <div className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-white font-medium">1</span>
              </div>
              <p>Your registration request has been received</p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center">
                <span className="text-white font-medium">2</span>
              </div>
              <p>Awaiting administrator review and approval</p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-lg opacity-50">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-white font-medium">3</span>
              </div>
              <p>Full access to all features once approved</p>
            </div>
          </div>

          {session?.user?.email && (
            <div className="mb-6 p-3 bg-gray-900/50 rounded-lg text-center">
              <p className="text-gray-500 text-xs mb-1">Signed in as</p>
              <p className="text-white font-medium">{session.user.email}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking Status...' : 'Check Approval Status'}
            </button>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          <p className="mt-6 text-center text-gray-500 text-sm">
            Need help? Contact your administrator for assistance.
          </p>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
            <Film className="w-4 h-4" />
            <span>Storyshot Creator</span>
          </div>
        </div>
      </div>
    </div>
  );
}

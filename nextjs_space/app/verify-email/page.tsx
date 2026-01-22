'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';

function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isActive, setIsActive] = useState(false);
  
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message);
          setIsActive(data.isActive);
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to verify email');
        }
      } catch {
        setStatus('error');
        setMessage('An unexpected error occurred');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700/50 mb-4">
                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Verifying Email</h2>
              <p className="text-gray-400">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Email Verified!</h2>
              <p className="text-gray-400 mb-6">{message}</p>
              {isActive ? (
                <Link
                  href="/login"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-rose-500 to-purple-600 text-white font-semibold rounded-lg hover:from-rose-600 hover:to-purple-700 transition-all"
                >
                  Go to Login
                </Link>
              ) : (
                <div className="p-4 bg-amber-500/10 border border-amber-500/50 rounded-lg">
                  <Mail className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-amber-400 text-sm">
                    An administrator will review your account. You&apos;ll receive an email once approved.
                  </p>
                </div>
              )}
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Verification Failed</h2>
              <p className="text-gray-400 mb-6">{message}</p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 bg-gradient-to-r from-rose-500 to-purple-600 text-white font-semibold rounded-lg hover:from-rose-600 hover:to-purple-700 transition-all"
              >
                Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MobileLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) router.replace('/mobile/home');
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) { setError('Enter a valid email address'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Incorrect email or password');
      } else {
        router.replace('/mobile/home');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-teal-600 px-6 pt-16 pb-10 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-teal-600 font-heading font-bold text-2xl">PS</span>
        </div>
        <h1 className="text-white font-heading font-bold text-2xl">PrimeServe</h1>
        <p className="text-teal-100 text-sm mt-1">Housekeeping Supplies & Services</p>
      </div>

      {/* Card */}
      <div className="flex-1 px-5 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="font-heading font-bold text-xl text-slate-900 mb-1">Sign in</h2>
          <p className="text-slate-500 text-sm mb-6">Use the credentials set up by your admin</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg p-1"
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-700 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold rounded-xl text-base transition-colors mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div className="mt-6 bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-slate-500 text-sm">Don&apos;t have credentials?</p>
            <p className="text-slate-500 text-sm">Contact your PrimeServe admin</p>
          </div>
        </div>
      </div>

      <p className="text-center text-slate-400 text-xs py-6">PrimeServe Facility Solutions · v1.0</p>
    </div>
  );
}

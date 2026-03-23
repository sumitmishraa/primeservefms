/**
 * Login page — /login
 *
 * Two tabs on the same page:
 *   [Email Login]  → email + password → Firebase signInWithEmailAndPassword
 *   [Phone Login]  → +91 phone → OTP → Firebase signInWithPhoneNumber
 *
 * After success → redirect to role dashboard (or ?redirect= if present).
 *
 * Uses useAuth hook for all Firebase + API operations.
 * The auth layout (layout.tsx) provides the split-screen wrapper and
 * the hidden #recaptcha-container required for phone auth.
 */

'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { OTPInput } from '@/components/auth/OTPInput';
import type { ConfirmationResult } from 'firebase/auth';

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------

const inputCls =
  'w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ' +
  'text-slate-900 placeholder:text-slate-400 text-sm transition-colors bg-white';

// ---------------------------------------------------------------------------
// Inner page (uses useSearchParams — wrapped in Suspense below)
// ---------------------------------------------------------------------------

function LoginContent() {
  const searchParams = useSearchParams();
  const { loginWithEmail, loginWithPhone, verifyPhoneOTP, redirectAfterLogin } = useAuth();

  type Tab = 'email' | 'phone';
  type PhoneStep = 'input' | 'otp';

  const [activeTab, setActiveTab] = useState<Tab>('email');
  const [isLoading, setIsLoading] = useState(false);

  // ── Email tab state ───────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── Phone tab state ───────────────────────────────────────────────────────
  const [phone, setPhone] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('input');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otpError, setOtpError] = useState(false);
  const [resetOtp, setResetOtp] = useState(false);

  const redirectTo = searchParams.get('redirect');

  // ── Email login ───────────────────────────────────────────────────────────

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsLoading(true);
    try {
      const user = await loginWithEmail(email.trim(), password);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`);
      redirectAfterLogin(user, redirectTo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Phone: send OTP ───────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error('Enter a valid 10-digit phone number.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginWithPhone(digits);
      setConfirmationResult(result);
      setPhoneStep('otp');
      startResendTimer();
      toast.success('OTP sent!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Phone: verify OTP ─────────────────────────────────────────────────────

  const handleVerifyOTP = async (otp: string) => {
    if (!confirmationResult) return;

    setIsLoading(true);
    setOtpError(false);
    try {
      const user = await verifyPhoneOTP(confirmationResult, otp);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`);
      redirectAfterLogin(user, redirectTo);
    } catch (err) {
      setOtpError(true);
      setResetOtp(true);
      setTimeout(() => { setResetOtp(false); setOtpError(false); }, 500);
      toast.error(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend OTP timer ──────────────────────────────────────────────────────

  const startResendTimer = () => {
    setSecondsLeft(30);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      const digits = phone.replace(/\D/g, '');
      const result = await loginWithPhone(digits);
      setConfirmationResult(result);
      startResendTimer();
      setResetOtp(true);
      setTimeout(() => setResetOtp(false), 100);
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Tab switch: reset phone state ─────────────────────────────────────────

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'phone') {
      setPhoneStep('input');
      setConfirmationResult(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">Welcome Back</h1>
        <p className="text-sm text-slate-500 mt-1">Login to your PrimeServe account</p>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-lg bg-slate-100 p-1">
        {(['email', 'phone'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => switchTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-150 ${
              activeTab === tab
                ? 'bg-white text-teal-700 shadow-sm font-semibold border-b-2 border-teal-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'email' ? '✉️  Email Login' : '📱  Phone Login'}
          </button>
        ))}
      </div>

      {/* ── EMAIL TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'email' && (
        <form onSubmit={handleEmailLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                autoComplete="email"
                placeholder="your@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => toast('Password reset coming soon', { icon: '🔒' })}
                className="text-xs text-teal-600 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging in…
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
      )}

      {/* ── PHONE TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'phone' && (
        <div className="space-y-4">
          {/* Phone input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Phone Number
            </label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 h-12 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 shrink-0">
                🇮🇳 +91
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter 10-digit number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  if (phoneStep === 'otp') {
                    setPhoneStep('input');
                    setConfirmationResult(null);
                  }
                }}
                disabled={phoneStep === 'otp'}
                className="flex-1 h-12 px-4 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 placeholder:text-slate-400 text-sm disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>

          {/* Send OTP button */}
          {phoneStep === 'input' && (
            <button
              type="button"
              onClick={handleSendOTP}
              disabled={isLoading || phone.length !== 10}
              className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending OTP…
                </>
              ) : (
                'Send OTP'
              )}
            </button>
          )}

          {/* OTP verification step */}
          {phoneStep === 'otp' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-3">
                  Enter the 6-digit code sent to{' '}
                  <span className="font-semibold text-slate-900">+91 {phone}</span>
                </p>
                <OTPInput
                  onComplete={handleVerifyOTP}
                  isLoading={isLoading}
                  isError={otpError}
                  reset={resetOtp}
                />
              </div>

              {/* Verify button (also acts as manual submit) */}
              <button
                type="button"
                disabled={isLoading}
                className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Verify & Login'
                )}
              </button>

              {/* Resend */}
              <div className="text-center">
                {secondsLeft > 0 ? (
                  <p className="text-xs text-slate-400">
                    Resend OTP in{' '}
                    <span className="font-mono font-semibold text-slate-600">
                      00:{String(secondsLeft).padStart(2, '0')}
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    className="text-xs text-teal-600 hover:underline disabled:opacity-50 font-medium"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-slate-400">or</span>
        </div>
      </div>

      {/* Register link */}
      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-teal-600 hover:underline font-semibold">
          Register here
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps inner content in Suspense for useSearchParams
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-teal-600 animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

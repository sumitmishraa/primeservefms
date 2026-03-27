/**
 * Login page — /login
 *
 * Two sign-in options via tabs:
 *   1. "Sign in with OTP"           — Phone number → Firebase SMS → 6-digit OTP
 *   2. "Sign in with Email & Password" — Email + bcrypt password check
 *
 * Phone OTP flow:
 *   1. User enters 10-digit phone number
 *   2. sendPhoneOTP() → Firebase invisible reCAPTCHA → SMS sent
 *   3. OTP input appears; user enters 6-digit code
 *   4. confirmation.confirm(otp) → Firebase UserCredential → ID token
 *   5. POST /api/auth/verify { idToken } → session cookie
 *   6. Redirect to role dashboard
 *
 * Email+Password flow:
 *   1. User enters email + password
 *   2. POST /api/auth/login → bcrypt compare → session cookie
 *   3. Redirect to role dashboard
 */

'use client';

import { useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, Phone, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { OTPInput } from '@/components/auth/OTPInput';
import { sendPhoneOTP, clearRecaptchaVerifier } from '@/lib/firebase/config';
import type { ConfirmationResult } from 'firebase/auth';

const inputCls =
  'w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ' +
  'text-slate-900 placeholder:text-slate-400 text-sm transition-colors bg-white';

// ---------------------------------------------------------------------------
// Tab 1 — Sign in with OTP
// ---------------------------------------------------------------------------

type PhoneStage = 'input' | 'sending' | 'otp' | 'verifying';

function PhoneOTPTab({ redirectTo }: { redirectTo: string | null }) {
  const { loginWithPhone, redirectAfterLogin } = useAuth();

  const [phone, setPhone]               = useState('');
  const [stage, setStage]               = useState<PhoneStage>('input');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [otpError, setOtpError]         = useState(false);
  const [otpResetKey, setOtpResetKey]   = useState(0);
  const [resendTimer, setResendTimer]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  const handleSend = useCallback(async () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error('Enter a valid 10-digit mobile number.');
      return;
    }
    setStage('sending');
    try {
      const result = await sendPhoneOTP('+91' + phone, 'login-otp-btn');
      setConfirmation(result);
      setStage('otp');
      startTimer();
      toast.success('OTP sent to +91 ' + phone);
    } catch (err) {
      setStage('input');
      clearRecaptchaVerifier();
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('invalid-phone-number')) toast.error('Invalid phone number. Please check and try again.');
      else if (msg.includes('too-many-requests')) toast.error('Too many attempts. Please wait a few minutes.');
      else toast.error('Could not send OTP. Please try again.');
    }
  }, [phone, startTimer]);

  const handleVerify = useCallback(async (otp: string) => {
    if (!confirmation) return;
    setStage('verifying');
    setOtpError(false);
    try {
      const credential = await confirmation.confirm(otp);
      const idToken    = await credential.user.getIdToken();
      const user       = await loginWithPhone(idToken);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`);
      redirectAfterLogin(user, redirectTo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('No account found')) {
        toast.error('No account found with this number. Please register first.');
        setStage('input');
      } else {
        setOtpError(true);
        setOtpResetKey((k) => k + 1);
        setStage('otp');
        toast.error('Incorrect OTP. Please try again.');
      }
    }
  }, [confirmation, loginWithPhone, redirectAfterLogin, redirectTo]);

  const handleResend = useCallback(() => {
    if (resendTimer > 0) return;
    clearRecaptchaVerifier();
    setConfirmation(null);
    setOtpError(false);
    setOtpResetKey((k) => k + 1);
    setStage('input');
    setTimeout(() => handleSend(), 100);
  }, [resendTimer, handleSend]);

  return (
    <div className="space-y-4">

      {/* Phone input */}
      {(stage === 'input' || stage === 'sending') && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mobile Number
            </label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 h-12 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 shrink-0 select-none">
                +91
              </div>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={phone}
                  disabled={stage === 'sending'}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-50"
                  autoFocus
                />
              </div>
            </div>
          </div>

          <button
            id="login-otp-btn"
            type="button"
            onClick={handleSend}
            disabled={stage === 'sending' || phone.length !== 10}
            className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {stage === 'sending'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP…</>
              : 'Send OTP'}
          </button>
        </>
      )}

      {/* OTP entry */}
      {(stage === 'otp' || stage === 'verifying') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setStage('input'); clearRecaptchaVerifier(); setConfirmation(null); }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p className="text-sm text-slate-600">
              OTP sent to{' '}
              <span className="font-semibold text-slate-800">+91 {phone}</span>
            </p>
          </div>

          <OTPInput
            onComplete={handleVerify}
            error={otpError}
            isLoading={stage === 'verifying'}
            resetKey={otpResetKey}
          />

          {stage === 'verifying' && (
            <p className="text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> Verifying…
            </p>
          )}

          <p className="text-center text-xs">
            {resendTimer > 0 ? (
              <span className="text-slate-400">Resend OTP in {resendTimer}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-teal-600 hover:underline"
              >
                Resend OTP
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Sign in with Email & Password
// ---------------------------------------------------------------------------

function EmailPasswordTab({ redirectTo }: { redirectTo: string | null }) {
  const { login, redirectAfterLogin } = useAuth();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsLoading(true);
    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`);
      redirectAfterLogin(user, redirectTo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Email Address
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
            autoFocus
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
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={`${inputCls} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !email || !password}
        className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
      >
        {isLoading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging in…</>
          : 'Login'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inner page (uses useSearchParams — must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get('redirect');
  const [tab, setTab] = useState<'otp' | 'email'>('otp');

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">Welcome Back</h1>
        <p className="text-sm text-slate-500 mt-1">Login to your PrimeServe account</p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50 gap-1">
        <button
          type="button"
          onClick={() => setTab('otp')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
            tab === 'otp'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Sign in with OTP
        </button>
        <button
          type="button"
          onClick={() => setTab('email')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
            tab === 'email'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Email &amp; Password
        </button>
      </div>

      {/* Tab content */}
      {tab === 'otp'
        ? <PhoneOTPTab redirectTo={redirectTo} />
        : <EmailPasswordTab redirectTo={redirectTo} />
      }

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
// Page export
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

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { FormEvent, InputHTMLAttributes } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import {
  LoadingScreen,
  MobilePage,
  StatusSpacer,
  mobileIcons,
} from '@/components/mobile/PrimeserveMobile';
import { PrimeServeLogo } from '@/components/brand';
import { sendPhoneOTP, clearRecaptchaVerifier } from '@/lib/firebase/config';

type Mode = 'login' | 'register';
type AuthMethod = 'otp' | 'password';

function MobileLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/mobile/home';

  const [mode, setMode] = useState<Mode>('login');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('otp');

  // Shared fields
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);

  // Email + password fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) router.replace(redirect);
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [redirect, router]);

  function resetOtp() {
    setOtpSent(false);
    setOtp('');
    setConfirmation(null);
    clearRecaptchaVerifier();
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    resetOtp();
    setError('');
  }

  function switchMethod(method: AuthMethod) {
    setAuthMethod(method);
    resetOtp();
    setError('');
  }

  async function sendOTP() {
    setError('');
    if (mode === 'register' && fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (mode === 'register' && !terms) {
      setError('Accept the Terms and Privacy Policy to continue.');
      return;
    }
    setLoading(true);
    try {
      const result = await sendPhoneOTP(`+91${phone}`, 'send-otp-btn');
      setConfirmation(result);
      setOtpSent(true);
    } catch (err) {
      clearRecaptchaVerifier();
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/billing-not-enabled' || code === 'auth/operation-not-allowed') {
        setError('Phone OTP is not yet active. Please use Email & Password to sign in.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please check and try again.');
      } else if (code === 'auth/captcha-check-failed') {
        setError('Security check failed. Please refresh and try again.');
      } else if (code === 'auth/quota-exceeded') {
        setError('SMS limit reached for today. Please try Email & Password instead.');
      } else {
        setError('Could not send OTP. Please use Email & Password to sign in.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyOTP(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!confirmation) return;
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const credential = await confirmation.confirm(otp);
      const idToken = await credential.user.getIdToken();
      const body =
        mode === 'register'
          ? {
              idToken,
              mode: 'register',
              full_name: fullName.trim(),
              company_name: companyName.trim() || undefined,
            }
          : { idToken };
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Verification failed. Try again.');
      } else {
        router.replace(redirect);
      }
    } catch {
      setError('Incorrect OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function submitEmailPassword(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (mode === 'register') {
      if (fullName.trim().length < 2) { setError('Enter your full name.'); return; }
      if (!email.trim().includes('@')) { setError('Enter a valid email address.'); return; }
      if (!/^\d{10}$/.test(phone)) { setError('Enter a valid 10-digit mobile number.'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      if (!terms) { setError('Accept the Terms and Privacy Policy to continue.'); return; }

      setLoading(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            company_name: companyName.trim() || undefined,
            email: email.trim().toLowerCase(),
            phone: `+91${phone}`,
            password,
            terms_accepted: true,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error ?? 'Registration failed.');
        } else {
          router.replace(redirect);
        }
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes('@')) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Incorrect email or password.');
      } else {
        router.replace(redirect);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <LoadingScreen label="Checking session" />;

  return (
    <MobilePage withBottomPadding={false} className="min-h-dvh bg-[#0B1220]">
      <div className="min-h-dvh bg-[radial-gradient(110%_70%_at_90%_0%,rgba(20,184,166,0.22)_0%,rgba(11,18,32,0)_60%),linear-gradient(180deg,#0B1220_0%,#0F1A2E_45%,#F8FAFC_45%,#F8FAFC_100%)]">
        <StatusSpacer />
        <div className="px-6 pb-8 pt-7 text-white">
          <Link href="/mobile/home" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300">
            <mobileIcons.ArrowRight className="h-4 w-4 rotate-180" />
            Home
          </Link>
          <div className="mt-7">
            <PrimeServeLogo size="lg" tone="light" priority />
            <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-slate-300">
              Sign in or create your B2B buyer account to access credits, orders, and account details.
            </p>
          </div>
        </div>

        <div className="px-5 pb-8">
          <div className="ps-slide-up rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_22px_54px_-36px_rgba(15,23,42,0.45)]">
            {/* Sign In / Sign Up tab */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`ps-press h-11 rounded-xl text-sm font-extrabold ${mode === m ? 'bg-white text-[#0D9488] shadow-sm' : 'text-slate-500'}`}
                >
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* OTP / Email segmented control */}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMethod('otp')}
                className={`ps-press h-10 rounded-xl text-xs font-extrabold ${authMethod === 'otp' ? 'bg-white text-[#0D9488] shadow-sm' : 'text-slate-500'}`}
              >
                Phone OTP
              </button>
              <button
                type="button"
                onClick={() => switchMethod('password')}
                className={`ps-press relative h-10 rounded-xl text-xs font-extrabold ${authMethod === 'password' ? 'bg-white text-[#0D9488] shadow-sm' : 'text-slate-500'}`}
              >
                Email & Password
                <span className="absolute -right-1 -top-1 rounded-full bg-[#14B8A6] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white">
                  Works now
                </span>
              </button>
            </div>

            <div className="mt-5">
              <h2 className="font-heading text-2xl font-extrabold text-slate-900">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {mode === 'login'
                  ? authMethod === 'otp'
                    ? 'Verify your phone number to continue.'
                    : 'Continue to your PrimeServe workspace.'
                  : authMethod === 'otp'
                    ? 'Verify your phone to set up your account.'
                    : 'Set up your buyer login in a minute.'}
              </p>
            </div>

            {authMethod === 'otp' ? (
              <div className="mt-5 space-y-4">
                {mode === 'register' && (
                  <>
                    <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="Your full name" autoComplete="name" />
                    <Field label="Company Name" value={companyName} onChange={setCompanyName} placeholder="Business or company" autoComplete="organization" />
                  </>
                )}

                <Field
                  label="Mobile Number"
                  value={phone}
                  onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  prefix="+91"
                  autoComplete="tel"
                  disabled={otpSent}
                />

                {mode === 'register' && !otpSent && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#0D9488]"
                    />
                    <span className="text-xs font-semibold leading-5 text-slate-500">
                      I agree to the Terms and Privacy Policy for PrimeServe buyer accounts.
                    </span>
                  </label>
                )}

                {!otpSent ? (
                  <>
                    {error && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                        {error}
                      </div>
                    )}
                    <button
                      id="send-otp-btn"
                      type="button"
                      disabled={loading}
                      onClick={sendOTP}
                      className="ps-press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#14B8A6] font-heading text-base font-extrabold text-white disabled:opacity-60"
                    >
                      {loading ? 'Sending OTP...' : 'Send OTP'}
                      <mobileIcons.ArrowRight className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <form onSubmit={verifyOTP} className="space-y-4">
                    <div>
                      <Field
                        label="Enter OTP"
                        value={otp}
                        onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                      <button
                        type="button"
                        onClick={() => { resetOtp(); setError(''); }}
                        className="mt-2 text-xs font-bold text-[#0D9488]"
                      >
                        Change number
                      </button>
                    </div>
                    {error && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={loading}
                      className="ps-press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#14B8A6] font-heading text-base font-extrabold text-white disabled:opacity-60"
                    >
                      {loading ? 'Verifying...' : 'Verify & Continue'}
                      <mobileIcons.ArrowRight className="h-5 w-5" />
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={submitEmailPassword} className="mt-5 space-y-4">
                {mode === 'register' && (
                  <>
                    <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="Your full name" autoComplete="name" />
                    <Field label="Company Name" value={companyName} onChange={setCompanyName} placeholder="Business or company" autoComplete="organization" />
                    <Field
                      label="Mobile Number"
                      value={phone}
                      onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      prefix="+91"
                      autoComplete="tel"
                    />
                  </>
                )}

                <Field label="Email Address" value={email} onChange={setEmail} placeholder="you@company.com" type="email" autoComplete="email" />
                <Field
                  label={mode === 'login' ? 'Password' : 'Create Password'}
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 6 characters"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />

                {mode === 'register' && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#0D9488]"
                    />
                    <span className="text-xs font-semibold leading-5 text-slate-500">
                      I agree to the Terms and Privacy Policy for PrimeServe buyer accounts.
                    </span>
                  </label>
                )}

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="ps-press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#14B8A6] py-3.5 font-heading text-base font-extrabold text-white disabled:opacity-60"
                >
                  {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                  <mobileIcons.ArrowRight className="h-5 w-5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </MobilePage>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  prefix,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  prefix?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-slate-700">{label}</span>
      <div className={`mt-2 flex h-12 items-center rounded-2xl border bg-slate-50 px-3 focus-within:border-[#14B8A6] ${disabled ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
        {prefix && <span className="mr-2 shrink-0 text-sm font-extrabold text-slate-500">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>
    </label>
  );
}

export default function MobileLoginPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <MobileLoginContent />
    </Suspense>
  );
}

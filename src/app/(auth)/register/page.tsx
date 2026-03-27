/**
 * Register page — /register
 *
 * Single unified form. Fields:
 *   1. Full Name (required)
 *   2. Company Name (optional)
 *   3. Email (optional — no OTP verification needed)
 *   4. Phone (required — OTP verified via Firebase)
 *   5. Create Password (required)
 *   6. Newsletter opt-in checkbox
 *   7. Terms & Conditions checkbox (required)
 *
 * Submit flow:
 *   • Phone must be verified via OTP before the button is enabled
 *   • POST /api/auth/verify { idToken, mode:"register", full_name, email, company_name, password }
 *   • Server hashes the password and creates the user in Supabase
 *   • Session cookie is set → redirect to /buyer/marketplace
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, User, Briefcase, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { PhoneVerification } from '@/components/auth/PhoneVerification';
import { PasswordStrengthBar } from '@/components/auth/PasswordStrengthBar';
import type { UserProfile } from '@/types';

// ─── Shared input style ────────────────────────────────────────────────────────

const inputCls =
  'w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ' +
  'text-slate-900 placeholder:text-slate-400 text-sm transition-colors bg-white';

const inputErrCls = 'border-rose-400 focus:ring-rose-400 focus:border-rose-400';

// ─── Password validation ────────────────────────────────────────────────────────

function validatePassword(pw: string): string | null {
  if (pw.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

// ─── Page component ────────────────────────────────────────────────────────────

/**
 * Registration page with a single unified form.
 * Phone is OTP-verified via Firebase before account creation.
 * Email and password are stored in Supabase (no Firebase email auth).
 */
export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setLoading } = useAuthStore();

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [fullName, setFullName]         = useState('');
  const [companyName, setCompanyName]   = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirmPw, setShowConfirmPw]     = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [termsAccepted, setTermsAccepted]     = useState(false);

  // ── Phone OTP state ──────────────────────────────────────────────────────────
  /** Firebase ID token set by PhoneVerification once OTP is confirmed */
  const [phoneIdToken, setPhoneIdToken] = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});

  // ── Phone verified callback ───────────────────────────────────────────────────
  const handlePhoneVerified = useCallback((_phoneE164: string, idToken: string) => {
    setPhoneIdToken(idToken);
  }, []);

  // ── Form readiness ────────────────────────────────────────────────────────────
  const isFormReady =
    fullName.trim().length >= 2 &&
    phoneIdToken !== null &&
    validatePassword(password) === null &&
    password === confirmPassword &&
    termsAccepted;

  // ── Validation ────────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!phoneIdToken) {
      errors.phone = 'Please verify your phone number with OTP.';
    }
    const pwErr = validatePassword(password);
    if (pwErr) errors.password = pwErr;
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!termsAccepted) {
      errors.terms = 'You must accept the Terms & Conditions to register.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !phoneIdToken) return;

    setIsSubmitting(true);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken:      phoneIdToken,
          mode:         'register',
          full_name:    fullName.trim(),
          email:        email.trim() || undefined,
          company_name: companyName.trim() || undefined,
          password,
        }),
      });

      const json = (await res.json()) as { user?: UserProfile; error?: string };

      if (res.status === 409) {
        throw new Error(json.error ?? 'Account already exists.');
      }
      if (!res.ok || !json.user) {
        throw new Error(json.error ?? 'Registration failed. Please try again.');
      }

      setUser(json.user);
      toast.success(`Welcome to PrimeServe, ${json.user.full_name.split(' ')[0]}!`);
      router.push('/buyer/marketplace');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">Create Your Account</h1>
        <p className="text-sm text-slate-500 mt-1">
          Join businesses already saving on procurement
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* ── Full Name ──────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: '' }));
              }}
              className={`${inputCls} ${fieldErrors.fullName ? inputErrCls : ''}`}
            />
          </div>
          {fieldErrors.fullName && (
            <p className="mt-1 text-xs text-rose-500">{fieldErrors.fullName}</p>
          )}
        </div>

        {/* ── Company Name ───────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Company Name
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              autoComplete="organization"
              placeholder="Your company or business name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* ── Email ─────────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email Address
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              autoComplete="email"
              placeholder="your@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
              }}
              className={`${inputCls} ${fieldErrors.email ? inputErrCls : ''}`}
            />
          </div>
          {fieldErrors.email ? (
            <p className="mt-1 text-xs text-rose-500">{fieldErrors.email}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              Order confirmations &amp; invoices will be sent here
            </p>
          )}
        </div>

        {/* ── Phone + OTP ────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Mobile Number <span className="text-rose-500">*</span>
          </label>
          <PhoneVerification
            onVerified={handlePhoneVerified}
            disabled={isSubmitting}
          />
          {fieldErrors.phone && (
            <p className="mt-1.5 text-xs text-rose-500">{fieldErrors.phone}</p>
          )}
          {!phoneIdToken && !fieldErrors.phone && (
            <p className="mt-1.5 text-xs text-slate-400">
              A one-time password will be sent to your mobile to verify your number
            </p>
          )}
        </div>

        {/* ── Password ──────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Create Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
              }}
              className={`${inputCls} pr-10 ${fieldErrors.password ? inputErrCls : ''}`}
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
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-rose-500">{fieldErrors.password}</p>
          )}
          <PasswordStrengthBar password={password} />
        </div>

        {/* ── Confirm Password ───────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Confirm Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showConfirmPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
              }}
              className={`${inputCls} pr-10 ${
                fieldErrors.confirmPassword
                  ? inputErrCls
                  : confirmPassword && password === confirmPassword
                  ? 'border-emerald-400 focus:ring-emerald-400 focus:border-emerald-400'
                  : ''
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
            >
              {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-rose-500">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {/* ── Checkboxes ────────────────────────────────────────────────────── */}
        <div className="space-y-3 pt-1">

          {/* Newsletter */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={newsletterOptIn}
                onChange={(e) => setNewsletterOptIn(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                newsletterOptIn ? 'bg-teal-600 border-teal-600' : 'border-slate-300 group-hover:border-teal-400'
              }`}>
                {newsletterOptIn && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-slate-600 leading-snug">
              Subscribe to newsletter and product updates
            </span>
          </label>

          {/* Terms */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (fieldErrors.terms) setFieldErrors((p) => ({ ...p, terms: '' }));
                  }}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  termsAccepted
                    ? 'bg-teal-600 border-teal-600'
                    : fieldErrors.terms
                    ? 'border-rose-400'
                    : 'border-slate-300 group-hover:border-teal-400'
                }`}>
                  {termsAccepted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-slate-600 leading-snug">
                I agree to the{' '}
                <Link href="/terms" className="text-teal-600 hover:underline font-medium">
                  Terms &amp; Conditions
                </Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-teal-600 hover:underline font-medium">
                  Privacy Policy
                </Link>
                {' '}<span className="text-rose-500">*</span>
              </span>
            </label>
            {fieldErrors.terms && (
              <p className="mt-1 ml-8 text-xs text-rose-500">{fieldErrors.terms}</p>
            )}
          </div>
        </div>

        {/* ── Submit ────────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={!isFormReady || isSubmitting}
          className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creating your account…</>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="text-teal-600 hover:underline font-semibold">
          Login here
        </Link>
      </p>
    </div>
  );
}

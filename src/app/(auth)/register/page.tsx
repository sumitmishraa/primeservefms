/**
 * Register page — /register
 *
 * Two registration modes via tabs:
 *
 * Tab 1 — Phone OTP (recommended):
 *   1. User fills: name, phone, optional email/company
 *   2. PhoneVerification widget sends OTP → user confirms it
 *   3. On verify: POST /api/auth/verify { idToken, mode:"register", ...fields }
 *   4. Account created → session cookie → redirect /buyer/marketplace
 *
 * Tab 2 — Email + Password:
 *   1. User fills full form (name, email, phone, password, confirm password)
 *   2. POST /api/auth/register → account created → session cookie → redirect
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Mail, Lock, Eye, EyeOff, User, Briefcase, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { PhoneVerification } from '@/components/auth/PhoneVerification';
import { PasswordStrengthBar } from '@/components/auth/PasswordStrengthBar';

const inputCls =
  'w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ' +
  'text-slate-900 placeholder:text-slate-400 text-sm transition-colors bg-white';

function validatePassword(pw: string): string | null {
  if (pw.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

// ---------------------------------------------------------------------------
// Phone OTP Registration tab
// ---------------------------------------------------------------------------

function PhoneRegisterTab() {
  const { registerWithPhone } = useAuth();

  const [fullName, setFullName]         = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail]               = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);

  // Called by PhoneVerification when OTP is confirmed
  const handlePhoneVerified = (_phoneE164: string, idToken: string) => {
    setVerifiedToken(idToken);
  };

  const isReady =
    fullName.trim().length >= 2 &&
    verifiedToken !== null &&
    termsAccepted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady || !verifiedToken) return;

    const errors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!termsAccepted) {
      errors.terms = 'You must accept the Terms & Conditions to register.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await registerWithPhone(
        {
          full_name:    fullName.trim(),
          email:        email.trim() || undefined,
          company_name: businessName.trim() || undefined,
        },
        verifiedToken
      );
      // registerWithPhone handles toast + redirect
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Full Name */}
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
            onChange={(e) => { setFullName(e.target.value); if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: '' })); }}
            className={`${inputCls} ${fieldErrors.fullName ? 'border-rose-400' : ''}`}
          />
        </div>
        {fieldErrors.fullName && <p className="mt-1 text-xs text-rose-500">{fieldErrors.fullName}</p>}
      </div>

      {/* Business Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Business Name
          <span className="ml-1 text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            autoComplete="organization"
            placeholder="Your company name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Email (optional for phone OTP flow) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Email
          <span className="ml-1 text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="email"
            autoComplete="email"
            placeholder="your@company.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' })); }}
            className={`${inputCls} ${fieldErrors.email ? 'border-rose-400' : ''}`}
          />
        </div>
        {fieldErrors.email
          ? <p className="mt-1 text-xs text-rose-500">{fieldErrors.email}</p>
          : <p className="mt-1 text-xs text-slate-400">Order confirmations will be sent here</p>
        }
      </div>

      {/* Phone OTP widget */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Mobile Number <span className="text-rose-500">*</span>
        </label>
        <PhoneVerification
          onVerified={handlePhoneVerified}
          disabled={isSubmitting}
        />
        {!verifiedToken && (
          <p className="mt-1 text-xs text-slate-400">
            We&apos;ll verify your phone with a one-time password
          </p>
        )}
      </div>

      {/* Terms */}
      <div>
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => { setTermsAccepted(e.target.checked); if (fieldErrors.terms) setFieldErrors((p) => ({ ...p, terms: '' })); }}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              termsAccepted ? 'bg-teal-600 border-teal-600' : fieldErrors.terms ? 'border-rose-400' : 'border-slate-300 group-hover:border-teal-400'
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
            <Link href="/terms" className="text-teal-600 hover:underline font-medium">Terms &amp; Conditions</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-teal-600 hover:underline font-medium">Privacy Policy</Link>
            {' '}<span className="text-rose-500">*</span>
          </span>
        </label>
        {fieldErrors.terms && <p className="mt-1 ml-8 text-xs text-rose-500">{fieldErrors.terms}</p>}
      </div>

      <button
        type="submit"
        disabled={!isReady || isSubmitting}
        className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
      >
        {isSubmitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating your account…</>
          : 'Create Account'
        }
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Email + Password Registration tab
// ---------------------------------------------------------------------------

function EmailRegisterTab() {
  const { register } = useAuth();

  const [fullName, setFullName]             = useState('');
  const [businessName, setBusinessName]     = useState('');
  const [email, setEmail]                   = useState('');
  const [phone, setPhone]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [termsAccepted, setTermsAccepted]   = useState(false);
  const [showPw, setShowPw]                 = useState(false);
  const [showConfirmPw, setShowConfirmPw]   = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [fieldErrors, setFieldErrors]       = useState<Record<string, string>>({});

  const isFormReady =
    fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    /^\d{10}$/.test(phone) &&
    validatePassword(password) === null &&
    password === confirmPassword &&
    termsAccepted;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) errors.fullName = 'Full name must be at least 2 characters.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    if (!/^\d{10}$/.test(phone)) errors.phone = 'Enter a valid 10-digit phone number.';
    const pwError = validatePassword(password);
    if (pwError) errors.password = pwError;
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (!termsAccepted) errors.terms = 'You must accept the Terms & Conditions to register.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await register({
        full_name:         fullName.trim(),
        email:             email.trim(),
        password,
        phone,
        company_name:      businessName.trim() || undefined,
        newsletter_opt_in: newsletterOptIn,
        terms_accepted:    termsAccepted,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Full Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Full Name <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" autoComplete="name" placeholder="Enter your full name" value={fullName}
            onChange={(e) => { setFullName(e.target.value); if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: '' })); }}
            className={`${inputCls} ${fieldErrors.fullName ? 'border-rose-400' : ''}`} />
        </div>
        {fieldErrors.fullName && <p className="mt-1 text-xs text-rose-500">{fieldErrors.fullName}</p>}
      </div>

      {/* Business Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Business Name <span className="ml-1 text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" autoComplete="organization" placeholder="Your company name" value={businessName}
            onChange={(e) => setBusinessName(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Email <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="email" autoComplete="email" placeholder="your@company.com" value={email}
            onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' })); }}
            className={`${inputCls} ${fieldErrors.email ? 'border-rose-400' : ''}`} />
        </div>
        {fieldErrors.email
          ? <p className="mt-1 text-xs text-rose-500">{fieldErrors.email}</p>
          : <p className="mt-1 text-xs text-slate-400">Order confirmations will be sent here</p>}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Phone Number <span className="text-rose-500">*</span>
        </label>
        <div className="flex gap-2">
          <div className="flex items-center px-3 h-12 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 shrink-0">+91</div>
          <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={phone}
            onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: '' })); }}
            className={`flex-1 px-4 py-3 rounded-lg border text-slate-900 placeholder:text-slate-400 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${fieldErrors.phone ? 'border-rose-400' : 'border-slate-300'}`} />
        </div>
        {fieldErrors.phone && <p className="mt-1 text-xs text-rose-500">{fieldErrors.phone}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Create Password <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 6 characters" value={password}
            onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' })); }}
            className={`${inputCls} pr-10 ${fieldErrors.password ? 'border-rose-400' : ''}`} />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {fieldErrors.password && <p className="mt-1 text-xs text-rose-500">{fieldErrors.password}</p>}
        <PasswordStrengthBar password={password} />
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Confirm Password <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type={showConfirmPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your password" value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' })); }}
            className={`${inputCls} pr-10 ${fieldErrors.confirmPassword ? 'border-rose-400' : confirmPassword && password === confirmPassword ? 'border-emerald-400' : ''}`} />
          <button type="button" onClick={() => setShowConfirmPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-rose-500">{fieldErrors.confirmPassword}</p>}
      </div>

      {/* Checkboxes */}
      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} className="sr-only" />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${newsletterOptIn ? 'bg-teal-600 border-teal-600' : 'border-slate-300 group-hover:border-teal-400'}`}>
              {newsletterOptIn && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
          </div>
          <span className="text-sm text-slate-600 leading-snug">Subscribe to newsletter and blog updates</span>
        </label>

        <div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => { setTermsAccepted(e.target.checked); if (fieldErrors.terms) setFieldErrors((p) => ({ ...p, terms: '' })); }} className="sr-only" />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${termsAccepted ? 'bg-teal-600 border-teal-600' : fieldErrors.terms ? 'border-rose-400' : 'border-slate-300 group-hover:border-teal-400'}`}>
                {termsAccepted && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
            </div>
            <span className="text-sm text-slate-600 leading-snug">
              I agree to the{' '}
              <Link href="/terms" className="text-teal-600 hover:underline font-medium">Terms &amp; Conditions</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-teal-600 hover:underline font-medium">Privacy Policy</Link>
              {' '}<span className="text-rose-500">*</span>
            </span>
          </label>
          {fieldErrors.terms && <p className="mt-1 ml-8 text-xs text-rose-500">{fieldErrors.terms}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={!isFormReady || isSubmitting}
        className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
      >
        {isSubmitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating your account…</>
          : 'Create Account'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const [tab, setTab] = useState<'phone' | 'email'>('phone');

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">Create Your Account</h1>
        <p className="text-sm text-slate-500 mt-1">
          Join businesses already saving on procurement
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
        <button
          type="button"
          onClick={() => setTab('phone')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            tab === 'phone'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Phone OTP
        </button>
        <button
          type="button"
          onClick={() => setTab('email')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            tab === 'email'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Email + Password
        </button>
      </div>

      {/* Tab content */}
      {tab === 'phone' ? <PhoneRegisterTab /> : <EmailRegisterTab />}

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

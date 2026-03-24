/**
 * Register page — /register
 *
 * Two entry points:
 *   A. Coming from login (phone already verified):
 *      URL has ?phone=XXXXXXXXXX&token=XXXXX
 *      Phone field shows "Phone Verified" badge. No OTP needed.
 *
 *   B. Direct visit (no URL params):
 *      PhoneVerification component handles phone input + OTP inline.
 *      After verification, onVerified callback gives us the firebaseToken.
 *
 * On submit, calls POST /api/auth/register with { firebase_token, full_name, email, phone, ... }
 * Password is collected for future email+password login support but NOT stored.
 */

'use client';

import { useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, User, Briefcase, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { PhoneVerification } from '@/components/auth/PhoneVerification';
import { PasswordStrengthBar } from '@/components/auth/PasswordStrengthBar';

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------

const inputWithIconCls =
  'w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ' +
  'text-slate-900 placeholder:text-slate-400 text-sm transition-colors bg-white';

// ---------------------------------------------------------------------------
// Password validation
// ---------------------------------------------------------------------------

const PASSWORD_RULES = {
  minLength: 8,
  hasLetter: /[a-zA-Z]/,
  hasNumber: /[0-9]/,
};

function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_RULES.minLength) return 'Password must be at least 8 characters.';
  if (!PASSWORD_RULES.hasLetter.test(pw)) return 'Password must include at least one letter.';
  if (!PASSWORD_RULES.hasNumber.test(pw)) return 'Password must include at least one number.';
  return null;
}

// ---------------------------------------------------------------------------
// Inner page (uses useSearchParams — wrapped in Suspense below)
// ---------------------------------------------------------------------------

function RegisterContent() {
  const searchParams = useSearchParams();
  const { register } = useAuth();

  // Read URL params set by the login page on 404 (phone not registered)
  const phoneFromUrl = searchParams.get('phone') ?? '';
  const tokenFromUrl = searchParams.get('token') ?? '';
  const comingFromLogin = Boolean(phoneFromUrl && tokenFromUrl);

  // ── Form fields ───────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Phone verification state ──────────────────────────────────────────────
  // If coming from login, phone and token are already in URL params.
  // If direct visit, PhoneVerification component calls onVerified to set these.
  const [phoneVerified, setPhoneVerified] = useState(comingFromLogin);
  const [verifiedPhone, setVerifiedPhone] = useState(phoneFromUrl); // 10-digit
  const [firebaseToken, setFirebaseToken] = useState(tokenFromUrl);

  // ── Phone verified callback (for direct /register visits) ─────────────────

  const handlePhoneVerified = useCallback((phone: string, token: string) => {
    setVerifiedPhone(phone);
    setFirebaseToken(token);
    setPhoneVerified(true);
  }, []);

  // ── Field validation ──────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!phoneVerified) {
      errors.phone = 'Please verify your phone number first.';
    }
    const pwError = validatePassword(password);
    if (pwError) errors.password = pwError;
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!termsAccepted) {
      errors.terms = 'You must accept the Terms & Conditions to register.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Is form ready to submit? ──────────────────────────────────────────────

  const isFormReady =
    fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    phoneVerified &&
    validatePassword(password) === null &&
    password === confirmPassword &&
    termsAccepted;

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!firebaseToken) {
      toast.error('Phone verification required. Please verify your phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        firebase_token: firebaseToken,
        full_name: fullName.trim(),
        email: email.trim(),
        // verifiedPhone is 10 digits — add +91 prefix for E.164 format
        phone: '+91' + verifiedPhone,
        company_name: businessName.trim() || undefined,
        newsletter_opt_in: newsletterOptIn,
        terms_accepted: termsAccepted,
      });
      // register() handles toast + redirect to /buyer/marketplace
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">
          Create Your Account
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Join businesses already saving on procurement
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* ── Full Name ──────────────────────────────────────────────────── */}
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
              className={`${inputWithIconCls} ${
                fieldErrors.fullName ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400' : ''
              }`}
            />
          </div>
          {fieldErrors.fullName && (
            <p className="mt-1 text-xs text-rose-500">{fieldErrors.fullName}</p>
          )}
        </div>

        {/* ── Business Name ─────────────────────────────────────────────── */}
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
              className={inputWithIconCls}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">Helps vendors identify your orders</p>
        </div>

        {/* ── Email ─────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email <span className="text-rose-500">*</span>
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
              className={`${inputWithIconCls} ${
                fieldErrors.email ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400' : ''
              }`}
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

        {/* ── Phone Number ──────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Phone Number <span className="text-rose-500">*</span>
          </label>

          {comingFromLogin ? (
            /* Coming from login redirect — phone already verified */
            <div className="flex items-center gap-3">
              <div className="flex items-center px-3 h-12 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 shrink-0">
                +91
              </div>
              <div className="flex-1 h-12 px-4 flex items-center rounded-lg border border-emerald-300 bg-emerald-50 text-slate-700 text-sm font-medium">
                {phoneFromUrl}
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 text-sm font-medium shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Verified
              </div>
            </div>
          ) : (
            /* Direct /register visit — PhoneVerification handles OTP inline */
            <PhoneVerification
              onVerified={handlePhoneVerified}
              defaultVerified={false}
            />
          )}

          {fieldErrors.phone && !phoneVerified && (
            <p className="mt-1.5 text-xs text-rose-500">{fieldErrors.phone}</p>
          )}
        </div>

        {/* ── Password ─────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Create Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min. 8 chars, include letters & numbers"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
              }}
              className={`${inputWithIconCls} pr-10 ${
                fieldErrors.password ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400' : ''
              }`}
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
          <p className="mt-1 text-xs text-slate-400">
            Stored for future email login support — not used for login yet
          </p>
        </div>

        {/* ── Confirm Password ──────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Confirm Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
              }}
              className={`${inputWithIconCls} pr-10 ${
                fieldErrors.confirmPassword
                  ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400'
                  : confirmPassword && password === confirmPassword
                  ? 'border-emerald-400 focus:ring-emerald-400 focus:border-emerald-400'
                  : ''
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-rose-500">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {/* ── Checkboxes ────────────────────────────────────────────────── */}
        <div className="space-y-3 pt-1">
          {/* Newsletter */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={newsletterOptIn}
                onChange={(e) => setNewsletterOptIn(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  newsletterOptIn
                    ? 'bg-teal-600 border-teal-600'
                    : 'border-slate-300 group-hover:border-teal-400'
                }`}
              >
                {newsletterOptIn && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-slate-600 leading-snug">
              Subscribe to newsletter and blog updates
            </span>
          </label>

          {/* Terms */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (fieldErrors.terms) setFieldErrors((p) => ({ ...p, terms: '' }));
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    termsAccepted
                      ? 'bg-teal-600 border-teal-600'
                      : fieldErrors.terms
                      ? 'border-rose-400 group-hover:border-rose-500'
                      : 'border-slate-300 group-hover:border-teal-400'
                  }`}
                >
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
                </Link>{' '}
                and{' '}
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

        {/* ── Submit button ──────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={!isFormReady || isSubmitting}
          className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating your account…
            </>
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

      {/* Hidden reCAPTCHA container — required when PhoneVerification is shown */}
      <div id="recaptcha-container" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps inner content in Suspense for useSearchParams
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-teal-600 animate-spin" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}

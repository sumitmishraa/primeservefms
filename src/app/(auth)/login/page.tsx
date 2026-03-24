/**
 * Login page — /login
 *
 * Phone OTP ONLY. No email/password tab.
 *
 * Flow:
 *   1. User enters +91 phone number
 *   2. "Send OTP" → Firebase sends SMS (invisible reCAPTCHA, no popup)
 *   3. User enters 6-digit OTP
 *   4. OTP verified → if user exists → redirect to dashboard
 *                  → if not registered → redirect to /register?phone=...&token=...
 */

'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { OTPInput } from '@/components/auth/OTPInput';
import type { VerifyOTPResult } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// Inner page (uses useSearchParams — wrapped in Suspense below)
// ---------------------------------------------------------------------------

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sendOTP, verifyOTP, redirectAfterLogin } = useAuth();

  type Step = 'phone' | 'otp';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [resetOtp, setResetOtp] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const redirectTo = searchParams.get('redirect');

  // ── Send OTP ──────────────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error('Enter a valid 10-digit phone number.');
      return;
    }

    setIsSending(true);
    try {
      await sendOTP(digits);
      setStep('otp');
      startResendTimer();
      toast.success('OTP sent to +91 ' + digits);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setIsSending(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────

  const handleVerifyOTP = async (otp: string) => {
    setIsVerifying(true);
    setOtpError(false);
    try {
      const result = await verifyOTP(otp);

      if ('needsRegistration' in result) {
        // Phone not registered — redirect to /register with pre-filled data
        const r = result as VerifyOTPResult;
        router.push(
          `/register?phone=${encodeURIComponent(phone)}&token=${encodeURIComponent(r.firebaseToken)}`
        );
        return;
      }

      // User exists — redirect to their dashboard
      toast.success(`Welcome back, ${result.full_name.split(' ')[0]}!`);
      redirectAfterLogin(result, redirectTo);
    } catch (err) {
      setOtpError(true);
      setResetOtp(true);
      setTimeout(() => {
        setResetOtp(false);
        setOtpError(false);
      }, 600);
      toast.error(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Resend OTP timer ──────────────────────────────────────────────────────

  const startResendTimer = () => {
    setSecondsLeft(30);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOTP = async () => {
    setIsSending(true);
    try {
      const digits = phone.replace(/\D/g, '');
      await sendOTP(digits);
      startResendTimer();
      setResetOtp(true);
      setTimeout(() => setResetOtp(false), 100);
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend OTP.');
    } finally {
      setIsSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">
          Welcome to PrimeServe
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your phone number to continue
        </p>
      </div>

      {/* Phone input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Phone Number
        </label>
        <div className="flex gap-2">
          <div className="flex items-center px-3 h-12 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 shrink-0">
            +91
          </div>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="Enter 10-digit number"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
            }
            disabled={step === 'otp'}
            className="flex-1 h-12 px-4 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 placeholder:text-slate-400 text-sm disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
          />
        </div>
      </div>

      {/* Send OTP button — hidden once OTP is sent */}
      {step === 'phone' && (
        <button
          type="button"
          onClick={handleSendOTP}
          disabled={isSending || phone.replace(/\D/g, '').length !== 10}
          className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending OTP…
            </>
          ) : (
            'Send OTP'
          )}
        </button>
      )}

      {/* OTP section — appears after OTP sent */}
      {step === 'otp' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 mb-3">
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-slate-900">
                +91 {phone}
              </span>
            </p>
            <OTPInput
              onComplete={handleVerifyOTP}
              isLoading={isVerifying}
              isError={otpError}
              reset={resetOtp}
            />
          </div>

          {/* Verify button */}
          <button
            type="button"
            disabled={isVerifying}
            className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying…
              </>
            ) : (
              'Verify & Login'
            )}
          </button>

          {/* Resend timer */}
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
                disabled={isSending}
                className="text-xs text-teal-600 hover:underline disabled:opacity-50 font-medium"
              >
                {isSending ? 'Sending…' : 'Resend OTP'}
              </button>
            )}
          </div>
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
        <Link
          href="/register"
          className="text-teal-600 hover:underline font-semibold"
        >
          Register here
        </Link>
      </p>

      {/* Hidden reCAPTCHA container — required by Firebase Phone Auth */}
      <div id="recaptcha-container" />
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

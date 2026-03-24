/**
 * PhoneVerification — inline phone OTP verification.
 *
 * Used on the /register page when the user arrives directly (not via login redirect).
 *
 * Props:
 *   onVerified(phone, firebaseToken) — called after OTP is confirmed.
 *     phone        → 10-digit number (without +91)
 *     firebaseToken → Firebase ID token to use for /api/auth/register
 *   defaultVerified → if true, just show the "Phone Verified" badge (no OTP flow)
 *
 * Flow:
 *   1. User enters 10-digit phone number
 *   2. Clicks "Send OTP"
 *   3. OTP input appears (6 boxes)
 *   4. Uses sendOTP + verifyOTP from useAuth hook
 *   5. If verifyOTP returns { needsRegistration: true } → calls onVerified
 *   6. If verifyOTP returns UserProfile (already registered) → redirectAfterLogin
 */

'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { OTPInput } from './OTPInput';
import type { VerifyOTPResult } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhoneVerificationProps {
  /**
   * Called after the phone OTP is successfully verified.
   * @param phone - 10-digit number WITHOUT +91
   * @param firebaseToken - Firebase ID token for use in /api/auth/register
   */
  onVerified: (phone: string, firebaseToken: string) => void;
  /** Pre-filled phone number (10 digits, without +91) */
  defaultPhone?: string;
  /** When true, skip OTP flow and just show the verified badge */
  defaultVerified?: boolean;
}

const RESEND_COOLDOWN = 30; // seconds

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Handles the phone OTP verification flow inline within the registration form.
 * Uses sendOTP and verifyOTP from the useAuth hook.
 */
export function PhoneVerification({
  onVerified,
  defaultPhone = '',
  defaultVerified = false,
}: PhoneVerificationProps) {
  const { sendOTP, verifyOTP, redirectAfterLogin } = useAuth();

  const [phone, setPhone] = useState(defaultPhone);
  const [step, setStep] = useState<'phone' | 'otp' | 'verified'>(
    defaultVerified ? 'verified' : 'phone'
  );
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [resetOtp, setResetOtp] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // ── Resend timer ──────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    setSecondsLeft(RESEND_COOLDOWN);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Send OTP ──────────────────────────────────────────────────────────────

  const handleSendOTP = useCallback(async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error('Enter a valid 10-digit phone number.');
      return;
    }
    setIsSending(true);
    try {
      await sendOTP(digits);
      setStep('otp');
      startTimer();
      toast.success('OTP sent to +91 ' + digits);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setIsSending(false);
    }
  }, [phone, sendOTP, startTimer]);

  // ── Verify OTP ────────────────────────────────────────────────────────────

  const handleVerifyOTP = useCallback(
    async (otp: string) => {
      setIsVerifying(true);
      setOtpError(false);
      try {
        const result = await verifyOTP(otp);

        if ('needsRegistration' in result) {
          // Phone not registered — pass token up to the register form
          const r = result as VerifyOTPResult;
          const digits = phone.replace(/\D/g, '');
          setStep('verified');
          onVerified(digits, r.firebaseToken);
        } else {
          // Phone already registered — redirect to their dashboard
          toast.success(`Welcome back, ${result.full_name.split(' ')[0]}!`);
          redirectAfterLogin(result);
        }
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
    },
    [phone, verifyOTP, onVerified, redirectAfterLogin]
  );

  // ── Resend ────────────────────────────────────────────────────────────────

  const handleResend = useCallback(async () => {
    setIsSending(true);
    try {
      const digits = phone.replace(/\D/g, '');
      await sendOTP(digits);
      startTimer();
      setResetOtp(true);
      setTimeout(() => setResetOtp(false), 100);
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend OTP.');
    } finally {
      setIsSending(false);
    }
  }, [phone, sendOTP, startTimer]);

  // ── Render: already verified ──────────────────────────────────────────────

  if (step === 'verified') {
    return (
      <div className="flex items-center gap-2 py-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <span className="text-sm font-medium text-emerald-700">Phone Verified</span>
      </div>
    );
  }

  // ── Render: phone input + send OTP ────────────────────────────────────────

  if (step === 'phone') {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex items-center px-3 h-12 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 shrink-0">
            +91
          </div>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
            }
            className="flex-1 h-12 px-4 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 placeholder:text-slate-400 text-sm transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={handleSendOTP}
          disabled={isSending || phone.replace(/\D/g, '').length !== 10}
          className="w-full h-10 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
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
      </div>
    );
  }

  // ── Render: OTP input ─────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>OTP sent to</span>
        <span className="font-semibold text-slate-700">+91 {phone}</span>
        <button
          type="button"
          onClick={() => setStep('phone')}
          className="text-teal-600 hover:underline ml-1"
        >
          Change
        </button>
      </div>

      <OTPInput
        onComplete={handleVerifyOTP}
        isLoading={isVerifying}
        isError={otpError}
        reset={resetOtp}
      />

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
            onClick={handleResend}
            disabled={isSending}
            className="text-xs text-teal-600 hover:underline disabled:opacity-50 font-medium"
          >
            {isSending ? 'Sending…' : 'Resend OTP'}
          </button>
        )}
      </div>
    </div>
  );
}

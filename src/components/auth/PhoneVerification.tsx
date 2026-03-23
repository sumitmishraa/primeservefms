/**
 * PhoneVerification — inline phone OTP verification for the registration form.
 *
 * Flow:
 *   1. User enters 10-digit phone number (passed in via `phone` prop).
 *   2. The moment the 10th digit is typed, OTP is sent AUTOMATICALLY.
 *   3. OTP input appears (OTPInput component, 6 boxes).
 *   4. When all 6 digits are entered → calls onVerified(verificationId, otp).
 *   5. Shows "✓ Phone Verified" badge.
 *   6. Resend timer: 30s countdown before "Resend OTP" activates.
 *
 * Uses signInWithPhoneNumber (standard Firebase API) instead of the older
 * PhoneAuthProvider.verifyPhoneNumber. The verifier is created once and
 * reused — only destroyed on error or when the phone number changes.
 */

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase/config';
import { OTPInput } from './OTPInput';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhoneVerificationProps {
  /** 10-digit phone number to verify (without +91 prefix). */
  phone: string;
  /**
   * Called once the user has entered all 6 OTP digits.
   * @param verificationId - From signInWithPhoneNumber ConfirmationResult
   * @param otp - The 6-digit code the user entered
   */
  onVerified: (verificationId: string, otp: string) => void;
  /** When true interactions are disabled (e.g. parent form is submitting). */
  disabled?: boolean;
}

const RESEND_COOLDOWN = 30; // seconds

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PhoneVerification({
  phone,
  onVerified,
  disabled = false,
}: PhoneVerificationProps) {
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const prevPhoneRef = useRef('');

  const [isSending, setIsSending] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [resetOtp, setResetOtp] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isValidPhone = /^\d{10}$/.test(phone);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
    };
  }, []);

  // ── Start resend countdown ────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    setSecondsLeft(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Send OTP ──────────────────────────────────────────────────────────────

  const sendOTP = useCallback(
    async (phoneNumber: string) => {
      setIsSending(true);
      try {
        // Create the verifier once — reuse it on resend.
        // Only re-create if it was cleared after a previous error.
        if (!recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current = new RecaptchaVerifier(
            auth,
            'phone-recaptcha-container',
            { size: 'invisible', callback: () => {} }
          );
        }

        // signInWithPhoneNumber is the standard Firebase API.
        // We only use the verificationId from the result — we never call
        // confirmationResult.confirm() here, so the user is NOT signed in yet.
        // The verificationId is used later in register() to link the phone.
        const confirmationResult = await signInWithPhoneNumber(
          auth,
          '+91' + phoneNumber,
          recaptchaVerifierRef.current
        );

        setVerificationId(confirmationResult.verificationId);
        startTimer();
        toast.success('OTP sent to +91 ' + phoneNumber);
      } catch (err) {
        // Clear verifier on error so it can be freshly re-created on retry
        recaptchaVerifierRef.current?.clear();
        recaptchaVerifierRef.current = null;

        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('too-many-requests')) {
          toast.error('Too many OTP requests. Please wait a few minutes and try again.');
        } else if (msg.includes('invalid-phone-number')) {
          toast.error('Invalid phone number. Please check and try again.');
        } else if (msg.includes('billing-not-enabled') || msg.includes('quota-exceeded')) {
          toast.error('SMS service temporarily unavailable. Please try again later.');
        } else {
          toast.error('Could not send OTP. Please try again.');
        }
      } finally {
        setIsSending(false);
      }
    },
    [startTimer]
  );

  // ── Reset + auto-send when phone changes ─────────────────────────────────

  useEffect(() => {
    const prevPhone = prevPhoneRef.current;
    prevPhoneRef.current = phone;

    const wasValid = /^\d{10}$/.test(prevPhone);
    const nowValid = /^\d{10}$/.test(phone);

    // Reset all state when the number changes (user is editing)
    if (phone !== prevPhone) {
      setVerificationId(null);
      setIsVerified(false);
      setResetOtp(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setSecondsLeft(0);
      // Destroy old verifier — it was bound to the old phone attempt
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      setTimeout(() => setResetOtp(false), 100);
    }

    // Auto-send the moment the number becomes 10 valid digits
    if (nowValid && !wasValid) {
      void sendOTP(phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  // ── OTP complete ──────────────────────────────────────────────────────────

  const handleOTPComplete = useCallback(
    (otp: string) => {
      if (!verificationId) return;
      // Destroy the verifier now — its DOM element is about to disappear
      // when we switch to the "verified" render state.
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      setIsVerified(true);
      onVerified(verificationId, otp);
    },
    [verificationId, onVerified]
  );

  // ── Render: already verified ──────────────────────────────────────────────

  if (isVerified) {
    return (
      <div className="flex items-center gap-2 py-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <span className="text-sm font-medium text-emerald-700">Phone Verified</span>
      </div>
    );
  }

  // ── Render: OTP boxes (after send succeeds) ───────────────────────────────

  if (verificationId) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Enter the 6-digit code sent to{' '}
          <span className="font-semibold text-slate-700">+91 {phone}</span>
        </p>

        <OTPInput onComplete={handleOTPComplete} reset={resetOtp} />

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
              onClick={() => void sendOTP(phone)}
              disabled={isSending || disabled}
              className="text-xs text-teal-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSending ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
        </div>

        {/* reCAPTCHA mounts here — must stay in the DOM while verifier is alive */}
        <div id="phone-recaptcha-container" />
      </div>
    );
  }

  // ── Render: hint while user is still typing ───────────────────────────────

  return (
    <div className="space-y-2">
      {isSending ? (
        <div className="flex items-center gap-2 py-2 text-sm text-teal-600">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Sending verification code…</span>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          {phone.length > 0 && !isValidPhone
            ? `${10 - phone.length} more digit${10 - phone.length === 1 ? '' : 's'} needed — OTP sends automatically`
            : 'OTP will be sent automatically when you enter 10 digits'}
        </p>
      )}
      {/* reCAPTCHA container must exist before sendOTP is called */}
      <div id="phone-recaptcha-container" />
    </div>
  );
}

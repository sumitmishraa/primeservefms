/**
 * PhoneVerification — inline phone number + OTP verification widget.
 *
 * Used in the register form to prove the user owns the phone number
 * before account creation.
 *
 * Flow:
 *   1. User types a 10-digit number
 *   2. Clicks "Send OTP" → Firebase sends SMS via signInWithPhoneNumber
 *   3. OTP boxes appear; user types the 6-digit code
 *   4. Code confirmed → `onVerified(phoneE164, firebaseIdToken)` fires
 *   5. Parent form can now include the verified phone & token in the POST body
 */

'use client';

import { useState, useCallback } from 'react';
import { Phone, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ConfirmationResult } from 'firebase/auth';
import { sendPhoneOTP, clearRecaptchaVerifier } from '@/lib/firebase/config';
import { OTPInput } from './OTPInput';

interface PhoneVerificationProps {
  /** Called when phone is fully verified. Receives E.164 phone + Firebase ID token. */
  onVerified: (phoneE164: string, idToken: string) => void;
  /** Disable the widget (e.g. while the parent form is submitting) */
  disabled?: boolean;
}

type Stage = 'input' | 'sending' | 'otp' | 'verifying' | 'done';

/**
 * Self-contained phone + OTP verification widget.
 * Calls `onVerified` once the user successfully confirms the OTP.
 */
export function PhoneVerification({ onVerified, disabled = false }: PhoneVerificationProps) {
  const [phone, setPhone]                   = useState('');
  const [stage, setStage]                   = useState<Stage>('input');
  const [confirmation, setConfirmation]     = useState<ConfirmationResult | null>(null);
  const [otpError, setOtpError]             = useState(false);
  const [otpResetKey, setOtpResetKey]       = useState(0);
  const [resendTimer, setResendTimer]       = useState(0);

  // ── Resend countdown ──────────────────────────────────────────────────────
  const startResendTimer = useCallback(() => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleSendOTP = useCallback(async () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error('Enter a valid 10-digit mobile number.');
      return;
    }
    setStage('sending');
    const phoneE164 = '+91' + phone;
    try {
      const result = await sendPhoneOTP(phoneE164, 'phone-otp-btn');
      setConfirmation(result);
      setStage('otp');
      startResendTimer();
      toast.success('OTP sent to +91 ' + phone);
    } catch (err) {
      setStage('input');
      // Surface the actual Firebase error code so support / users can tell
      // apart bad number / rate limit / unauthorised domain / captcha block /
      // billing-not-enabled. See login/page.tsx for the same handling.
      const errObj = err as { code?: string; message?: string };
      const code = errObj?.code ?? '';
      const msg = errObj?.message ?? '';
      console.error('[register phone OTP] firebase error:', { code, msg });

      if (code === 'auth/invalid-phone-number' || msg.includes('invalid-phone-number')) {
        toast.error('Invalid phone number. Use a valid Indian mobile number.');
      } else if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        toast.error('Too many attempts. Please wait a few minutes and try again.');
      } else if (code === 'auth/quota-exceeded') {
        toast.error('Daily SMS quota reached. Try again tomorrow.');
      } else if (
        code === 'auth/captcha-check-failed' ||
        code === 'auth/internal-error' ||
        msg.includes('captcha')
      ) {
        toast.error(
          'OTP verification blocked. This domain may not be authorised in Firebase — use the production URL.',
          { duration: 6000 }
        );
      } else if (code === 'auth/operation-not-allowed') {
        toast.error('Phone sign-in is disabled in Firebase. Contact support.');
      } else if (code === 'auth/billing-not-enabled') {
        toast.error('SMS service requires a Firebase Blaze plan upgrade.');
      } else if (code) {
        toast.error(`OTP failed (${code}). Please try again or contact support.`);
      } else {
        toast.error('Could not send OTP. Please try again.');
      }
    }
  }, [phone, startResendTimer]);

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOTP = useCallback(async (otp: string) => {
    if (!confirmation) return;
    setStage('verifying');
    setOtpError(false);
    try {
      const credential = await confirmation.confirm(otp);
      const idToken = await credential.user.getIdToken();
      setStage('done');
      onVerified('+91' + phone, idToken);
      toast.success('Phone verified!');
    } catch {
      setOtpError(true);
      setOtpResetKey((k) => k + 1);
      setStage('otp');
      toast.error('Wrong OTP. Please try again.');
    }
  }, [confirmation, phone, onVerified]);

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    clearRecaptchaVerifier();
    setStage('input');
    setConfirmation(null);
    setOtpError(false);
    setOtpResetKey((k) => k + 1);
    // Small delay so reCAPTCHA can re-render
    setTimeout(() => handleSendOTP(), 100);
  }, [resendTimer, handleSendOTP]);

  // ── Done state ────────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-medium text-emerald-700">
          +91 {phone} — verified
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Phone input row */}
      <div className="flex gap-2">
        <div className="flex items-center px-3 h-12 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 shrink-0">
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
            disabled={stage !== 'input' || disabled}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        {(stage === 'input' || stage === 'sending') && (
          <button
            id="phone-otp-btn"
            type="button"
            onClick={handleSendOTP}
            disabled={stage === 'sending' || phone.length !== 10 || disabled}
            className="h-12 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg whitespace-nowrap flex items-center gap-1.5 transition-colors"
          >
            {stage === 'sending' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
            ) : (
              'Send OTP'
            )}
          </button>
        )}
      </div>

      {/* OTP entry */}
      {(stage === 'otp' || stage === 'verifying') && (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-500 text-center">
            Enter the 6-digit code sent to <span className="font-semibold">+91 {phone}</span>
          </p>
          <OTPInput
            onComplete={handleVerifyOTP}
            error={otpError}
            isLoading={stage === 'verifying'}
            resetKey={otpResetKey}
          />
          <div className="flex justify-center">
            {resendTimer > 0 ? (
              <span className="text-xs text-slate-400">
                Resend OTP in {resendTimer}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-xs text-teal-600 hover:underline"
              >
                Resend OTP
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

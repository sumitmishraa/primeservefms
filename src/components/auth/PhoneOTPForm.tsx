/**
 * PhoneOTPForm — reusable phone number + OTP verification component.
 *
 * Flow:
 *   1. User enters 10-digit Indian mobile number
 *   2. Firebase sends OTP via SMS (invisible reCAPTCHA handles bot protection)
 *   3. User enters 6-digit OTP in individual boxes (auto-advance on input, supports paste)
 *   4. `onSuccess` is called with the Firebase ID token on verification
 *
 * Props:
 *   onSuccess(idToken)  — called when OTP is verified
 *   isDisabled          — disables all inputs/buttons (e.g. while parent is loading)
 */

"use client";

import { useState, useRef, useEffect } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Phone, ArrowRight, RefreshCw, ChevronLeft } from "lucide-react";
import toast from "react-hot-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhoneOTPFormProps {
  /** Called with the raw Firebase ID token after successful OTP verification. */
  onSuccess: (idToken: string) => void;
  /** Disables all inputs (e.g. while the parent is making an API call). */
  isDisabled?: boolean;
}

type Step = "phone" | "otp";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Two-step phone OTP form: number entry → OTP verification.
 * Handles reCAPTCHA lifecycle, OTP auto-advance, paste, and resend timer.
 */
export function PhoneOTPForm({ onSuccess, isDisabled = false }: PhoneOTPFormProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Cleanup reCAPTCHA on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { recaptchaVerifier.current?.clear(); } catch { /* ignore */ }
    };
  }, []);

  // ── Resend countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Initialises (or re-initialises) the invisible reCAPTCHA verifier. */
  const setupRecaptcha = (): RecaptchaVerifier => {
    try { recaptchaVerifier.current?.clear(); } catch { /* ignore */ }

    recaptchaVerifier.current = new RecaptchaVerifier(
      auth,
      recaptchaContainerRef.current!,
      { size: "invisible", callback: () => {} }
    );
    return recaptchaVerifier.current;
  };

  const isValidPhone = (v: string) => /^\d{10}$/.test(v);

  // ── Send OTP ──────────────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    if (!isValidPhone(phone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setIsSending(true);
    try {
      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, verifier);
      setConfirmation(result);
      setStep("otp");
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(""));
      toast.success(`OTP sent to +91 ${phone}`);
      // Auto-focus first OTP box after render
      setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
    } catch (err) {
      console.error("[PhoneOTPForm] sendOTP:", err);
      toast.error("Failed to send OTP. Check the number and try again.");
      try { recaptchaVerifier.current?.clear(); } catch { /* ignore */ }
    } finally {
      setIsSending(false);
    }
  };

  // ── OTP input handlers ────────────────────────────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1); // keep only last digit
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (digits.length === OTP_LENGTH) {
      e.preventDefault();
      setOtp(digits.split(""));
      otpInputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────

  const handleVerifyOTP = async () => {
    const code = otp.join("");
    if (code.length !== OTP_LENGTH) {
      toast.error("Enter all 6 digits of the OTP");
      return;
    }
    if (!confirmation) return;

    setIsVerifying(true);
    try {
      const result = await confirmation.confirm(code);
      const idToken = await result.user.getIdToken();
      onSuccess(idToken);
    } catch (err) {
      console.error("[PhoneOTPForm] verifyOTP:", err);
      toast.error("Incorrect OTP. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Loading spinner (shared) ──────────────────────────────────────────────
  const Spinner = () => (
    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
  );

  // =========================================================================
  // OTP step
  // =========================================================================

  if (step === "otp") {
    return (
      <div className="space-y-6">
        {/* Back + context */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setStep("phone"); setOtp(Array(OTP_LENGTH).fill("")); }}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Change number
          </button>
          <span className="text-sm text-slate-500">
            Sent to{" "}
            <span className="font-semibold text-slate-700">+91 {phone}</span>
          </span>
        </div>

        {/* OTP boxes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Enter 6-digit OTP
          </label>
          <div
            className="flex gap-2 justify-center"
            onPaste={handleOtpPaste}
          >
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpInputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={isVerifying || isDisabled}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-11 h-12 text-center text-xl font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white disabled:opacity-50 transition-colors"
              />
            ))}
          </div>
        </div>

        {/* Verify button */}
        <button
          onClick={handleVerifyOTP}
          disabled={isVerifying || isDisabled || otp.join("").length !== OTP_LENGTH}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {isVerifying ? <Spinner /> : <ArrowRight className="w-4 h-4" />}
          {isVerifying ? "Verifying…" : "Verify OTP"}
        </button>

        {/* Resend */}
        <div className="text-center text-sm">
          {resendTimer > 0 ? (
            <span className="text-slate-400">
              Resend OTP in{" "}
              <span className="font-mono text-slate-600">{resendTimer}s</span>
            </span>
          ) : (
            <button
              onClick={handleSendOTP}
              disabled={isSending || isDisabled}
              className="flex items-center gap-1 text-teal-600 hover:underline mx-auto disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              Resend OTP
            </button>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Phone number entry step
  // =========================================================================

  return (
    <div className="space-y-5">
      {/* Phone input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Mobile Number
        </label>
        <div className="flex gap-2">
          {/* Country code — India only */}
          <div className="flex items-center gap-1.5 px-3 py-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 text-sm font-medium select-none min-w-[76px]">
            <span className="text-base">🇮🇳</span>
            <span>+91</span>
          </div>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="98765 43210"
            value={phone}
            disabled={isSending || isDisabled}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
            className="flex-1 px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 placeholder:text-slate-400 disabled:opacity-50 transition-colors"
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
          <Phone className="w-3 h-3" />
          India numbers only (+91). OTP sent via SMS.
        </p>
      </div>

      {/* Send OTP button */}
      <button
        onClick={handleSendOTP}
        disabled={isSending || isDisabled || phone.length !== 10}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        {isSending ? <Spinner /> : <ArrowRight className="w-4 h-4" />}
        {isSending ? "Sending OTP…" : "Send OTP"}
      </button>

      {/* Invisible reCAPTCHA mount point — must stay in the DOM */}
      <div ref={recaptchaContainerRef} />
    </div>
  );
}

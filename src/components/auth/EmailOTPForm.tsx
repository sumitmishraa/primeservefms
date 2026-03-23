/**
 * EmailOTPForm — Firebase email magic-link sign-in component.
 *
 * Flow:
 *   1. User enters email address and clicks "Send Login Link"
 *   2. Firebase sends a one-click sign-in link to their inbox
 *      (stored in sessionStorage so we can complete sign-in on return)
 *   3. User clicks the link in email → browser returns to /login
 *   4. LoginPage detects `isSignInWithEmailLink` on mount and completes
 *      the sign-in → calls `onSuccess` with the Firebase ID token
 *
 * This component handles steps 1-2.
 * The LoginPage handles step 3-4 (see handleEmailLinkCallback in login/page.tsx).
 *
 * Props:
 *   onSuccess(idToken)  — called immediately if we detect a completed email link
 *   isDisabled          — disables all inputs/buttons
 */

"use client";

import { useState } from "react";
import { sendSignInLinkToEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Mail, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * sessionStorage key used to persist the email across the magic-link redirect.
 * The login page reads this key to complete sign-in when the user returns.
 */
export const EMAIL_STORAGE_KEY = "primeserve_signin_email";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailOTPFormProps {
  /** Called with Firebase ID token if the current page load completes a magic link. */
  onSuccess: (idToken: string) => void;
  /** Pre-fill the email input (e.g. from a URL param). */
  initialEmail?: string;
  /** Disables all inputs. */
  isDisabled?: boolean;
}

type Step = "input" | "sent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Email magic-link sign-in form.
 * Shows email input → send link → confirmation screen.
 */
export function EmailOTPForm({
  initialEmail = "",
  isDisabled = false,
}: Omit<EmailOTPFormProps, "onSuccess"> & { onSuccess?: never }) {
  const [step, setStep] = useState<Step>("input");
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);

  const handleSendLink = async () => {
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setIsSending(true);
    try {
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      // Persist email so the login page can complete sign-in after the redirect
      sessionStorage.setItem(EMAIL_STORAGE_KEY, email);
      setStep("sent");
      toast.success("Login link sent! Check your inbox.");
    } catch (err) {
      console.error("[EmailOTPForm] sendLink:", err);
      toast.error("Failed to send login link. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  // ── "Check your inbox" confirmation ───────────────────────────────────────

  if (step === "sent") {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-teal-600" />
        </div>

        <div>
          <p className="font-semibold text-slate-900 text-base">
            Check your inbox
          </p>
          <p className="text-sm text-slate-500 mt-1">
            We sent a login link to{" "}
            <span className="font-medium text-slate-700">{email}</span>
          </p>
        </div>

        <p className="text-xs text-slate-400">
          Click the link in the email to sign in instantly.
          <br />
          It expires in 15 minutes.
        </p>

        <button
          onClick={() => {
            setStep("input");
            setEmail("");
            sessionStorage.removeItem(EMAIL_STORAGE_KEY);
          }}
          className="flex items-center gap-1.5 text-sm text-teal-600 hover:underline mx-auto"
        >
          <RotateCcw className="w-3 h-3" />
          Use a different email
        </button>
      </div>
    );
  }

  // ── Email input ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            disabled={isSending || isDisabled}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendLink()}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 placeholder:text-slate-400 disabled:opacity-50 transition-colors"
          />
        </div>
      </div>

      <button
        onClick={handleSendLink}
        disabled={isSending || isDisabled || !isValidEmail(email)}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        {isSending ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
        {isSending ? "Sending…" : "Send Login Link"}
      </button>

      <p className="text-xs text-slate-400 text-center">
        We'll send a one-click sign-in link — no password needed.
      </p>
    </div>
  );
}

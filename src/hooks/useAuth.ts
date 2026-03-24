/**
 * useAuth — central auth hook for Primeserve.
 *
 * Phone OTP ONLY. Email+password has been removed entirely.
 *
 * On first mount it checks the server session via GET /api/auth/me and
 * restores the Zustand store. A module-level flag prevents the check from
 * running more than once per browser session.
 *
 * Exposed actions:
 *   sendOTP(phoneNumber)    → invisible reCAPTCHA → signInWithPhoneNumber → stores ConfirmationResult in ref
 *   verifyOTP(otpCode)      → confirm OTP → getIdToken → POST /api/auth/login
 *                             Returns UserProfile if user exists, or VerifyOTPResult if not registered
 *   register(data)          → POST /api/auth/register → set user in store → redirect
 *   logout()                → clear cookie + redirect to /login
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types';

// ---------------------------------------------------------------------------
// Module-level session check guard (one fetch per browser session)
// ---------------------------------------------------------------------------

let sessionCheckStarted = false;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterData {
  /** Firebase ID token from phone OTP verification */
  firebase_token: string;
  full_name: string;
  email: string;
  /** E.164 format: +91XXXXXXXXXX */
  phone: string;
  company_name?: string;
  newsletter_opt_in: boolean;
  terms_accepted: boolean;
}

/** Returned by verifyOTP when the phone number is not yet registered */
export interface VerifyOTPResult {
  needsRegistration: true;
  /** E.164 phone number, e.g. +91XXXXXXXXXX */
  phone: string;
  /** Firebase ID token — pass to /register as firebase_token */
  firebaseToken: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns auth state and actions. Safe to call in any client component.
 *
 * @example
 *   const { user, isAuthenticated, sendOTP, verifyOTP, logout } = useAuth();
 */
export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, clearUser, setLoading } =
    useAuthStore();
  const router = useRouter();
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  // ── Restore session on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (sessionCheckStarted) return;
    sessionCheckStarted = true;

    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = (await res.json()) as { user: UserProfile };
          if (json.user) {
            setUser(json.user);
            return;
          }
        }
        clearUser();
      } catch {
        clearUser();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ── Dashboard redirect helper ─────────────────────────────────────────────

  /**
   * Pushes the user to their role-specific dashboard.
   * Respects the ?redirect= query param if present.
   *
   * @param u - Authenticated user
   * @param redirectOverride - Optional path to navigate to instead of dashboard
   */
  const redirectAfterLogin = useCallback(
    (u: UserProfile, redirectOverride?: string | null) => {
      if (redirectOverride) {
        router.push(redirectOverride);
        return;
      }
      if (u.role === 'admin') router.push('/admin');
      else if (u.role === 'vendor') router.push('/vendor');
      else router.push('/buyer/marketplace');
    },
    [router]
  );

  // ── sendOTP ───────────────────────────────────────────────────────────────

  /**
   * Creates an invisible reCAPTCHA verifier (once) and sends a phone OTP.
   * Stores the ConfirmationResult in a ref for use by verifyOTP.
   *
   * @param phoneNumber - 10-digit Indian mobile number WITHOUT +91
   * @returns The ConfirmationResult (stored internally; also returned for caller convenience)
   * @throws Error with a human-readable message on failure
   */
  const sendOTP = useCallback(
    async (phoneNumber: string): Promise<ConfirmationResult> => {
      // Always clear and recreate the verifier — reusing a stale verifier
      // causes reCAPTCHA Enterprise "hostname match not found" 400 errors.
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch { /* ignore */ }
        window.recaptchaVerifier = null;
      }

      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
          size: 'invisible',
          callback: () => {
            console.log('[RECAPTCHA] Solved successfully');
          },
          'expired-callback': () => {
            console.log('[RECAPTCHA] Expired — will recreate on next sendOTP');
            if (window.recaptchaVerifier) {
              try { window.recaptchaVerifier.clear(); } catch { /* ignore */ }
              window.recaptchaVerifier = null;
            }
          },
        }
      );

      try {
        const formattedPhone = '+91' + phoneNumber;
        console.log('[OTP] Sending to:', formattedPhone);
        const result = await signInWithPhoneNumber(
          auth,
          formattedPhone,
          window.recaptchaVerifier
        );
        confirmationResultRef.current = result;
        console.log('[OTP] Confirmation result received');
        return result;
      } catch (err) {
        // Clear verifier on error so the next attempt gets a clean slate
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch { /* ignore */ }
          window.recaptchaVerifier = null;
        }
        confirmationResultRef.current = null;

        const msg = err instanceof Error ? err.message : '';
        console.error('[OTP] Send failed:', msg);
        if (msg.includes('too-many-requests')) {
          throw new Error('Too many OTP requests. Please wait and try again.');
        }
        if (msg.includes('invalid-phone-number')) {
          throw new Error('Invalid phone number. Please use a 10-digit Indian mobile number.');
        }
        if (msg.includes('invalid-app-credential') || msg.includes('CAPTCHA')) {
          throw new Error('reCAPTCHA verification failed. Please try again.');
        }
        throw new Error('Failed to send OTP. Please try again.');
      }
    },
    []
  );

  // ── verifyOTP ─────────────────────────────────────────────────────────────

  /**
   * Confirms the OTP using the stored ConfirmationResult, then calls POST /api/auth/login.
   *
   * @param otpCode - 6-digit code entered by the user
   * @returns UserProfile if the user is already registered,
   *          or VerifyOTPResult { needsRegistration: true, phone, firebaseToken }
   *          if the phone is not yet registered (HTTP 404 from the login API).
   * @throws Error with a human-readable message on failure
   */
  const verifyOTP = useCallback(
    async (otpCode: string): Promise<UserProfile | VerifyOTPResult> => {
      if (!confirmationResultRef.current) {
        throw new Error('No OTP session found. Please request a new OTP.');
      }

      setLoading(true);
      try {
        console.log('[OTP] Verifying code...');
        const credential = await confirmationResultRef.current.confirm(otpCode);
        console.log('[OTP] Verified! Firebase UID:', credential.user.uid);
        const idToken = await credential.user.getIdToken();
        console.log('[OTP] Got Firebase ID token');
        const phone = credential.user.phoneNumber ?? '';

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firebase_token: idToken }),
        });
        const json = (await res.json()) as {
          user?: UserProfile;
          error?: string;
          code?: string;
        };

        if (res.status === 404) {
          // Phone not registered — caller should redirect to /register
          return { needsRegistration: true, phone, firebaseToken: idToken };
        }
        if (res.status === 403) {
          throw new Error('Your account has been deactivated. Please contact support.');
        }
        if (!res.ok || !json.user) {
          throw new Error(json.error ?? 'Login failed. Please try again.');
        }

        setUser(json.user);
        return json.user;
      } catch (err) {
        clearUser();
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('invalid-verification-code')) {
          throw new Error('Incorrect OTP. Please check and try again.');
        }
        if (msg.includes('code-expired')) {
          throw new Error('OTP has expired. Please request a new one.');
        }
        throw err instanceof Error ? err : new Error('Verification failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading]
  );

  // ── register ──────────────────────────────────────────────────────────────

  /**
   * Creates a new buyer account in Supabase using a Firebase phone auth token.
   * The firebase_token comes from verifyOTP (either via the login redirect flow
   * or direct registration with phone verification).
   *
   * Note: password is NOT sent or stored — Firebase manages auth.
   *
   * @param data - Registration form data including the firebase_token
   * @throws Error with a human-readable message on failure
   */
  const register = useCallback(
    async (data: RegisterData): Promise<void> => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { user?: UserProfile; error?: string };

        if (!res.ok || !json.user) {
          throw new Error(json.error ?? 'Registration failed. Please try again.');
        }

        setUser(json.user);
        toast.success('Welcome to PrimeServe!');
        router.push('/buyer/marketplace');
      } catch (err) {
        clearUser();
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('already exists')) {
          throw new Error(msg);
        }
        throw err instanceof Error ? err : new Error('Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading, router]
  );

  // ── logout ────────────────────────────────────────────────────────────────

  /**
   * Signs out of Firebase, destroys the session cookie, and redirects to /login.
   */
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      await fetch('/api/auth/logout', { method: 'POST' });
      clearUser();
      router.push('/login');
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to log out. Please try again.');
    }
  }, [clearUser, router]);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    user,
    isLoading,
    isAuthenticated,
    sendOTP,
    verifyOTP,
    register,
    logout,
    redirectAfterLogin,
  };
}

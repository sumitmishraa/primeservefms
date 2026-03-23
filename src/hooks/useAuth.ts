/**
 * useAuth — central auth hook for Primeserve.
 *
 * On first mount it checks the server session via GET /api/auth/me and
 * restores the Zustand store. A module-level flag prevents the check from
 * running more than once per browser session.
 *
 * Exposed actions:
 *   loginWithEmail(email, password)          → Firebase email+password → session cookie
 *   loginWithPhone(phone)                    → Firebase OTP → returns ConfirmationResult
 *   verifyPhoneOTP(confirmationResult, otp)  → confirm OTP → session cookie
 *   register(data)                           → email account + phone link → session cookie
 *   logout()                                 → clear cookie + redirect to /login
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  linkWithCredential,
  RecaptchaVerifier,
  deleteUser,
  signOut,
  type ConfirmationResult,
  type User,
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
  email: string;
  password: string;
  full_name: string;
  phone: string;
  company_name?: string;
  newsletter_opt_in: boolean;
  terms_accepted: boolean;
  /** The verificationId string from the PhoneVerification step */
  verificationId: string;
  /** The 6-digit OTP the user entered */
  otp: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns auth state and actions. Safe to call in any client component.
 *
 * @example
 *   const { user, isAuthenticated, loginWithEmail, logout } = useAuth();
 */
export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, clearUser, setLoading } =
    useAuthStore();
  const router = useRouter();
  const phoneRecaptchaRef = useRef<RecaptchaVerifier | null>(null);

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
            setUser(json.user as UserProfile);
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

  // ── loginWithEmail ────────────────────────────────────────────────────────

  /**
   * Signs in with email + password via Firebase, then exchanges the ID token
   * for a Primeserve session cookie.
   *
   * @param email - User's email address
   * @param password - User's password
   * @returns The authenticated UserProfile
   * @throws Error with a human-readable message on failure
   */
  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      setLoading(true);
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await credential.user.getIdToken();

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firebase_token: idToken }),
        });
        const json = (await res.json()) as { user?: UserProfile; error?: string; code?: string };

        if (res.status === 403) {
          throw new Error('Your account has been deactivated. Please contact support.');
        }
        if (res.status === 404) {
          throw new Error('No account found for this email. Please register first.');
        }
        if (!res.ok || !json.user) {
          throw new Error(json.error ?? 'Login failed. Please try again.');
        }

        setUser(json.user as UserProfile);
        return json.user as UserProfile;
      } catch (err) {
        clearUser();
        const msg = err instanceof Error ? err.message : 'Login failed.';
        // Translate Firebase-specific errors to friendly messages
        if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
          throw new Error('Incorrect email or password. Please try again.');
        }
        if (msg.includes('too-many-requests')) {
          throw new Error('Too many failed attempts. Please wait a few minutes and try again.');
        }
        throw err instanceof Error ? err : new Error(msg);
      }
    },
    [setUser, clearUser, setLoading]
  );

  // ── loginWithPhone ────────────────────────────────────────────────────────

  /**
   * Sends a phone OTP via Firebase signInWithPhoneNumber.
   * Uses an invisible reCAPTCHA verifier bound to #recaptcha-container.
   *
   * @param phone - 10-digit Indian mobile number (without +91)
   * @returns ConfirmationResult — pass this to verifyPhoneOTP
   * @throws Error with a human-readable message on failure
   */
  const loginWithPhone = useCallback(
    async (phone: string): Promise<ConfirmationResult> => {
      // Initialise (or reuse) the invisible reCAPTCHA verifier
      if (!phoneRecaptchaRef.current) {
        phoneRecaptchaRef.current = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          { size: 'invisible', callback: () => {} }
        );
      }

      try {
        const confirmationResult = await signInWithPhoneNumber(
          auth,
          '+91' + phone,
          phoneRecaptchaRef.current
        );
        return confirmationResult;
      } catch (err) {
        // Clear verifier so it can be re-created on retry
        phoneRecaptchaRef.current?.clear();
        phoneRecaptchaRef.current = null;

        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('too-many-requests')) {
          throw new Error('Too many OTP requests. Please wait and try again.');
        }
        if (msg.includes('invalid-phone-number')) {
          throw new Error('Invalid phone number. Please use a 10-digit Indian mobile number.');
        }
        throw new Error('Failed to send OTP. Please try again.');
      }
    },
    []
  );

  // ── verifyPhoneOTP ────────────────────────────────────────────────────────

  /**
   * Confirms the OTP and exchanges the Firebase token for a session cookie.
   *
   * @param confirmationResult - Returned by loginWithPhone
   * @param otp - 6-digit code entered by the user
   * @returns The authenticated UserProfile
   * @throws Error with a human-readable message on failure
   */
  const verifyPhoneOTP = useCallback(
    async (
      confirmationResult: ConfirmationResult,
      otp: string
    ): Promise<UserProfile> => {
      setLoading(true);
      try {
        const credential = await confirmationResult.confirm(otp);
        const idToken = await credential.user.getIdToken();

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firebase_token: idToken }),
        });
        const json = (await res.json()) as { user?: UserProfile; error?: string; code?: string };

        if (res.status === 403) {
          throw new Error('Your account has been deactivated. Please contact support.');
        }
        if (res.status === 404) {
          throw new Error('No account found for this number. Please register first.');
        }
        if (!res.ok || !json.user) {
          throw new Error(json.error ?? 'Login failed. Please try again.');
        }

        setUser(json.user as UserProfile);
        return json.user as UserProfile;
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
      }
    },
    [setUser, clearUser, setLoading]
  );

  // ── register ──────────────────────────────────────────────────────────────

  /**
   * Full buyer registration flow (email-first — no second SMS):
   *   1. createUserWithEmailAndPassword   — create Firebase account with email+password
   *   2. PhoneAuthProvider.credential     — build phone credential from stored verificationId+OTP
   *   3. linkWithCredential               — link phone to the email account (non-blocking on failure)
   *   4. getIdToken()                     — get ID token from the account
   *   5. POST /api/auth/register          — create the Supabase user + set session cookie
   *   6. If step 5 fails                  — delete the Firebase account to prevent orphan
   *
   * Email-first means NO new SMS is ever sent during "Create Account" click.
   * The verificationId+OTP from the earlier phone verification step are reused directly.
   *
   * @param data - Registration form data including verificationId + otp
   * @throws Error with a human-readable message on failure
   */
  const register = useCallback(
    async (data: RegisterData): Promise<void> => {
      setLoading(true);
      let firebaseUser: User | null = null;
      let firebaseUserDeleted = false;

      const cleanupFirebaseUser = async () => {
        if (firebaseUser && !firebaseUserDeleted) {
          firebaseUserDeleted = true;
          try { await deleteUser(firebaseUser); } catch { /* ignore */ }
        }
      };

      try {
        // Step 1: Create Firebase account with email+password (NO SMS sent here)
        const emailResult = await createUserWithEmailAndPassword(auth, data.email, data.password);
        firebaseUser = emailResult.user;

        // Step 2: Build phone credential from the stored verificationId+OTP
        const phoneCredential = PhoneAuthProvider.credential(data.verificationId, data.otp);

        // Step 3: Link phone to the email account — non-blocking if it fails
        // (phone may already be linked to another account; we still proceed)
        try {
          await linkWithCredential(firebaseUser, phoneCredential);
        } catch (linkErr) {
          const linkMsg = linkErr instanceof Error ? linkErr.message : '';
          // credential-already-in-use means the phone is already linked elsewhere — OK to ignore
          if (!linkMsg.includes('credential-already-in-use') && !linkMsg.includes('account-exists-with-different-credential')) {
            // Any other link error — log but don't block registration
            console.warn('[register] Phone link failed (non-fatal):', linkErr);
          }
        }

        // Step 4: Get ID token from the account
        const idToken = await firebaseUser.getIdToken();

        // Step 5: Create Supabase user + set session cookie
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebase_token: idToken,
            full_name: data.full_name.trim(),
            email: data.email,
            phone: '+91' + data.phone,
            ...(data.company_name?.trim() ? { company_name: data.company_name.trim() } : {}),
            newsletter_opt_in: data.newsletter_opt_in,
            terms_accepted: data.terms_accepted,
          }),
        });

        const json = (await res.json()) as { user?: UserProfile; error?: string };

        if (!res.ok || !json.user) {
          await cleanupFirebaseUser();
          throw new Error(json.error ?? 'Registration failed. Please try again.');
        }

        setUser(json.user as UserProfile);
        toast.success('Welcome to Primeserve! Your account is ready.');
        router.push('/buyer/marketplace');
      } catch (err) {
        await cleanupFirebaseUser();
        clearUser();

        const msg = err instanceof Error ? err.message : '';

        if (msg.includes('email-already-in-use')) {
          throw new Error('An account with this email already exists. Please log in instead.');
        }
        if (msg.includes('weak-password')) {
          throw new Error('Password is too weak. Use at least 8 characters with letters and numbers.');
        }
        if (msg.includes('invalid-email')) {
          throw new Error('Please enter a valid email address.');
        }
        if (msg.includes('operation-not-allowed')) {
          throw new Error('Email/Password sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in method.');
        }
        if (msg.includes('too-many-requests')) {
          throw new Error('Too many attempts. Please wait a few minutes and try again.');
        }

        throw err instanceof Error ? err : new Error('Registration failed. Please try again.');
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
    loginWithEmail,
    loginWithPhone,
    verifyPhoneOTP,
    register,
    logout,
    redirectAfterLogin,
  };
}

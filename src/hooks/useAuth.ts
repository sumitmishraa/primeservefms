/**
 * useAuth — central auth hook for Primeserve.
 *
 * Supported auth flows:
 *   1. Email + Password  → login(email, password)
 *   2. Phone OTP         → sendOTP(phone) → confirmOTP(otp) → logs in via /api/auth/verify
 *   3. Phone OTP Register→ register(data) — after phone is verified via PhoneVerification component
 *
 * On first mount it checks the server session via GET /api/auth/me and
 * restores the Zustand store.
 *
 * Exposed actions:
 *   login(email, password)          → POST /api/auth/login → session cookie
 *   sendPhoneOTP(phone)             → Firebase signInWithPhoneNumber
 *   confirmPhoneOTP(otp, idToken)   → POST /api/auth/verify → session cookie
 *   register(data)                  → POST /api/auth/register (email+password)
 *   registerWithPhone(data, idToken)→ POST /api/auth/verify?mode=register
 *   logout()                        → POST /api/auth/logout → clear cookie → redirect /login
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
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
  full_name: string;
  email: string;
  password: string;
  /** 10-digit number — +91 prefix is added before sending to API */
  phone: string;
  company_name?: string;
  newsletter_opt_in: boolean;
  terms_accepted: boolean;
}

export interface RegisterWithPhoneData {
  full_name:    string;
  /** Optional — can be added later */
  email?:       string;
  company_name?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns auth state and actions. Safe to call in any client component.
 */
export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, clearUser, setLoading } =
    useAuthStore();
  const router = useRouter();

  // ── Restore session on mount ──────────────────────────────────────────────
  //
  // Guarantees that isLoading becomes false after this effect runs, no matter
  // what /api/auth/me does:
  //   • 200 + user            → setUser (sets isLoading=false via store action)
  //   • 200 without user / 401 / any non-OK status → clearUser (same)
  //   • network error / thrown promise               → clearUser (catch)
  //   • request hangs longer than SESSION_CHECK_TIMEOUT_MS → AbortController
  //     trips, the catch fires, and we finally still call setLoading(false)
  //     just in case the store actions were never reached.

  useEffect(() => {
    if (sessionCheckStarted) return;
    sessionCheckStarted = true;

    const SESSION_CHECK_TIMEOUT_MS = 3000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);

    (async () => {
      try {
        const res = await fetch('/api/auth/me', { signal: controller.signal });
        if (res.ok) {
          const json = (await res.json()) as { user: UserProfile | null };
          if (json.user) {
            setUser(json.user);
            return;
          }
        }
        // Non-OK status (incl. 401) or 200 without a user → unauthenticated.
        clearUser();
      } catch {
        // Network error, abort, or JSON parse failure → unauthenticated.
        clearUser();
      } finally {
        clearTimeout(timeoutId);
        // Belt-and-braces: setUser/clearUser already set isLoading=false, but
        // if a future refactor ever broke that contract this guarantees the
        // spinner can never be stuck on. Store updates are safe to call even
        // after the initiating component unmounted — Zustand is global.
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dashboard redirect helper ─────────────────────────────────────────────

  /**
   * Pushes the user to their role-specific dashboard.
   * Respects the ?redirect= query param if present.
   */
  const redirectAfterLogin = useCallback(
    (u: UserProfile, redirectOverride?: string | null) => {
      if (redirectOverride) { router.push(redirectOverride); return; }
      // Strict role-based routing. Default fallback is the public marketplace
      // — buyers see the same browse surface as logged-out visitors, just
      // with cart and account-aware features lit up.
      switch (u.role) {
        case 'admin':
          router.push('/admin');
          return;
        case 'vendor':
          router.push('/vendor');
          return;
        case 'buyer':
        default:
          router.push('/marketplace');
          return;
      }
    },
    [router]
  );

  // ── login (email + password) ──────────────────────────────────────────────

  /**
   * Authenticates via email + password.
   *
   * @param email    - User's email address
   * @param password - User's password
   * @returns The authenticated UserProfile
   * @throws Error with a human-readable message on failure
   */
  const login = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        const json = (await res.json()) as { user?: UserProfile; error?: string; code?: string };

        if (res.status === 404) throw new Error('This email is not registered. Please sign up first.');
        if (res.status === 403) throw new Error('Your account has been deactivated. Please contact support.');
        if (res.status === 401) {
          if (json.code === 'NO_PASSWORD') {
            throw new Error('This account was created via phone OTP and has no password set. Please sign in using the OTP option.');
          }
          throw new Error('Incorrect password. Please try again.');
        }
        if (!res.ok || !json.user) throw new Error('Login failed. Please try again.');

        setUser(json.user);
        return json.user;
      } catch (err) {
        clearUser();
        throw err instanceof Error ? err : new Error('Login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading]
  );

  // ── loginWithPhone (phone OTP — after Firebase verification) ─────────────

  /**
   * Completes phone OTP login by sending the Firebase ID token to the server.
   * Call this after `confirmationResult.confirm(otp)` succeeds on the client.
   *
   * @param idToken - Firebase ID token from `user.getIdToken()`
   * @returns The authenticated UserProfile
   * @throws Error with a human-readable message on failure
   */
  const loginWithPhone = useCallback(
    async (idToken: string): Promise<UserProfile> => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/verify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ idToken, mode: 'login' }),
        });
        const json = (await res.json()) as { user?: UserProfile; error?: string; code?: string };

        if (res.status === 404) throw new Error('No account found with this phone number. Please register first.');
        if (res.status === 403) throw new Error('Your account has been deactivated. Please contact support.');
        if (!res.ok || !json.user) throw new Error(json.error ?? 'Login failed. Please try again.');

        setUser(json.user);
        return json.user;
      } catch (err) {
        clearUser();
        throw err instanceof Error ? err : new Error('Login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading]
  );

  // ── register (email + password) ───────────────────────────────────────────

  /**
   * Creates a new buyer account using email + password.
   * Phone number is stored as-is (no Firebase OTP in this flow).
   *
   * @param data - Registration form data
   * @throws Error with a human-readable message on failure
   */
  const register = useCallback(
    async (data: RegisterData): Promise<void> => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/register', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name:         data.full_name.trim(),
            email:             data.email.trim().toLowerCase(),
            phone:             '+91' + data.phone.replace(/\D/g, ''),
            password:          data.password,
            ...(data.company_name?.trim() ? { company_name: data.company_name.trim() } : {}),
            newsletter_opt_in: data.newsletter_opt_in,
            terms_accepted:    data.terms_accepted,
          }),
        });

        const json = (await res.json()) as { user?: UserProfile; error?: string };

        if (!res.ok || !json.user) throw new Error(json.error ?? 'Registration failed. Please try again.');

        setUser(json.user);
        toast.success('Welcome to PrimeServe!');
        // New accounts always have role='buyer' (hardcoded server-side).
        // Send them to the public marketplace, same destination as the
        // post-login redirect for buyers.
        router.push('/marketplace');
      } catch (err) {
        clearUser();
        throw err instanceof Error ? err : new Error('Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading, router]
  );

  // ── registerWithPhone (phone OTP registration) ────────────────────────────

  /**
   * Creates a new buyer account after phone OTP verification.
   * The phone is already verified by Firebase — we send the ID token to the server.
   *
   * @param data    - Name + optional email/company
   * @param idToken - Firebase ID token from `user.getIdToken()` after OTP confirm
   * @throws Error with a human-readable message on failure
   */
  const registerWithPhone = useCallback(
    async (data: RegisterWithPhoneData, idToken: string): Promise<void> => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/verify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            mode:         'register',
            full_name:    data.full_name.trim(),
            email:        data.email?.trim().toLowerCase(),
            company_name: data.company_name?.trim(),
          }),
        });

        const json = (await res.json()) as { user?: UserProfile; error?: string };

        if (!res.ok || !json.user) throw new Error(json.error ?? 'Registration failed. Please try again.');

        setUser(json.user);
        toast.success('Welcome to PrimeServe!');
        // New accounts always have role='buyer' (hardcoded server-side).
        // Send them to the public marketplace, same destination as the
        // post-login redirect for buyers.
        router.push('/marketplace');
      } catch (err) {
        clearUser();
        throw err instanceof Error ? err : new Error('Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading, router]
  );

  // ── logout ────────────────────────────────────────────────────────────────

  /**
   * Destroys the session cookie and redirects to /login.
   */
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Also sign out of Firebase to clear phone/email auth state client-side.
      try { await signOut(auth); } catch {}
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
    login,
    loginWithPhone,
    register,
    registerWithPhone,
    logout,
    redirectAfterLogin,
  };
}

/**
 * Firebase client configuration — Auth ONLY.
 *
 * Enabled sign-in methods:
 *   • Phone OTP  — signInWithPhoneNumber (primary login/register)
 *   • Email+Password — createUserWithEmailAndPassword / signInWithEmailAndPassword
 *
 * FORBIDDEN imports — never add these (they introduce a second database):
 *   import { getFirestore } from "firebase/firestore";
 *   import { getDatabase } from "firebase/database";
 *   import { getStorage } from "firebase/storage";
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

/**
 * Singleton Firebase app instance.
 * getApps() check prevents re-initialisation on hot reload in dev.
 */
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;

/**
 * Firebase Auth instance — Phone OTP + Email+Password sign-in.
 */
export const auth: Auth = getAuth(app);

// ─── Phone OTP helpers ────────────────────────────────────────────────────────

/** Module-level reference to the invisible reCAPTCHA verifier (one per page). */
let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Creates (or reuses) an invisible reCAPTCHA verifier attached to `buttonId`.
 * Call this before `sendPhoneOTP` to prepare the verifier.
 *
 * @param buttonId - The DOM element ID of the "Send OTP" button
 * @returns A ready RecaptchaVerifier instance
 */
export function getRecaptchaVerifier(buttonId: string): RecaptchaVerifier {
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved — OTP request will proceed
    },
  });
  return recaptchaVerifier;
}

/**
 * Clears the cached reCAPTCHA verifier.
 * Call this after a failed send or when the component unmounts.
 */
export function clearRecaptchaVerifier(): void {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

/**
 * Sends a phone OTP to the given E.164 number via Firebase.
 *
 * @param phoneNumber - E.164 format: "+919876543210"
 * @param buttonId    - DOM element ID used to attach the invisible reCAPTCHA
 * @returns Firebase ConfirmationResult — call `.confirm(otp)` with the 6-digit code
 * @throws Error if Firebase rejects the phone number or reCAPTCHA fails
 */
export async function sendPhoneOTP(
  phoneNumber: string,
  buttonId: string
): Promise<ConfirmationResult> {
  const verifier = getRecaptchaVerifier(buttonId);
  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      verifier
    );
    return confirmationResult;
  } catch (error) {
    // Clear verifier so it can be recreated on retry
    clearRecaptchaVerifier();
    throw error;
  }
}

export { RecaptchaVerifier, signInWithPhoneNumber };
export type { ConfirmationResult };
export default app;

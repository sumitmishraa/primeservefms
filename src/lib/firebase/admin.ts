import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Firebase Admin SDK — SERVER-SIDE ONLY.
 *
 * Uses lazy initialization so the SDK is not instantiated at module import time.
 * This prevents build failures when env vars are not available during static analysis.
 *
 * Primary use: verifying Firebase ID tokens sent from the browser after
 * a user signs in via Phone OTP or Email OTP.
 */

/**
 * Returns the Firebase Admin App, initializing it on first call.
 * Subsequent calls reuse the existing app (singleton pattern).
 */
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Private key stored with literal \n — replace with real newlines at runtime
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

/**
 * Returns the Firebase Admin Auth instance.
 * Call this inside request handlers — never at module top-level.
 *
 * Example:
 *   const decoded = await getAdminAuth().verifyIdToken(idToken);
 */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

// CRITICAL: DO NOT import getFirestore or getDatabase anywhere in this file or
// anywhere that imports from here. Firebase is for Auth ONLY in Primeserve.
// All data storage uses Supabase PostgreSQL. Violating this rule will introduce
// two sources of truth and break the architecture.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

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
 * Firebase Auth instance.
 * Supports Phone OTP and Email OTP sign-in methods only.
 * Do not enable Google, GitHub, or password auth — Primeserve uses OTP only.
 */
export const auth: Auth = getAuth(app);

export default app;

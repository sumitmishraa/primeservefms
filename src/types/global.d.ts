import type { RecaptchaVerifier } from 'firebase/auth';

declare global {
  interface Window {
    /** Singleton reCAPTCHA verifier instance — managed by useAuth sendOTP */
    recaptchaVerifier: RecaptchaVerifier | null | undefined;
  }
}

export {};

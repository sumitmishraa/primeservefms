'use client';

/**
 * Banner shown on the auth pages whenever the visitor's hostname is NOT the
 * production domain (e.g. a Vercel preview URL like
 * `primeservefms-7jypzjdc2-...vercel.app`).
 *
 * Why it exists:
 *   Firebase Phone Auth requires the calling domain to be in the project's
 *   "Authorised domains" allow-list. Production is added once; every preview
 *   deployment gets a fresh URL that is NOT on the allow-list, so reCAPTCHA
 *   silently rejects the OTP request and the user sees a generic "Could not
 *   send OTP" error. This banner tells them up front so they don't waste
 *   time on a flow that can't succeed.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const PRODUCTION_HOSTNAME = 'primeservefms.vercel.app';

export default function PreviewDomainNotice() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    // Hide on production and on local dev (Firebase test phones still work
    // on localhost because localhost is auto-authorised by Firebase).
    if (host === PRODUCTION_HOSTNAME) return;
    if (host === 'localhost' || host === '127.0.0.1') return;
    setShowBanner(true);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="text-xs leading-relaxed text-amber-900">
          <p className="font-semibold">Preview deployment</p>
          <p className="mt-0.5 text-amber-800">
            Phone OTP sign-in only works on the production URL{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
              {PRODUCTION_HOSTNAME}
            </code>
            . On this preview, please use <strong>Email &amp; Password</strong> instead.
          </p>
        </div>
      </div>
    </div>
  );
}

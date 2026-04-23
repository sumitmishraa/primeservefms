'use client';

import { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

/**
 * Small warning panel that lists the Firebase test phone numbers
 * visible only in non-production environments. Matches the "Development
 * Mode" banner design: gold accent, mono-font entries, click-to-copy.
 */

interface TestEntry {
  phone: string;
  otp: string;
}

const TEST_ENTRIES: TestEntry[] = [
  { phone: '+919876543210', otp: '123456' },
  { phone: '+919999999999', otp: '999999' },
];

export default function DevModeNotice() {
  const [copied, setCopied] = useState<string | null>(null);

  // Hide in production builds
  if (process.env.NODE_ENV === 'production') return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      // noop
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-amber-600" />
        <span className="font-heading text-sm font-bold text-amber-700">
          Development Mode
        </span>
      </div>
      <p className="mb-2 text-xs font-semibold text-amber-900">
        Test Phone Numbers:
      </p>
      <ul className="space-y-1.5">
        {TEST_ENTRIES.map((e) => {
          const isCopied = copied === e.phone;
          return (
            <li
              key={e.phone}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-1.5"
            >
              <code className="font-mono text-[13px] text-amber-900">
                <span className="font-semibold">{e.phone}</span>
                <span className="mx-2 text-amber-600">→</span>
                <span className="text-amber-700">OTP:</span>{' '}
                <span className="font-bold">{e.otp}</span>
              </code>
              <button
                type="button"
                onClick={() => copy(e.phone)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-amber-600 hover:bg-amber-100"
                aria-label={`Copy ${e.phone}`}
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

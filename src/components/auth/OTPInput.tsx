/**
 * OTPInput — 6-digit one-time-password input.
 *
 * Six individual 48 × 48 px square boxes in a row.
 * - Auto-advances focus to the next box on each keystroke.
 * - Backspace moves focus back and clears the current box.
 * - Pasting a 6-digit code fills all boxes at once.
 * - Fires onComplete(otp) as soon as all six digits are present.
 * - Error state: rose border + shake animation.
 * - Loading state: subtle pulse animation on all boxes.
 */

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OTPInputProps {
  /**
   * Called once all 6 digits are filled.
   * @param otp - The 6-character OTP string
   */
  onComplete: (otp: string) => void;

  /** Shows a loading pulse animation when true. Inputs are disabled. */
  isLoading?: boolean;

  /** Shows a rose-border shake animation when true. */
  isError?: boolean;

  /** Clear and reset all boxes programmatically. */
  reset?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OTPInput({
  onComplete,
  isLoading = false,
  isError = false,
  reset = false,
}: OTPInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  // Reset when the parent signals it
  useEffect(() => {
    if (reset) {
      setDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    }
  }, [reset]);

  // ── Key handler ──────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        setDigits((prev) => {
          const next = [...prev];
          if (next[index]) {
            // Clear current box
            next[index] = '';
          } else if (index > 0) {
            // Move back and clear
            next[index - 1] = '';
            inputRefs.current[index - 1]?.focus();
          }
          return next;
        });
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowRight' && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    []
  );

  // ── Input handler ─────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (index: number, value: string) => {
      // Accept only single digits
      const digit = value.replace(/\D/g, '').slice(-1);
      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;
        // Auto-advance
        if (digit && index < 5) {
          inputRefs.current[index + 1]?.focus();
        }
        // Fire onComplete when all 6 filled
        const joined = next.join('');
        if (joined.length === 6) {
          onComplete(joined);
        }
        return next;
      });
    },
    [onComplete]
  );

  // ── Paste handler ────────────────────────────────────────────────────────

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (!pasted) return;

      const next = Array(6).fill('');
      pasted.split('').forEach((char, i) => {
        if (i < 6) next[i] = char;
      });
      setDigits(next);

      // Focus the last filled box (or the first empty)
      const lastIdx = Math.min(pasted.length, 5);
      inputRefs.current[lastIdx]?.focus();

      if (pasted.length === 6) {
        onComplete(pasted);
      }
    },
    [onComplete]
  );

  // ── Styles ───────────────────────────────────────────────────────────────

  const boxBase =
    'w-12 h-12 text-center text-xl font-semibold rounded-lg border-2 ' +
    'focus:outline-none transition-all duration-150 ' +
    'disabled:cursor-not-allowed';

  const boxState = isError
    ? 'border-rose-400 bg-rose-50 text-rose-900 animate-shake'
    : isLoading
    ? 'border-slate-200 bg-slate-50 text-slate-400 animate-pulse'
    : 'border-slate-300 bg-white text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={isLoading}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onClick={() => inputRefs.current[i]?.select()}
          className={`${boxBase} ${boxState}`}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

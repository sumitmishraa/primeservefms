/**
 * OTPInput — 6-box OTP input component.
 *
 * Features:
 *   • Auto-advances focus to the next box on digit entry
 *   • Backspace moves focus to previous box
 *   • Paste handler fills all 6 boxes at once
 *   • Error state triggers a red shake animation
 *   • Loading state pulses the boxes
 */

'use client';

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react';

interface OTPInputProps {
  /** Called with the full 6-char string whenever all 6 digits are entered */
  onComplete: (otp: string) => void;
  /** Show error shake animation */
  error?: boolean;
  /** Disable all inputs while verifying */
  isLoading?: boolean;
  /** Resets the input fields when this value changes */
  resetKey?: number;
}

/**
 * 6-box OTP input with auto-advance, backspace navigation, paste support,
 * error shake, and loading pulse.
 */
export function OTPInput({ onComplete, error = false, isLoading = false, resetKey }: OTPInputProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [shake, setShake]   = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Reset when parent signals a retry ────────────────────────────────────
  useEffect(() => {
    setDigits(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  }, [resetKey]);

  // ── Trigger shake on error ────────────────────────────────────────────────
  useEffect(() => {
    if (!error) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 600);
    return () => clearTimeout(t);
  }, [error]);

  // ── Handle single-digit input ─────────────────────────────────────────────
  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== '')) {
      onComplete(next.join(''));
    }
  };

  // ── Backspace: clear current then move left ───────────────────────────────
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // ── Paste: fill all 6 boxes at once ──────────────────────────────────────
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] ?? '';
    }
    setDigits(next);
    const lastFilled = Math.min(pasted.length, 5);
    inputRefs.current[lastFilled]?.focus();
    if (pasted.length === 6) onComplete(pasted);
  };

  return (
    <div
      className={`flex gap-2 justify-center ${shake ? 'animate-shake' : ''}`}
      style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
    >
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>

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
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={[
            'w-11 h-12 text-center text-lg font-bold rounded-lg border-2 transition-all',
            'focus:outline-none',
            isLoading
              ? 'bg-slate-100 border-slate-200 text-slate-400 animate-pulse'
              : error
              ? 'border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-500'
              : digit
              ? 'border-teal-500 bg-teal-50 text-teal-700 focus:border-teal-600'
              : 'border-slate-300 bg-white text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-100',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

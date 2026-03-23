/**
 * PasswordStrengthBar — visual password strength indicator.
 *
 * Shows a 4-segment bar that fills left-to-right based on password strength:
 *   1 segment (rose)   — Too weak  (< 8 chars)
 *   2 segments (orange) — Weak     (8+ chars, only letters or only numbers)
 *   3 segments (amber)  — Medium   (8+ chars, letters + numbers)
 *   4 segments (green)  — Strong   (8+ chars, letters + numbers + special char)
 *
 * A text label below the bar describes the current level.
 */

'use client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PasswordStrengthBarProps {
  /** The raw password string to evaluate. */
  password: string;
}

// ---------------------------------------------------------------------------
// Strength calculation
// ---------------------------------------------------------------------------

type Strength = 0 | 1 | 2 | 3 | 4;

interface StrengthInfo {
  level: Strength;
  label: string;
  colour: string;
}

/**
 * Returns the numeric strength level and display metadata for a password.
 *
 * @param password - Raw password string
 */
function getStrength(password: string): StrengthInfo {
  if (!password || password.length < 8) {
    return { level: 1, label: 'Too weak', colour: 'bg-rose-500' };
  }

  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (hasLetters && hasNumbers && hasSpecial) {
    return { level: 4, label: 'Strong', colour: 'bg-emerald-500' };
  }
  if (hasLetters && hasNumbers) {
    return { level: 3, label: 'Medium', colour: 'bg-amber-400' };
  }
  // Only letters or only numbers
  return { level: 2, label: 'Weak', colour: 'bg-orange-400' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays a password strength meter below a password input.
 *
 * @example
 *   <PasswordStrengthBar password={password} />
 */
export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  if (!password) return null;

  const { level, label, colour } = getStrength(password);

  return (
    <div className="mt-2 space-y-1.5">
      {/* 4-segment bar */}
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < level ? colour : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Label */}
      <p
        className={`text-xs font-medium transition-colors duration-300 ${
          level === 1
            ? 'text-rose-500'
            : level === 2
            ? 'text-orange-400'
            : level === 3
            ? 'text-amber-500'
            : 'text-emerald-600'
        }`}
      >
        {label}
      </p>
    </div>
  );
}

export type PasswordStrengthLevel = 'EMPTY' | 'WEAK' | 'MODERATE' | 'STRONG';

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  score: number; // 0, 1, 2, 3
  label: string;
  feedback: string;
  colorClass: string;
  bgClass: string;
}

/**
 * Pure helper to evaluate password strength locally.
 * Aligned with Firebase policy (minimum 6 characters).
 * Does not log or transmit plaintext passwords.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password || password.length === 0) {
    return {
      level: 'EMPTY',
      score: 0,
      label: '',
      feedback: 'Password must be at least 6 characters.',
      colorClass: 'text-text-muted',
      bgClass: 'bg-border',
    };
  }

  if (password.length < 6) {
    return {
      level: 'WEAK',
      score: 1,
      label: 'Weak',
      feedback: 'Password must be at least 6 characters.',
      colorClass: 'text-red-600',
      bgClass: 'bg-red-500',
    };
  }

  let criteriaMet = 0;
  if (password.length >= 8) criteriaMet += 1;
  if (/[a-z]/.test(password)) criteriaMet += 1;
  if (/[A-Z]/.test(password)) criteriaMet += 1;
  if (/[0-9]/.test(password)) criteriaMet += 1;
  if (/[^a-zA-Z0-9]/.test(password)) criteriaMet += 1;

  if (password.length >= 8 && criteriaMet >= 4) {
    return {
      level: 'STRONG',
      score: 3,
      label: 'Strong',
      feedback: 'Strong password with mixed characters.',
      colorClass: 'text-emerald-700',
      bgClass: 'bg-emerald-600',
    };
  }

  if (criteriaMet >= 3 || password.length >= 8) {
    return {
      level: 'MODERATE',
      score: 2,
      label: 'Moderate',
      feedback: 'Good. Add uppercase, numbers, or symbols for stronger security.',
      colorClass: 'text-amber-700',
      bgClass: 'bg-amber-500',
    };
  }

  return {
    level: 'WEAK',
    score: 1,
    label: 'Weak',
    feedback: 'Add uppercase letters, numbers, or symbols to strengthen.',
    colorClass: 'text-red-600',
    bgClass: 'bg-red-500',
  };
}

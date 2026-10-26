import React, { useRef } from 'react';
import { cn } from '../../utils/cn';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
  className?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, onComplete, disabled = false,
  hasError = false, autoFocus = true, idPrefix = 'otp', className }) => {
  const completedRef = useRef('');
  if (value.length < 6) completedRef.current = '';
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const code = event.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(code);
    if (code.length === 6 && completedRef.current !== code) {
      completedRef.current = code;
      onComplete?.(code);
    }
  };
  // One native input preserves selection, deletion, paste and browser autofill.
  // The six visual slots are hidden from assistive technology.
  return (
    <div className={cn('relative w-full max-w-sm mx-auto rounded-xl focus-within:ring-2 focus-within:ring-crimson', className)}>
      <div aria-hidden="true" className="flex gap-1.5 sm:gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={cn('flex-1 min-w-0 h-14 flex items-center justify-center text-2xl font-bold font-mono rounded-xl border-2 bg-white text-gray-900',
            hasError ? 'border-red-500' : 'border-slate-300')}>
            {value[index] || ''}
          </div>
        ))}
      </div>
      <input id={idPrefix} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
        value={value} onChange={handleChange} autoComplete="one-time-code" autoFocus={autoFocus}
        disabled={disabled} aria-label="Six-digit verification code" aria-invalid={hasError}
        className="absolute inset-0 w-full h-full opacity-[0.02] text-transparent caret-transparent focus:opacity-10 disabled:cursor-not-allowed" />
    </div>
  );
};

import React, { useRef, useState } from 'react';
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

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  autoFocus = true,
  idPrefix = 'otp',
  className,
}) => {
  const [isFocused, setIsFocused] = useState(false);
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

  const activeIndex = isFocused && !disabled ? Math.min(value.length, 5) : -1;

  // One native input preserves selection, deletion, paste and browser autofill.
  // The six visual slots are hidden from assistive technology.
  return (
    <div className={cn('relative w-full max-w-sm mx-auto', className)}>
      <div aria-hidden="true" className="flex gap-1.5 sm:gap-3">
        {Array.from({ length: 6 }, (_, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={index}
              className={cn(
                'flex-1 min-w-0 h-14 flex items-center justify-center text-2xl font-bold font-mono rounded-xl border-2 bg-white text-gray-900 transition-all duration-150',
                hasError
                  ? isActive
                    ? 'border-red-500 ring-2 ring-red-500'
                    : 'border-red-500'
                  : isActive
                  ? 'border-crimson ring-2 ring-crimson'
                  : 'border-slate-300'
              )}
            >
              {value[index] || ''}
            </div>
          );
        })}
      </div>
      <input
        id={idPrefix}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="Six-digit verification code"
        aria-invalid={hasError}
        className="absolute inset-0 w-full h-full opacity-0 text-transparent caret-transparent outline-none focus:outline-none cursor-text disabled:cursor-not-allowed"
      />
    </div>
  );
};

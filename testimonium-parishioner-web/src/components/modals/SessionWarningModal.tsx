import React, { useEffect, useRef } from 'react';

interface SessionWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  isRefreshing?: boolean;
  onStaySignedIn: () => void;
  onLogoutNow: () => void;
}

export const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  secondsRemaining,
  isRefreshing = false,
  onStaySignedIn,
  onLogoutNow,
}) => {
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap & keydown handling (ESC, Tab cycling)
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      stayButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onStaySignedIn();
      } else if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onStaySignedIn]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}` : `${seconds} second${seconds !== 1 ? 's' : ''}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-desc"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-6 transform transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-full flex-shrink-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 id="session-warning-title" className="text-lg font-bold text-slate-900">
              Session Expiration Warning
            </h2>
            <p className="text-xs text-slate-500">Security Inactivity Protection</p>
          </div>
        </div>

        <div id="session-warning-desc" className="text-slate-600 text-sm space-y-2">
          <p>Your session will expire due to inactivity.</p>
          <div
            className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-center font-medium"
            aria-live="polite"
            aria-atomic="true"
          >
            Session expires in <span className="font-bold text-amber-700">{timeFormatted}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onLogoutNow}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Logout Now
          </button>
          <button
            ref={stayButtonRef}
            type="button"
            disabled={isRefreshing}
            onClick={onStaySignedIn}
            className="px-5 py-2.5 rounded-lg bg-crimson hover:bg-crimson/90 text-white font-medium text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-crimson disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRefreshing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Refreshing...</span>
              </>
            ) : (
              'Stay Signed In'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

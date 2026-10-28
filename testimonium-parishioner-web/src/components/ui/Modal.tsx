import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  animated?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = '',
  initialFocusRef,
  animated = false,
}) => {
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Keep latest onClose callback in a ref so changes in function identity
  // never restart the focus lifecycle or trigger focus restoration.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Animated opening and closing state management
  const isAnimated = Boolean(animated);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    if (!isAnimated) {
      setIsRendered(isOpen);
      setIsAnimatingIn(isOpen);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isOpen) {
      setIsRendered(true);
      if (prefersReducedMotion) {
        setIsAnimatingIn(true);
      } else {
        const frameId = requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsAnimatingIn(true);
          });
        });
        return () => cancelAnimationFrame(frameId);
      }
    } else {
      setIsAnimatingIn(false);
      if (prefersReducedMotion) {
        setIsRendered(false);
      } else {
        const timer = setTimeout(() => {
          setIsRendered(false);
        }, 220);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, isAnimated]);

  useEffect(() => {
    if (!isOpen) return;

    // Save the element that had focus before the modal opened
    triggerElementRef.current = document.activeElement as HTMLElement | null;

    // Preserve previous body overflow
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && modalContainerRef.current) {
        const focusables = modalContainerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modalContainerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalContainerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Shift initial focus to initialFocusRef, autofocus element, body input, or first focusable
    const timer = setTimeout(() => {
      if (!modalContainerRef.current) return;

      // If an element inside the modal is already focused, do not steal focus
      if (modalContainerRef.current.contains(document.activeElement)) {
        return;
      }

      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      // Check for autofocus element
      const autoFocusEl = modalContainerRef.current.querySelector<HTMLElement>(
        '[autofocus]:not([disabled]), [data-autofocus]:not([disabled])'
      );
      if (autoFocusEl) {
        autoFocusEl.focus();
        return;
      }

      // Check for first text/form input in the modal body (prioritize over Close X button)
      const bodyInput = modalContainerRef.current.querySelector<HTMLElement>(
        '[data-modal-body] input:not([disabled]):not([type="hidden"]), [data-modal-body] textarea:not([disabled]), [data-modal-body] select:not([disabled])'
      );
      if (bodyInput) {
        bodyInput.focus();
        return;
      }

      // Fallback: first focusable in modal body, or any focusable in modal
      const bodyFocusable = modalContainerRef.current.querySelector<HTMLElement>(
        '[data-modal-body] button:not([disabled]), [data-modal-body] a[href], [data-modal-body] [tabindex]:not([tabindex="-1"])'
      );
      if (bodyFocusable) {
        bodyFocusable.focus();
        return;
      }

      const focusables = modalContainerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        modalContainerRef.current.focus();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the trigger element when the modal closes or unmounts
      if (triggerElementRef.current && document.body.contains(triggerElementRef.current)) {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (isAnimated ? !isRendered : !isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  const modalElement = (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity ${
          isAnimated ? 'ease-out' : ''
        } ${
          !isAnimated || isAnimatingIn ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={isAnimated ? { transitionDuration: isAnimatingIn ? '250ms' : '200ms' } : undefined}
        onClick={() => {
          if (isOpen) onCloseRef.current();
        }}
        aria-hidden="true"
      />

      {/* Content Container */}
      <div
        ref={modalContainerRef}
        tabIndex={-1}
        className={`relative w-full bg-white rounded-card shadow-card p-4 sm:p-6 border border-border z-10 focus:outline-none my-auto ${sizes[size]} ${
          isAnimated
            ? 'transition-[opacity,transform] ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100'
            : ''
        } ${className}`}
        style={
          isAnimated
            ? {
                opacity: isAnimatingIn ? 1 : 0,
                transform: isAnimatingIn
                  ? 'translateY(0) scale(1)'
                  : 'translateY(16px) scale(0.98)',
                transitionDuration: isAnimatingIn ? '280ms' : '200ms',
                pointerEvents: isAnimatingIn ? 'auto' : 'none',
              }
            : undefined
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          {title ? (
            <h2 id="modal-title" className="text-base sm:text-lg font-serif font-bold text-text-primary pr-2">
              {title}
            </h2>
          ) : (
            <div />
          )}
          <button
            onClick={() => {
              if (isOpen) onCloseRef.current();
            }}
            className="p-1.5 rounded-full hover:bg-app-page text-text-muted hover:text-text-primary focus-ring flex-shrink-0"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div data-modal-body className="overflow-y-auto max-h-[75vh] px-2 py-1 -mx-2 -my-1">
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalElement, document.body)
    : modalElement;
};

export default Modal;

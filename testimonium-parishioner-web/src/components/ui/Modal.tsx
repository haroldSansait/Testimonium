import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/55 transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content Container */}
      <div className={`relative w-full bg-white rounded-card shadow-card p-6 border border-border z-10 animate-in fade-in zoom-in duration-fast ${sizes[size]}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          {title ? (
            <h2 id="modal-title" className="text-lg font-serif font-bold text-text-primary">
              {title}
            </h2>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-app-page text-text-muted hover:text-text-primary focus-ring"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[75vh]">
          {children}
        </div>
      </div>
    </div>
  );
};
export default Modal;

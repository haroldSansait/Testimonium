import React, { useEffect, useRef } from 'react';
import { X, Lock } from 'lucide-react';
import { PrivacyContent } from '../legal/PrivacyContent';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Lock size={20} />
            </div>
            <div>
              <h2 id="privacy-modal-title" className="text-base sm:text-lg font-serif font-bold text-gray-900">
                Privacy Policy
              </h2>
              <p className="text-xs text-gray-500 font-medium">Version 1.0 — August 2026</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors focus-ring"
            aria-label="Close Privacy Policy Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-gray-800">
          <PrivacyContent />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-gray-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-crimson text-white text-xs font-semibold rounded-button hover:bg-crimson-dark transition-colors focus-ring shadow-sm"
          >
            Close & Return
          </button>
        </div>
      </div>
    </div>
  );
};

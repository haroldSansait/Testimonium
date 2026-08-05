import React, { useState, useEffect, useRef } from 'react';
import { Scale, ShieldCheck, ExternalLink, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface LegalAcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const LegalAcceptanceModal: React.FC<LegalAcceptanceModalProps> = ({
  isOpen,
  onClose,
  onAccept,
}) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const acceptButtonRef = useRef<HTMLButtonElement>(null);

  // Reset checkboxes on open
  useEffect(() => {
    if (isOpen) {
      setTermsAccepted(false);
      setPrivacyAccepted(false);
    }
  }, [isOpen]);

  // Accessibility: Handle Escape key to close modal & focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFormValid = termsAccepted && privacyAccepted;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      onAccept();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      aria-describedby="legal-modal-description"
    >
      <div 
        ref={modalRef}
        className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden focus:outline-none"
        tabIndex={-1}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-crimson/10 rounded-xl text-crimson">
              <Scale size={24} />
            </div>
            <div>
              <h3 id="legal-modal-title" className="text-lg font-serif font-bold text-gray-900">
                Legal Compliance & Terms
              </h3>
              <p id="legal-modal-description" className="text-xs text-gray-600 font-medium">
                Required before continuing with Google Sign-In
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors focus-ring"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
          <p className="text-sm text-gray-800 leading-relaxed font-normal">
            Before proceeding with Google authentication, you must review and accept the official Vicariate Terms of Service and Data Privacy Policy.
          </p>

          <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
            {/* Terms Checkbox */}
            <label className="flex items-start space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-crimson focus:ring-crimson cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-gray-900 font-medium leading-snug">
                I agree to the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-crimson hover:underline inline-flex items-center space-x-1"
                >
                  <span>Terms of Service</span>
                  <ExternalLink size={12} className="inline ml-0.5" />
                </a>
              </span>
            </label>

            {/* Privacy Checkbox */}
            <label className="flex items-start space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-crimson focus:ring-crimson cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-gray-900 font-medium leading-snug">
                I acknowledge the{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-crimson hover:underline inline-flex items-center space-x-1"
                >
                  <span>Privacy Policy</span>
                  <ExternalLink size={12} className="inline ml-0.5" />
                </a>
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="px-4 py-2 text-xs border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </Button>
            <button
              ref={acceptButtonRef}
              type="submit"
              disabled={!isFormValid}
              className={`px-5 py-2.5 rounded-button font-medium text-xs flex items-center space-x-2 transition-colors ${
                isFormValid
                  ? 'bg-crimson text-white hover:bg-crimson-dark shadow-sm cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
              }`}
            >
              <ShieldCheck size={16} />
              <span>Accept & Continue with Google</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LegalAcceptanceModal;

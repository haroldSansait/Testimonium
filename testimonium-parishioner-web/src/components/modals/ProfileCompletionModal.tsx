import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { User, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName?: string;
}

export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  isOpen,
  onClose,
  serviceName: _serviceName = 'proceed with requests',
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="bg-white rounded-card shadow-xl max-w-md w-full p-6 text-left relative overflow-hidden border border-border">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-md text-text-muted hover:text-text-primary transition-colors focus-ring"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
          <User size={24} />
        </div>

        <h3 id="profile-modal-title" className="text-lg font-serif font-bold text-text-primary leading-snug">
          Profile Completion Required
        </h3>

        <p className="text-xs sm:text-sm text-text-muted mt-2 leading-relaxed">
          Complete your profile to access document and schedule requests. Parish offices require your official contact details (Full Name and Mobile Number) for identity verification and notification updates.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2.5 sm:justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Browse Portal
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onClose();
              navigate('/dashboard/profile');
            }}
            className="flex items-center gap-1.5"
          >
            <span>Complete Profile</span>
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmNavigationModalProps {
  onConfirm: () => void;
  onClose: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmNavigationModal({
  onConfirm,
  onClose,
  title = 'Leave without saving?',
  message = 'You have unsaved changes. Leaving this page will discard your changes.',
  confirmLabel = 'Discard & Leave',
  cancelLabel = 'Cancel',
}: ConfirmNavigationModalProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <h3
          className="text-base font-bold text-gray-900 mb-1"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          {title}
        </h3>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 active:scale-95 transition-all cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

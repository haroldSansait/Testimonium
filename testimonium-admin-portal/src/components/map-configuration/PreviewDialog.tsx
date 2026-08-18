import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Phone, Mail, Award, Landmark } from 'lucide-react';
import type { Parish } from '@/types';

interface PreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parish: Parish | null;
  draft: Partial<Parish>;
}

export function PreviewDialog({
  isOpen,
  onClose,
  parish,
  draft
}: PreviewDialogProps) {
  if (!parish) return null;

  // Merge original + draft fields for preview
  const name = parish.name;
  const coverImage = draft.coverImage !== undefined ? draft.coverImage : parish.coverImage;
  const logoImage = draft.logoImage !== undefined ? draft.logoImage : parish.logoImage;
  const description = draft.directoryDescription !== undefined ? draft.directoryDescription : (parish.directoryDescription || '');
  const contact = draft.contactNumber !== undefined ? draft.contactNumber : (parish.contactNumber || '');
  const email = draft.email !== undefined ? draft.email : (parish.email || '');
  const address = parish.address || 'Address not configured';
  const patronSaint = parish.patronSaint || 'Patron saint not configured';
  const vicariate = parish.vicariate || 'Vicariate of Canlaon';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white rounded-xl overflow-hidden shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col z-10 border border-gray-100"
          >
            {/* Header close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 active:scale-95 transition-all z-20 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Scrollable Card Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Cover Image */}
              <div className="relative h-64 bg-gray-900 flex-shrink-0">
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt={`${name} Cover`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-crimson-900 to-neutral-900 text-red-100/50 font-serif text-lg tracking-wider">
                    TESTIMONIUM PARISH DIRECTORY
                  </div>
                )}
                {/* Gradient tint */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

                {/* Parish Logo overlap */}
                <div className="absolute -bottom-8 left-6 w-20 h-20 rounded-full border-4 border-white bg-white overflow-hidden shadow-md">
                  {logoImage ? (
                    <img
                      src={logoImage}
                      alt={`${name} Logo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 font-bold text-lg uppercase">
                      {name.substring(0, 2)}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="pt-12 px-6 pb-6 space-y-6">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 leading-tight font-serif">
                    {name}
                  </h1>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-xs text-gray-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5 text-crimson-700" />
                      {vicariate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-crimson-700" />
                      Patron: {patronSaint}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    About the Parish
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed font-medium">
                    {description || 'No description configured yet.'}
                  </p>
                </div>

                {/* Contact Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4 text-xs text-gray-600">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="font-medium leading-relaxed">{address}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {contact && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-mono font-medium">{contact}</span>
                      </div>
                    )}
                    {email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">{email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer warning */}
            <div className="bg-amber-50 px-6 py-2.5 border-t border-amber-100 flex items-center justify-between text-[11px] text-amber-800 font-semibold flex-shrink-0">
              <span>This is a preview. Changes will not be live until you click Save All on the toolbar.</span>
              <button
                onClick={onClose}
                className="px-2 py-0.5 hover:bg-amber-100 active:scale-95 rounded transition-all"
              >
                Close Preview
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

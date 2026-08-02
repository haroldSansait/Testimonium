import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, CheckSquare } from 'lucide-react';

interface UnsavedChangesBannerProps {
  changeCount: number;
  isSaving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

export function UnsavedChangesBanner({
  changeCount,
  isSaving,
  onDiscard,
  onSave
}: UnsavedChangesBannerProps) {
  return (
    <AnimatePresence>
      {changeCount > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 select-none pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="flex items-center gap-4 px-5 py-3 rounded-full bg-gray-900/95 backdrop-blur border border-gray-800 text-white shadow-2xl pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-xs font-semibold tracking-wide">
                {changeCount} Unsaved {changeCount === 1 ? 'Change' : 'Changes'}
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-gray-800" />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onDiscard}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 active:scale-95 text-xs text-gray-300 hover:text-white transition-all disabled:opacity-50 disabled:scale-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Discard
              </button>

              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-teal-500 hover:bg-teal-400 active:scale-95 text-xs text-white font-bold transition-all shadow-md disabled:bg-teal-500/50 disabled:scale-100"
              >
                {isSaving ? (
                  <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <CheckSquare className="w-3.5 h-3.5" />
                )}
                {isSaving ? 'Saving...' : 'Save All'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

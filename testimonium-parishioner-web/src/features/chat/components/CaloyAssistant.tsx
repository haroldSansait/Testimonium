import React, { useState, useEffect, Suspense } from 'react';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

// Lazy-load the chat drawer only when needed, reducing initial bundle weight
const CaloyDrawer = React.lazy(() => import('./CaloyDrawer'));

export const CaloyAssistant: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedBefore, setHasOpenedBefore] = useState(false);

  // Clear chat conversation logs on user sign-out
  useEffect(() => {
    if (!user) {
      sessionStorage.removeItem('testimonium_caloy_messages');
      setHasOpenedBefore(false);
      setIsOpen(false);
    }
  }, [user]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasOpenedBefore(true);
  };

  return (
    <>
      {/* Floating Action Button - Subtle, hover elevation only, no pulse/bounce */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-[1005] w-14 h-14 bg-crimson hover:bg-crimson-dark text-white rounded-full flex items-center justify-center shadow-card hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 focus-ring"
        aria-label="Open Caloy AI Assistant"
        aria-expanded={isOpen}
      >
        <MessageSquare size={24} />
      </button>

      {/* Lazy-loaded Chat Drawer Panel */}
      {hasOpenedBefore && (
        <Suspense fallback={null}>
          <CaloyDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );
};

export default CaloyAssistant;

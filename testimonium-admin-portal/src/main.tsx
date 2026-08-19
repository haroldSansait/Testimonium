import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { SubmissionProtectionProvider } from '@/context/SubmissionProtectionContext';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { setupInterceptors } from '@/api/interceptors';
import { AppRouter } from '@/routes/AppRouter';
import { SessionWarningModal } from '@/components/modals/SessionWarningModal';
import { useAuth } from '@/hooks/useAuth';
import '@/index.css';

// Initialize Axios interceptors once at startup.
setupInterceptors();

function AppWithSessionModal() {
  const auth = useAuth();

  return (
    <>
      <AppRouter />
      <SessionWarningModal
        isOpen={Boolean(auth?.isWarningModalOpen)}
        secondsRemaining={auth?.secondsRemaining ?? 300}
        onStaySignedIn={async () => {
          if (auth?.staySignedIn) {
            await auth.staySignedIn();
          }
        }}
        onLogoutNow={async () => {
          if (auth?.logout) {
            await auth.logout('manual');
          }
        }}
      />
    </>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <SubmissionProtectionProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={300} skipDelayDuration={150}>
            <AppWithSessionModal />
          </TooltipProvider>
        </AuthProvider>
      </SubmissionProtectionProvider>
    </BrowserRouter>
  </StrictMode>
);

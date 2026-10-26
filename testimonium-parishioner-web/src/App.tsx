import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubmissionProtectionProvider } from './contexts/SubmissionProtectionContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { SessionWarningModal } from './components/modals/SessionWarningModal';

// Public Pages (Static imports for fast entry paint)
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import SignupPage from './pages/public/SignupPage';
import TermsPage from './pages/public/TermsPage';
import PrivacyPage from './pages/public/PrivacyPage';
import VerifyEmailPage from './pages/public/VerifyEmailPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';

// Authenticated Pages (Lazy loaded for optimal code-splitting and loading speeds)
const HomePage = React.lazy(() => import('./pages/dashboard/HomePage'));
const ParishDirectoryPage = React.lazy(() => import('./pages/dashboard/ParishDirectoryPage'));
const SacramentalRequestPage = React.lazy(() => import('./pages/dashboard/SacramentalRequestPage'));
const RequestTrackingPage = React.lazy(() => import('./pages/dashboard/RequestTrackingPage'));
const EventSchedulerPage = React.lazy(() => import('./pages/dashboard/EventSchedulerPage'));
const ScheduleDetailPage = React.lazy(() => import('./pages/dashboard/ScheduleDetailPage'));
const NotificationsPage = React.lazy(() => import('./pages/dashboard/NotificationsPage'));
const ProfilePage = React.lazy(() => import('./pages/dashboard/ProfilePage'));
const HelpPage = React.lazy(() => import('./pages/dashboard/HelpPage'));

// Route layout wrappers
const PublicRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  return <PublicLayout>{element}</PublicLayout>;
};

const DashboardRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  return (
    <DashboardLayout>
      <Suspense 
        fallback={
          <div className="flex items-center justify-center min-h-[400px]" aria-busy="true">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crimson" />
          </div>
        }
      >
        {element}
      </Suspense>
    </DashboardLayout>
  );
};

const AppWithSessionModal: React.FC = () => {
  const auth = useAuth();

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicRoute element={<LandingPage />} />} />
        <Route path="/login" element={<PublicRoute element={<LoginPage />} />} />
        <Route path="/signup" element={<PublicRoute element={<SignupPage />} />} />
        <Route path="/terms" element={<PublicRoute element={<TermsPage />} />} />
        <Route path="/privacy" element={<PublicRoute element={<PrivacyPage />} />} />
        <Route path="/verify-email" element={<PublicRoute element={<VerifyEmailPage key={`${auth.user?.uid}:${auth.user?.email}`} />} />} />
        <Route path="/forgot-password" element={<PublicRoute element={<ForgotPasswordPage key={auth.user?.uid ?? "signed-out"} />} />} />

        {/* Authenticated Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Navigate to="/dashboard/home" replace />} />
          <Route path="/dashboard/home" element={<DashboardRoute element={<HomePage />} />} />
          <Route path="/dashboard/parishes" element={<DashboardRoute element={<ParishDirectoryPage />} />} />
          <Route path="/dashboard/request" element={<DashboardRoute element={<SacramentalRequestPage />} />} />
          <Route path="/dashboard/track" element={<DashboardRoute element={<RequestTrackingPage />} />} />
          <Route path="/dashboard/scheduler" element={<DashboardRoute element={<EventSchedulerPage />} />} />
          <Route path="/dashboard/schedule/:id" element={<DashboardRoute element={<ScheduleDetailPage />} />} />
          <Route path="/dashboard/notifications" element={<DashboardRoute element={<NotificationsPage />} />} />
          <Route path="/dashboard/profile" element={<DashboardRoute element={<ProfilePage />} />} />
          <Route path="/dashboard/help" element={<DashboardRoute element={<HelpPage />} />} />
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <SessionWarningModal
        isOpen={Boolean(auth?.isWarningModalOpen)}
        secondsRemaining={auth?.secondsRemaining ?? 900}
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
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SubmissionProtectionProvider>
          <AuthProvider>
            <AppWithSessionModal />
          </AuthProvider>
        </SubmissionProtectionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;

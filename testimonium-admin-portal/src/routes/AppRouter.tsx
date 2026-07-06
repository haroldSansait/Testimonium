import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DocumentRequestsPage } from '@/pages/DocumentRequestsPage';
import { ScheduleRequestsPage } from '@/pages/ScheduleRequestsPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ActivityLogPage } from '@/pages/ActivityLogPage';

export function AppRouter() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/" element={<LoginPage />} />
      </Route>

      {/* Protected admin routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/document-requests" element={<DocumentRequestsPage />} />
          <Route path="/schedule-requests" element={<ScheduleRequestsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/activity-log" element={<ActivityLogPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

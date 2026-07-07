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
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { PERMISSIONS } from '@/permissions/permissions';

export function AppRouter() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/" element={<LoginPage />} />
      </Route>

      {/* Standalone pages — authenticated only, no layout chrome */}
      <Route element={<ProtectedRoute />}>
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
      </Route>

      {/* Protected admin routes — authenticated + layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          {/* ── Shared routes (all authenticated roles) ── */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/document-requests" element={<DocumentRequestsPage />} />
          <Route path="/schedule-requests" element={<ScheduleRequestsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      {/* ── Diocese Coordinator–only routes ── */}
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_ACTIVITY_LOG} />}>
        <Route element={<AdminLayout />}>
          <Route path="/activity-log" element={<ActivityLogPage />} />
        </Route>
      </Route>

      {/* Phase 5B routes — permission gates are wired now so the sidebar
          can safely link to them. Pages will be implemented in 5B. */}
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_ANALYTICS} />}>
        <Route element={<AdminLayout />}>
          {/* AnalyticsPage will replace this Navigate in Phase 5B */}
          <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_PARISHES} />}>
        <Route element={<AdminLayout />}>
          {/* ParishManagementPage will replace this Navigate in Phase 5B */}
          <Route path="/parish-management" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS} />}>
        <Route element={<AdminLayout />}>
          {/* UserManagementPage will replace this Navigate in Phase 5B */}
          <Route path="/user-management" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

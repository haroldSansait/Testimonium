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
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ParishManagementPage } from '@/pages/ParishManagementPage';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { MassSchedulePage } from '@/pages/MassSchedulePage';
import { StaffAvailabilityPage } from '@/pages/StaffAvailabilityPage';
import { PERMISSIONS } from '@/permissions/permissions';
import { ProfilePage } from '@/pages/ProfilePage';

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
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* ── Secretary / Coordinator Mass Schedule Settings ── */}
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_MASS_SCHEDULE} />}>
        <Route element={<AdminLayout />}>
          <Route path="/mass-schedule" element={<MassSchedulePage />} />
        </Route>
      </Route>

      {/* ── Staff Availability / Leave Settings ── */}
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_MY_AVAILABILITY} />}>
        <Route element={<AdminLayout />}>
          <Route path="/availability" element={<StaffAvailabilityPage />} />
        </Route>
      </Route>

      {/* ── Diocese Coordinator–only routes ── */}
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_ACTIVITY_LOG} />}>
        <Route element={<AdminLayout />}>
          <Route path="/activity-log" element={<ActivityLogPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_ANALYTICS} />}>
        <Route element={<AdminLayout />}>
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_PARISHES} />}>
        <Route element={<AdminLayout />}>
          <Route path="/parish-management" element={<ParishManagementPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS} />}>
        <Route element={<AdminLayout />}>
          <Route path="/user-management" element={<UserManagementPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { CaloyLayout } from '@/layouts/CaloyLayout';
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
import { SettingsPage } from '@/pages/SettingsPage';
import { MapConfigurationPage } from '@/pages/MapConfigurationPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { KnowledgeSourceDetailPage } from '@/pages/KnowledgeSourceDetailPage';
import { CaloyOverviewPage } from '@/pages/caloy/CaloyOverviewPage';
import { CaloyAnalyticsPage } from '@/pages/caloy/CaloyAnalyticsPage';
import { CaloySettingsPage } from '@/pages/caloy/CaloySettingsPage';
import { CaloyLogsPage } from '@/pages/caloy/CaloyLogsPage';

function LegacyKnowledgeDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/caloy/knowledge-base/${id}`} replace />;
}


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

      {/* ── Parish Settings ── */}
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_PARISH_SETTINGS} />}>
        <Route element={<AdminLayout />}>
          <Route path="/settings" element={<SettingsPage />} />
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
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_REPORTS} />}>
        <Route element={<AdminLayout />}>
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_PARISHES} />}>
        <Route element={<AdminLayout />}>
          <Route path="/parish-management" element={<ParishManagementPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_MAP_CONFIG} />}>
        <Route element={<AdminLayout />}>
          <Route path="/map-configuration" element={<MapConfigurationPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS} />}>
        <Route element={<AdminLayout />}>
          <Route path="/user-management" element={<UserManagementPage />} />
        </Route>
      </Route>

      {/* ── Caloy Control Center ── */}
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_CALOY} />}>
        <Route element={<AdminLayout />}>
          <Route path="/caloy" element={<CaloyLayout />}>
            <Route index element={<CaloyOverviewPage />} />
            <Route path="analytics" element={<CaloyAnalyticsPage />} />
            <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_KNOWLEDGE_BASE} />}>
              <Route path="knowledge-base" element={<KnowledgeBasePage />} />
              <Route path="knowledge-base/:id" element={<KnowledgeSourceDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_CALOY_SETTINGS} />}>
              <Route path="settings" element={<CaloySettingsPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_CALOY_LOGS} />}>
              <Route path="logs" element={<CaloyLogsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      {/* ── Legacy Knowledge Base Redirects ── */}
      <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_KNOWLEDGE_BASE} />}>
        <Route element={<AdminLayout />}>
          <Route path="/knowledge-base" element={<Navigate to="/caloy/knowledge-base" replace />} />
          <Route path="/knowledge-base/:id" element={<LegacyKnowledgeDetailRedirect />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

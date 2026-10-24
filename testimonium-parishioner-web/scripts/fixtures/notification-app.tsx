/* eslint-disable react/only-export-components -- Standalone browser test entry, not a Fast Refresh component module. */
// Browser-only fixture: real dashboard, provider, query hook, toast layer and center.
// Only authentication and the notification service boundary are controlled.
import React, { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { NotificationProvider, useNotifications } from '../../src/contexts/NotificationContext';
import { ProfileRequirementProvider } from '../../src/contexts/ProfileRequirementContext';
import { ToastProvider, useToast } from '../../src/contexts/ToastContext';
import { DashboardLayout } from '../../src/layouts/DashboardLayout';
import { NotificationsPage } from '../../src/pages/dashboard/NotificationsPage';
import { queryClient, setQueryScope } from '../../src/services/queryClient';
import { FixtureAuthProvider } from './notification-auth';
import '../../src/index.css';

queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
setQueryScope('fixture-a', 'PARISHIONER', '3');

function Dashboard() {
  const notifications = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  useLayoutEffect(() => {
    Object.assign(window.fixture, { notifications, navigate, toast });
  });
  return <ProfileRequirementProvider><DashboardLayout>
    {location.pathname === '/dashboard/notifications' ? <NotificationsPage /> : <p>Dashboard fixture</p>}
  </DashboardLayout></ProfileRequirementProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><QueryClientProvider client={queryClient}>
    <FixtureAuthProvider><ToastProvider><NotificationProvider><Dashboard /></NotificationProvider></ToastProvider></FixtureAuthProvider>
  </QueryClientProvider></BrowserRouter></StrictMode>
);

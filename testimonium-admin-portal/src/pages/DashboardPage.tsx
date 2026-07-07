import { useAuth } from '@/hooks/useAuth';
import { DioceseDashboard } from '@/components/dashboard/DioceseDashboard';
import { SecretaryDashboard } from '@/components/dashboard/SecretaryDashboard';
import { PriestDashboard } from '@/components/dashboard/PriestDashboard';

/**
 * DashboardPage — role router.
 *
 * Single route (/dashboard) for all roles. Renders a role-appropriate
 * sub-component so each persona sees a tailored experience while keeping
 * routing simple and shared logic easy to maintain.
 *
 *  DashboardPage
 *   ├── DioceseDashboard   (DIOCESE_COORDINATOR)
 *   ├── SecretaryDashboard (SECRETARY)
 *   └── PriestDashboard    (PRIEST)
 */
export function DashboardPage() {
  const { role } = useAuth();

  if (role === 'DIOCESE_COORDINATOR') {
    return <DioceseDashboard />;
  }

  if (role === 'PRIEST') {
    return <PriestDashboard />;
  }

  // Default: SECRETARY and any other authenticated role fall back here.
  return <SecretaryDashboard />;
}

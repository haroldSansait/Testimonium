import type {
  DioceseStat,
  DioceseActivity,
  DioceseNotification,
} from '@/types';

// ─── Diocese overview stats ───────────────────────────────────────────────────

export const dioceseStats: DioceseStat[] = [
  {
    id: 'total-parishes',
    label: 'Total Parishes',
    value: 18,
    icon: 'Church',
    iconColor: 'text-crimson-700',
    bgColor: 'bg-red-50',
  },
  {
    id: 'total-quasi-parishes',
    label: 'Quasi-Parishes',
    value: 7,
    icon: 'MapPin',
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    id: 'total-mission-stations',
    label: 'Mission Stations',
    value: 12,
    icon: 'Compass',
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    id: 'total-secretaries',
    label: 'Total Secretaries',
    value: 25,
    icon: 'User',
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'total-priests',
    label: 'Total Priests',
    value: 31,
    icon: 'Users',
    iconColor: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  {
    id: 'total-parishioners',
    label: 'Total Parishioners',
    value: 14280,
    icon: 'PersonStanding',
    iconColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    id: 'pending-doc-requests',
    label: 'Pending Documents',
    value: 143,
    icon: 'FileText',
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    id: 'pending-sched-requests',
    label: 'Pending Schedules',
    value: 56,
    icon: 'CalendarDays',
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
  },
];

// ─── Recent activity feed ──────────────────────────────────────────────────────

export const dioceseRecentActivity: DioceseActivity[] = [
  {
    id: 'act-1',
    actor: 'Maria Santos',
    actorInitials: 'MS',
    actorColor: '#7B1C2A',
    action: 'Approved Baptismal Certificate request',
    parish: 'St. Joseph Parish',
    timeAgo: '5 mins ago',
  },
  {
    id: 'act-2',
    actor: 'Rev. Fr. Julius L. Montaño',
    actorInitials: 'JM',
    actorColor: '#1D4ED8',
    action: 'Confirmed Wedding schedule',
    parish: 'Our Lady of the Mountains Quasi-Parish',
    timeAgo: '22 mins ago',
  },
  {
    id: 'act-3',
    actor: 'Elena Cruz',
    actorInitials: 'EC',
    actorColor: '#B45309',
    action: 'Created new document request',
    parish: 'Our Lady of the Miraculous Medal Parish',
    timeAgo: '1 hr ago',
  },
  {
    id: 'act-4',
    actor: 'Rev. Fr. Faustino G. Cedeño, Jr.',
    actorInitials: 'FC',
    actorColor: '#065F46',
    action: 'Rejected schedule request — conflict',
    parish: 'Nuestra Señora De Las Flores Mission Station',
    timeAgo: '2 hrs ago',
  },
  {
    id: 'act-5',
    actor: 'Ana Reyes',
    actorInitials: 'AR',
    actorColor: '#6D28D9',
    action: 'Released Confirmation Certificate',
    parish: 'Our Lady of Peace and Good Voyage Quasi-Parish',
    timeAgo: '3 hrs ago',
  },
];

// ─── Diocese notifications ────────────────────────────────────────────────────

export const dioceseNotifications: DioceseNotification[] = [
  {
    id: 'dn-1',
    type: 'warning',
    title: 'High Document Volume',
    body: 'St. Joseph Parish has 34 pending requests exceeding the 30-request threshold.',
    timeAgo: '10 mins ago',
  },
  {
    id: 'dn-2',
    type: 'info',
    title: 'Quarterly Report Due',
    body: 'Vicariate IV sacrament statistics report is due by July 15, 2026.',
    timeAgo: '2 hrs ago',
  },
  {
    id: 'dn-3',
    type: 'success',
    title: 'New Parish Onboarded',
    body: 'San Isidro Mission Station has been successfully registered in the system.',
    timeAgo: '1 day ago',
  },
  {
    id: 'dn-4',
    type: 'warning',
    title: 'Unassigned Secretary',
    body: 'Our Lady of the Assumption Parish has no active secretary assigned.',
    timeAgo: '2 days ago',
  },
];

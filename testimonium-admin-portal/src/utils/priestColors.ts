/**
 * Deterministic Priest Color Utility
 * Guarantees that each priest is always assigned the exact same color badge
 * across Calendar, Schedule Requests, Event Details, and Reports.
 */

export interface PriestColor {
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  hex: string;
}

const PRIEST_PALETTE: PriestColor[] = [
  { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', badgeBg: 'bg-amber-100', badgeText: 'text-amber-900', hex: '#D97706' },
  { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-300', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-900', hex: '#4F46E5' },
  { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-900', hex: '#059669' },
  { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300', badgeBg: 'bg-rose-100', badgeText: 'text-rose-900', hex: '#E11D48' },
  { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-300', badgeBg: 'bg-cyan-100', badgeText: 'text-cyan-900', hex: '#0891B2' },
  { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300', badgeBg: 'bg-purple-100', badgeText: 'text-purple-900', hex: '#9333EA' },
  { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300', badgeBg: 'bg-orange-100', badgeText: 'text-orange-900', hex: '#EA580C' },
  { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-300', badgeBg: 'bg-teal-100', badgeText: 'text-teal-900', hex: '#0D9488' },
];

/**
 * Hash string/ID deterministically to index into PRIEST_PALETTE.
 */
export function getPriestColor(priestIdentifier?: string | number | null): PriestColor {
  if (!priestIdentifier || priestIdentifier === 'TBD') {
    // Default fallback neutral style for unassigned events
    return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300', badgeBg: 'bg-gray-100', badgeText: 'text-gray-800', hex: '#6B7280' };
  }

  const str = String(priestIdentifier);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % PRIEST_PALETTE.length;
  return PRIEST_PALETTE[index];
}

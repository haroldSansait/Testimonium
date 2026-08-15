import type {
  SacramentStat,
  DocumentAnalyticsStat,
  ParishAnalyticsStat,
} from '@/types';

// ─── Sacrament analytics ──────────────────────────────────────────────────────

export const sacramentStats: SacramentStat[] = [
  { type: 'Baptisms',      count: 412, trend: +8.2  },
  { type: 'Confirmations', count: 189, trend: +3.5  },
  { type: 'Weddings',      count: 74,  trend: -2.1  },
  { type: 'Funerals',      count: 53,  trend: +1.0  },
];

// ─── Document analytics ───────────────────────────────────────────────────────

export const documentStats: DocumentAnalyticsStat[] = [
  { documentType: 'Baptismal Certificate',    requestCount: 631, completionRate: 92, avgProcessingDays: 2.1 },
  { documentType: 'Confirmation Certificate', requestCount: 214, completionRate: 88, avgProcessingDays: 2.8 },
  { documentType: 'Marriage Certificate',     requestCount: 97,  completionRate: 81, avgProcessingDays: 4.3 },
  { documentType: 'Good Moral Character',     requestCount: 182, completionRate: 95, avgProcessingDays: 1.5 },
  { documentType: 'Death Certificate',        requestCount: 58,  completionRate: 79, avgProcessingDays: 3.2 },
  { documentType: 'Burial Permit',            requestCount: 44,  completionRate: 97, avgProcessingDays: 0.8 },
];

// ─── Parish analytics ─────────────────────────────────────────────────────────

export const parishStats: ParishAnalyticsStat[] = [
  { parish: 'Our Lady of the Mountains Quasi-Parish',        requestCount: 284, activeParishioners: 3140, newRegistrations: 42 },
  { parish: 'St. Joseph Parish',                              requestCount: 197, activeParishioners: 2310, newRegistrations: 31 },
  { parish: 'Our Lady of the Miraculous Medal Parish',        requestCount: 162, activeParishioners: 1890, newRegistrations: 28 },
  { parish: 'Nuestra Señora De Las Flores Mission Station',   requestCount: 141, activeParishioners: 1720, newRegistrations: 19 },
  { parish: 'Our Lady of Peace and Good Voyage Quasi-Parish', requestCount: 118, activeParishioners: 1450, newRegistrations: 15 },
  { parish: 'Holy Child Parish',                              requestCount: 76,  activeParishioners: 980,  newRegistrations: 11 },
  { parish: 'Our Lady of Guadalupe Parish',                   requestCount: 48,  activeParishioners: 560,  newRegistrations: 7  },
];

export type ParishType = "Parish" | "Quasi-Parish" | "Mission Station";

export type ParishTypeFilter = "all" | ParishType;

export interface OfficeHoursDay {
  openTime?: string;
  closeTime?: string;
  isClosed?: boolean;
  // Legacy / alternate fallback fields
  open?: string;
  close?: string;
  closed?: boolean;
}

export type OfficeHoursRecord = Record<string, OfficeHoursDay | string | undefined>;

export interface ParishDto {
  id: string;
  name: string;
  slug?: string;
  type: ParishType | string;
  vicariate?: string;
  priest?: string;
  priestName?: string;
  secretary?: string;
  secretaryName?: string;
  status?: string;
  patronSaint?: string;
  address?: string;
  municipalityCity?: string;
  province?: string;
  contactNumber?: string;
  email?: string;
  latitude?: number | null;
  longitude?: number | null;
  feastDay?: string;
  coverImage?: string;
  logoImage?: string;
  mapZoom?: number | null;
  pinColor?: string | null;
  showLabel?: boolean | null;
  isMotherParish?: boolean | null;
  directoryDescription?: string;
  officeHours?: OfficeHoursRecord | null;
  gallery?: string[];
  venueCapacity?: number | null;
  availableDocuments?: string[];
  eventSettings?: { availableEvents?: string[]; timeSlots?: string[]; capacitySettings?: { dailyLimit?: number; slotCapacity?: number } } | null;
}

export interface ParishListResponse {
  items: ParishDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ParishListFilters {
  search?: string;
  type?: ParishTypeFilter;
  page?: number;
  limit?: number;
}

export const PARISH_TYPE_LABELS: Record<ParishType, string> = {
  Parish: "Parish",
  "Quasi-Parish": "Quasi-Parish",
  "Mission Station": "Mission Station",
};

export const PARISH_TYPE_FILTERS: { label: string; value: ParishTypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Parish", value: "Parish" },
  { label: "Quasi-Parish", value: "Quasi-Parish" },
  { label: "Mission Station", value: "Mission Station" },
];

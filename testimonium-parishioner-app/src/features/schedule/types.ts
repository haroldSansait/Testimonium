export const CANONICAL_SCHEDULE_EVENT_TYPES = [
  "WEDDING",
  "MARRIAGE_SPECIAL",
  "BAPTISM",
  "CONFIRMATION",
  "FIRST_COMMUNION",
  "CONFESSION",
  "ANOINTING_OF_THE_SICK",
  "PRIVATE_MASS",
  "MASS_INTENTION",
  "WAKE_MASS",
  "FUNERAL",
  "MASS_OF_HOLY_SPIRIT",
  "FIESTA",
  "THANKSGIVING",
  "BLESSING",
  "DELIVERANCE",
] as const;

export type ScheduleEventType = typeof CANONICAL_SCHEDULE_EVENT_TYPES[number];

export const SCHEDULE_EVENT_LABELS: Record<ScheduleEventType, string> = {
  WEDDING: "Marriage (Canonical Interview)",
  MARRIAGE_SPECIAL: "Marriage (Special)",
  BAPTISM: "Baptism",
  CONFIRMATION: "Confirmation",
  FIRST_COMMUNION: "First Communion",
  CONFESSION: "Confession",
  ANOINTING_OF_THE_SICK: "Anointing of the Sick",
  PRIVATE_MASS: "Mass",
  MASS_INTENTION: "Mass Intention",
  WAKE_MASS: "Wake Mass",
  FUNERAL: "Funeral",
  MASS_OF_HOLY_SPIRIT: "Mass of the Holy Spirit",
  FIESTA: "Fiesta",
  THANKSGIVING: "Thanksgiving",
  BLESSING: "Blessing",
  DELIVERANCE: "Deliverance",
};

export const SCHEDULE_EVENT_CATEGORIES: Record<string, ScheduleEventType[]> = {
  "Sacraments": [
    "BAPTISM",
    "CONFIRMATION",
    "FIRST_COMMUNION",
    "CONFESSION",
    "WEDDING",
    "MARRIAGE_SPECIAL",
    "ANOINTING_OF_THE_SICK",
  ],
  "Masses & Intentions": [
    "MASS_INTENTION",
    "PRIVATE_MASS",
    "MASS_OF_HOLY_SPIRIT",
    "WAKE_MASS",
    "FUNERAL",
    "FIESTA",
    "THANKSGIVING",
  ],
  "Blessings & Devotions": [
    "BLESSING",
    "DELIVERANCE",
  ],
};

export type ScheduleStatus =
  | "PENDING"
  | "REQUESTED"
  | "PROPOSED_RESCHEDULE"
  | "WAITING_PARISHIONER_RESPONSE"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

export interface ScheduleParish {
  id: number;
  parishName: string;
  type?: string;
  municipalityCity?: string;
  province?: string;
  contactNumber?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface ScheduleUser {
  id: number;
  fullName: string;
  email: string;
  contactNumber?: string | null;
  address?: string | null;
}

export interface ScheduleStaff {
  id: number;
  fullName: string;
  email?: string | null;
}

export interface ScheduleItem {
  id: number;
  userId: number;
  parishId: number;
  assignedPriestId?: number | null;
  requestedPriestId?: number | null;
  requestedPriest?: { id: number; name: string } | null;
  eventType: ScheduleEventType;
  requestedDate: string;
  startDatetime?: string | null;
  endDatetime?: string | null;
  location?: string | null;
  proposedDate?: string | null;
  proposedStartDatetime?: string | null;
  proposedEndDatetime?: string | null;
  rescheduleReason?: string | null;
  status: ScheduleStatus;
  conflictFlag?: boolean;
  remarks?: string | null;
  displayTitle?: string | null;
  processedById?: number | null;
  priestResponseStatus?: string | null;
  priestResponseReason?: string | null;
  version?: number;
  createdAt: string;
  updatedAt: string;
  parish?: ScheduleParish;
  user?: ScheduleUser;
  assignedPriest?: ScheduleStaff | null;
  processedBy?: ScheduleStaff | null;
}

export interface ScheduleListResponse {
  data: ScheduleItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AvailabilityDatesResponse {
  eventType: ScheduleEventType | string;
  serviceAvailable: boolean;
  dates: string[];
}

export interface SchedulingConfiguration {
  parishId: number;
  schedulingAvailable: boolean;
  configurationUnavailable: boolean;
  services: {
    eventType: ScheduleEventType;
    label: string;
  }[];
  timeSlots: string[];
  capacity: {
    dailyLimit: number;
    slotCapacity: number;
  } | null;
  venueCapacity: number | null;
  horizonDays: number;
  configurationUpdatedAt: string | null;
}

export interface EligiblePriest {
  id: number;
  name: string;
  isAssistant: boolean;
}

export type RecommendationReason =
  | "PREFERRED_DATE"
  | "PREFERRED_PRIEST_AVAILABLE"
  | "PREFERRED_PRIEST_UNAVAILABLE"
  | "PREFERRED_TIME";

export interface ScheduleRecommendationItem {
  date: string;
  timeSlot: string;
  startAt: string;
  preferredPriestAvailable?: boolean;
  reasons: RecommendationReason[];
}

export interface ScheduleRecommendationsResponse {
  parishId: number;
  eventType: string;
  preferredDate: string;
  window: {
    from: string;
    to: string;
  };
  generatedAt: string;
  recommendations: ScheduleRecommendationItem[];
  code?: string;
}

export interface RecommendationRequestPayload {
  parishId: number;
  eventType: string;
  preferredDate: string;
  dateFrom?: string;
  dateTo?: string;
  preferredTimeSlot?: string;
  requestedPriestId?: number | null;
}

export interface CreateSchedulePayload {
  parishId: number;
  eventType: ScheduleEventType;
  date: string;
  timeSlot: string;
  remarks?: string;
  requestedPriestId?: number | null;
}

export interface RespondReschedulePayload {
  accept: boolean;
}

export const getScheduleEventLabel = (type?: string | null): string => {
  if (!type) return "Schedule";
  if (type in SCHEDULE_EVENT_LABELS) {
    return SCHEDULE_EVENT_LABELS[type as ScheduleEventType];
  }
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

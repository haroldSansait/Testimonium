import type { 
  Parish, 
  SacramentalRequest, 
  Appointment, 
  Announcement, 
  UserProfile, 
  AppNotification,
  Event,
  RequestAttachment
} from '../types';

export interface IAuthProvider {
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  logout(): Promise<void>;
}

export interface IProfileProvider {
  getProfile(uid: string): Promise<UserProfile | null>;
  updateProfile(uid: string, profile: Partial<UserProfile>): Promise<void>;
}

export interface IParishProvider {
  getParishes(): Promise<Parish[]>;
  getParishById(id: string): Promise<Parish | null>;
}

export interface IRequestProvider {
  createRequest(request: {
    parishId: string;
    documentType: SacramentalRequest['documentType'];
    applicantName?: string;
    applicantFirstName?: string;
    applicantMiddleName?: string;
    applicantLastName?: string;
    relationship: string;
    purpose: string;
  }): Promise<SacramentalRequest>;
  getRequestByTrackingNumber(trackingNumber: string): Promise<SacramentalRequest | null>;
  getRequests(): Promise<SacramentalRequest[]>;
  getRequestById(id: string): Promise<SacramentalRequest | null>;
  submitDraft(id: string): Promise<SacramentalRequest>;
  cancelRequest(id: string, remarks?: string): Promise<SacramentalRequest>;
  uploadFiles(id: string, files: File[], category?: string): Promise<RequestAttachment[]>;
  uploadReceipt(id: string, file: File): Promise<{ autoVerified: boolean; ocrResult: any; request?: SacramentalRequest }>;
  getDocumentRequirements(type: string, parishId?: string): Promise<any>;
  resubmitCorrections(id: string): Promise<SacramentalRequest>;
}

export interface EligiblePriest {
  id: number;
  name: string;
  isAssistant: boolean;
}

export type RecommendationReason =
  | 'PREFERRED_DATE'
  | 'PREFERRED_PRIEST_AVAILABLE'
  | 'PREFERRED_PRIEST_UNAVAILABLE'
  | 'PREFERRED_TIME';

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

export interface ISchedulerProvider {
  getAppointments(): Promise<Appointment[]>;
  getSchedulingConfiguration(parishId: string): Promise<SchedulingConfiguration>;
  getAvailabilityDates(parishId: string, eventType: string): Promise<AvailabilityDates>;
  getAvailableSlots(parishId: string, date: string, eventType: string): Promise<string[]>;
  getEligiblePriests(parishId: string): Promise<EligiblePriest[]>;
  getRecommendations(payload: RecommendationRequestPayload): Promise<ScheduleRecommendationsResponse>;
  bookAppointment(appointment: {
    parishId: string;
    eventType: string;
    displayTitle: string;
    date: string;
    timeSlot: string;
    location?: string;
    remarks?: string;
    requestedPriestId?: number | null;
  }): Promise<Appointment>;
  respondReschedule(id: string, accept: boolean, expectedVersion: number): Promise<Appointment>;
  getAppointmentById(id: string): Promise<Appointment>;
  getAppointmentByTracking(reference: string): Promise<Appointment>;
}

export interface SchedulingConfiguration {
  parishId: number;
  schedulingAvailable: boolean;
  configurationUnavailable: boolean;
  services: Array<{ eventType: string; label: string }>;
  timeSlots: string[];
  capacity: { dailyLimit: number; slotCapacity: number } | null;
  venueCapacity: number | null;
  horizonDays: number;
  configurationUpdatedAt: string | null;
}

export interface AvailabilityDates {
  eventType: string;
  serviceAvailable: boolean;
  dates: string[];
}

export interface INotificationProvider {
  getNotifications(): Promise<AppNotification[]>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
}

export interface IAnnouncementProvider {
  getAnnouncements(): Promise<Announcement[]>;
}

export interface ChatSource {
  id: number;
  title: string;
  sourceType: string;
  sourceReference?: string | null;
  authority: string;
  scope: string;
  parishId?: number | null;
}

export interface ChatResponse {
  answer: string;
  fallback: boolean;
  fallbackReason?: string | null;
  sessionId?: string;
  category?: string | null;
  sources: ChatSource[];
  responseType?: 'RAG' | 'FALLBACK' | 'SOCIAL' | 'CLARIFICATION';
  clarificationType?: 'PARISH' | null;
}

export interface IChatProvider {
  sendMessage(
    question: string,
    selectedParishId?: number | null,
    sessionId?: string
  ): Promise<ChatResponse>;
}

export interface IMapProvider {
  getParishCoordinates(parishId: string): Promise<{ lat: number; lng: number } | null>;
}

export interface IEventProvider {
  getEvents(): Promise<Event[]>;
  getFeaturedEvents(): Promise<Event[]>;
  getEventById(id: string): Promise<Event | null>;
}

export interface PaymentConfiguration {
  configured: boolean;
  qrCode: {
    enabled: boolean;
    imageUrl: string | null;
  };
  message?: string;
}

export interface IPaymentConfigurationProvider {
  getPaymentConfiguration(requestId: string): Promise<PaymentConfiguration>;
}

export interface IServiceProvider {
  auth: IAuthProvider;
  profile: IProfileProvider;
  parish: IParishProvider;
  request: IRequestProvider;
  scheduler: ISchedulerProvider;
  notification: INotificationProvider;
  announcement: IAnnouncementProvider;
  chat: IChatProvider;
  map: IMapProvider;
  event: IEventProvider;
  payment: IPaymentConfigurationProvider;
}

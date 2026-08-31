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
    applicantName: string;
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

export interface ISchedulerProvider {
  getAppointments(): Promise<Appointment[]>;
  getSchedulingConfiguration(parishId: string): Promise<SchedulingConfiguration>;
  getAvailabilityDates(parishId: string, eventType: string): Promise<AvailabilityDates>;
  getAvailableSlots(parishId: string, date: string, eventType: string): Promise<string[]>;
  bookAppointment(appointment: {
    parishId: string;
    eventType: string;
    displayTitle: string;
    date: string;
    timeSlot: string;
    location?: string;
  }): Promise<Appointment>;
  respondReschedule(id: string, accept: boolean): Promise<Appointment>;
  getAppointmentById(id: string): Promise<Appointment>;
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

export interface IChatProvider {
  sendMessage(message: string): Promise<string>;
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

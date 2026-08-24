import { resolveEventType } from "../shared/EventTypeCatalog.js";
import {
  CANONICAL_SCHEDULE_EVENT_TYPES,
  parseTimeSlotMinutes,
} from "./BookingValidator.js";

const asObject = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const asPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeTimeSlot = (value) => {
  if (typeof value !== "string" || parseTimeSlotMinutes(value) === null) return null;
  const [, hour, minute, period] = value.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  return `${String(Number(hour)).padStart(2, "0")}:${minute} ${period.toUpperCase()}`;
};

const resolveCanonicalService = (value) => {
  const resolved = resolveEventType(String(value || ""));
  return CANONICAL_SCHEDULE_EVENT_TYPES.includes(resolved) ? resolved : null;
};

const configurationError = (message = "Scheduling configuration is incomplete for this parish.") => {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = "SCHEDULING_CONFIGURATION_INCOMPLETE";
  return error;
};

/**
 * The only scheduling configuration resolver used by backend read and mutation
 * paths. It deliberately never invents services, time slots, or capacities.
 */
export const getParishSchedulingConfiguration = (parish) => {
  const settings = asObject(parish?.eventSettings);
  const issues = [];

  if (!settings) {
    return {
      isConfigured: false,
      issues: ["Event settings are missing or invalid."],
      enabledServices: [],
      timeSlots: [],
      dailyCapacity: null,
      slotCapacity: null,
      venueCapacity: asPositiveInt(parish?.venueCapacity),
      officeHours: asObject(parish?.officeHours),
    };
  }

  const enabledRaw = settings.availableEvents;
  const slotsRaw = settings.timeSlots;
  const capacity = asObject(settings.capacitySettings);

  if (!Array.isArray(enabledRaw)) issues.push("Enabled services are not configured.");
  if (!Array.isArray(slotsRaw)) issues.push("Time slots are not configured.");
  if (!capacity) issues.push("Capacity settings are not configured.");

  const invalidServices = Array.isArray(enabledRaw)
    ? enabledRaw.filter((value) => !resolveCanonicalService(value))
    : [];
  const invalidSlots = Array.isArray(slotsRaw)
    ? slotsRaw.filter((value) => !normalizeTimeSlot(value))
    : [];
  if (invalidServices.length) issues.push("Enabled services contain an unsupported event type.");
  if (invalidSlots.length) issues.push("Time slots contain an invalid time.");

  const dailyCapacity = asPositiveInt(capacity?.dailyLimit);
  const slotCapacity = asPositiveInt(capacity?.slotCapacity);
  if (!dailyCapacity) issues.push("Daily booking capacity must be a positive whole number.");
  if (!slotCapacity) issues.push("Per-slot booking capacity must be a positive whole number.");

  return {
    isConfigured: issues.length === 0,
    issues,
    enabledServices: Array.isArray(enabledRaw)
      ? [...new Set(enabledRaw.map(resolveCanonicalService).filter(Boolean))]
      : [],
    timeSlots: Array.isArray(slotsRaw)
      ? [...new Set(slotsRaw.map(normalizeTimeSlot).filter(Boolean))]
      : [],
    dailyCapacity,
    slotCapacity,
    // Venue capacity is display-only until the product defines attendee-count
    // input and enforcement semantics.
    venueCapacity: asPositiveInt(parish?.venueCapacity),
    officeHours: asObject(parish?.officeHours),
  };
};

/** Reject malformed Admin saves instead of letting clients discover bad config. */
export const validateSchedulingSettingsForSave = (eventSettings) => {
  const settings = asObject(eventSettings);
  if (!settings) throw configurationError("Event settings must be a valid object.");

  if (!Array.isArray(settings.availableEvents)) {
    throw configurationError("Enabled scheduling services must be provided as a list.");
  }
  if (!Array.isArray(settings.timeSlots)) {
    throw configurationError("Scheduling time slots must be provided as a list.");
  }

  const services = settings.availableEvents.map(resolveCanonicalService);
  if (services.some((value) => !value)) {
    throw configurationError("Enabled scheduling services contain an unsupported event type.");
  }
  const timeSlots = settings.timeSlots.map(normalizeTimeSlot);
  if (timeSlots.some((value) => !value)) {
    throw configurationError("Scheduling time slots contain an invalid time.");
  }

  const capacity = asObject(settings.capacitySettings);
  const dailyLimit = asPositiveInt(capacity?.dailyLimit);
  const slotCapacity = asPositiveInt(capacity?.slotCapacity);
  if (!dailyLimit || !slotCapacity) {
    throw configurationError("Daily and per-slot capacities must be positive whole numbers.");
  }

  return {
    ...settings,
    availableEvents: [...new Set(services)],
    timeSlots: [...new Set(timeSlots)],
    capacitySettings: { ...capacity, dailyLimit, slotCapacity },
  };
};

export const requireSchedulingConfiguration = (parish) => {
  const config = getParishSchedulingConfiguration(parish);
  if (!config.isConfigured) throw configurationError();
  return config;
};

export const requireEnabledSchedulingService = (parish, eventType) => {
  const config = requireSchedulingConfiguration(parish);
  if (!config.enabledServices.includes(eventType)) {
    const error = new Error("This scheduling service is not currently offered by the selected parish.");
    error.statusCode = 400;
    error.code = "SERVICE_NOT_OFFERED";
    throw error;
  }
  return config;
};

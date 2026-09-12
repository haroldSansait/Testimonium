/**
 * Canonical Tool Definitions and Parameter Schemas for Caloy Safe Live Tools
 */

export const TOOL_IDS = {
  GET_ACTIVE_PARISHES: "GET_ACTIVE_PARISHES",
  GET_ACTIVE_PARISH_PRIESTS: "GET_ACTIVE_PARISH_PRIESTS",
  GET_PARISH_DOCUMENTS: "GET_PARISH_DOCUMENTS",
  GET_PARISH_SCHEDULABLE_EVENTS: "GET_PARISH_SCHEDULABLE_EVENTS",
  GET_DOCUMENT_REQUIREMENTS: "GET_DOCUMENT_REQUIREMENTS",
  GET_DOCUMENT_FEE: "GET_DOCUMENT_FEE",
  GET_PARISH_OFFICE_INFO: "GET_PARISH_OFFICE_INFO",
  GET_CALENDAR_SLOT_AVAILABILITY: "GET_CALENDAR_SLOT_AVAILABILITY",
  GET_AVAILABLE_DATES: "GET_AVAILABLE_DATES",
  CHECK_PRIEST_AVAILABILITY: "CHECK_PRIEST_AVAILABILITY",
  GET_AVAILABLE_PRIESTS_FOR_SLOT: "GET_AVAILABLE_PRIESTS_FOR_SLOT",
  GET_PARISH_EVENTS_FOR_DATE: "GET_PARISH_EVENTS_FOR_DATE",
  CHECK_MY_REQUEST_STATUS: "CHECK_MY_REQUEST_STATUS",
  CHECK_MY_PAYMENT_STATUS: "CHECK_MY_PAYMENT_STATUS",
  GET_MY_UPCOMING_SCHEDULES: "GET_MY_UPCOMING_SCHEDULES",
  GET_VICARIATE_DIRECTORY: "GET_VICARIATE_DIRECTORY",
};

export const TOOL_DEFINITIONS = {
  [TOOL_IDS.GET_VICARIATE_DIRECTORY]: {
    id: TOOL_IDS.GET_VICARIATE_DIRECTORY,
    name: "Get Vicariate Directory",
    classification: "PUBLIC_DIRECTORY",
    description: "Returns active parishes, quasi-parishes, and mission stations belonging to a specific Vicariate, including counts by organizational type.",
    requiredParameters: [],
    optionalParameters: ["vicariateName"],
  },

  [TOOL_IDS.GET_ACTIVE_PARISHES]: {
    id: TOOL_IDS.GET_ACTIVE_PARISHES,
    name: "Get Active Parishes",
    classification: "PUBLIC_DIRECTORY",
    description: "Returns the active member parishes, quasi-parishes, and mission stations in the TESTIMONIUM directory.",
    requiredParameters: [],
    optionalParameters: [],
  },

  [TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS]: {
    id: TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS,
    name: "Get Active Parish Priests",
    classification: "PUBLIC_PARISH",
    description: "Returns currently active, assigned priests for a specific parish directory.",
    requiredParameters: ["parishId"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
    },
  },

  [TOOL_IDS.GET_PARISH_DOCUMENTS]: {
    id: TOOL_IDS.GET_PARISH_DOCUMENTS,
    name: "Get Parish Available Documents",
    classification: "PUBLIC_PARISH",
    description: "Returns the sacramental document types currently offered by a specific parish.",
    requiredParameters: ["parishId"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
    },
  },

  [TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS]: {
    id: TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS,
    name: "Get Parish Schedulable Events",
    classification: "PUBLIC_PARISH",
    description: "Returns the sacramental event types and services currently enabled for appointment scheduling at a specific parish.",
    requiredParameters: ["parishId"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
    },
  },

  [TOOL_IDS.GET_DOCUMENT_REQUIREMENTS]: {
    id: TOOL_IDS.GET_DOCUMENT_REQUIREMENTS,
    name: "Get Parish Document Requirements",
    classification: "PUBLIC_PARISH",
    description: "Returns requirements and required documents for a document type at a specific parish.",
    requiredParameters: ["documentType"],
    optionalParameters: ["parishId"],
    clarificationTypeIfMissing: {
      documentType: "DOCUMENT_TYPE",
    },
  },

  [TOOL_IDS.GET_DOCUMENT_FEE]: {
    id: TOOL_IDS.GET_DOCUMENT_FEE,
    name: "Get Parish Document Fee",
    classification: "PUBLIC_PARISH",
    description: "Returns the current fee/price for a sacramental document at a specific parish.",
    requiredParameters: ["documentType", "parishId"],
    clarificationTypeIfMissing: {
      documentType: "DOCUMENT_TYPE",
      parishId: "PARISH",
    },
  },

  [TOOL_IDS.GET_PARISH_OFFICE_INFO]: {
    id: TOOL_IDS.GET_PARISH_OFFICE_INFO,
    name: "Get Parish Office Information",
    classification: "PUBLIC_PARISH",
    description: "Returns office hours, contact numbers, email, and address for a specific parish.",
    requiredParameters: ["parishId"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
    },
  },

  [TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY]: {
    id: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
    name: "Get Calendar Slot Availability",
    classification: "PUBLIC_PARISH",
    description: "Returns public slot availability for a sacramental event type and date at a parish, or checks specific time availability.",
    requiredParameters: ["parishId", "eventType", "date"],
    optionalParameters: ["timeSlot"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
      eventType: "SCHEDULE_EVENT",
      date: "DATE",
    },
  },

  [TOOL_IDS.GET_AVAILABLE_DATES]: {
    id: TOOL_IDS.GET_AVAILABLE_DATES,
    name: "Get Available Dates",
    classification: "PUBLIC_PARISH",
    description: "Searches a bounded upcoming date range for dates with at least one live canonical scheduling slot.",
    requiredParameters: ["parishId", "eventType"],
    optionalParameters: ["startDate", "rangeDays"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
      eventType: "SCHEDULE_EVENT",
    },
  },

  [TOOL_IDS.CHECK_PRIEST_AVAILABILITY]: {
    id: TOOL_IDS.CHECK_PRIEST_AVAILABILITY,
    name: "Check Priest Availability",
    classification: "PUBLIC_PARISH",
    description: "Checks whether a specific priest is available on a date, optional time slot, and event type at a parish.",
    requiredParameters: ["parishId", "priestName", "date"],
    optionalParameters: ["timeSlot", "eventType"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
      date: "DATE",
    },
  },

  [TOOL_IDS.GET_AVAILABLE_PRIESTS_FOR_SLOT]: {
    id: TOOL_IDS.GET_AVAILABLE_PRIESTS_FOR_SLOT,
    name: "Get Available Priests For Slot",
    classification: "PUBLIC_PARISH",
    description: "Returns active clergy available for a specific date and time slot at a parish.",
    requiredParameters: ["parishId", "date"],
    optionalParameters: ["timeSlot", "eventType"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
      date: "DATE",
    },
  },

  [TOOL_IDS.GET_PARISH_EVENTS_FOR_DATE]: {
    id: TOOL_IDS.GET_PARISH_EVENTS_FOR_DATE,
    name: "Get Parish Events For Date",
    classification: "PUBLIC_PARISH",
    description: "Returns public calendar activities and Mass schedules for a parish on a specific date.",
    requiredParameters: ["parishId", "date"],
    optionalParameters: [],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
      date: "DATE",
    },
  },

  [TOOL_IDS.CHECK_MY_REQUEST_STATUS]: {
    id: TOOL_IDS.CHECK_MY_REQUEST_STATUS,
    name: "Check My Document Request Status",
    classification: "AUTHENTICATED_PRIVATE",
    description: "Returns status and public remarks for requests owned by the authenticated user.",
    requiredParameters: ["userId"],
    optionalParameters: ["trackingNumber", "requestId"],
  },

  [TOOL_IDS.CHECK_MY_PAYMENT_STATUS]: {
    id: TOOL_IDS.CHECK_MY_PAYMENT_STATUS,
    name: "Check My Payment Verification Status",
    classification: "AUTHENTICATED_PRIVATE",
    description: "Returns payment verification state for requests owned by the authenticated user.",
    requiredParameters: ["userId"],
    optionalParameters: ["trackingNumber", "requestId"],
  },

  [TOOL_IDS.GET_MY_UPCOMING_SCHEDULES]: {
    id: TOOL_IDS.GET_MY_UPCOMING_SCHEDULES,
    name: "Get My Upcoming Schedules",
    classification: "AUTHENTICATED_PRIVATE",
    description: "Returns upcoming sacramental appointments owned by the authenticated user.",
    requiredParameters: ["userId"],
    optionalParameters: [],
  },
};

/**
 * Canonical Tool Definitions and Parameter Schemas for Caloy Safe Live Tools
 */

export const TOOL_IDS = {
  GET_ACTIVE_PARISH_PRIESTS: "GET_ACTIVE_PARISH_PRIESTS",
  GET_PARISH_DOCUMENTS: "GET_PARISH_DOCUMENTS",
  GET_DOCUMENT_REQUIREMENTS: "GET_DOCUMENT_REQUIREMENTS",
  GET_DOCUMENT_FEE: "GET_DOCUMENT_FEE",
  GET_PARISH_OFFICE_INFO: "GET_PARISH_OFFICE_INFO",
  GET_CALENDAR_SLOT_AVAILABILITY: "GET_CALENDAR_SLOT_AVAILABILITY",
  CHECK_MY_REQUEST_STATUS: "CHECK_MY_REQUEST_STATUS",
  CHECK_MY_PAYMENT_STATUS: "CHECK_MY_PAYMENT_STATUS",
  GET_MY_UPCOMING_SCHEDULES: "GET_MY_UPCOMING_SCHEDULES",
};

export const TOOL_DEFINITIONS = {
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
    description: "Returns public slot availability for a sacramental event type and date at a parish.",
    requiredParameters: ["parishId", "eventType", "date"],
    clarificationTypeIfMissing: {
      parishId: "PARISH",
      eventType: "SCHEDULE_EVENT",
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

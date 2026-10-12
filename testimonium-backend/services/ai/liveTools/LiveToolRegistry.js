import { prisma } from "../../../config/db.js";
import { TOOL_IDS } from "./liveToolSchemas.js";
import {
  humanizeDocumentType,
  humanizeDocumentStatus,
  humanizePaymentStatus,
  humanizeVerificationStatus,
  humanizeEventType,
  humanizeScheduleStatus,
  humanizeParishType,
  formatClergyName,
} from "./enumFormatters.js";
import { getEffectiveOfferedDocuments } from "../../../config/documents.js";
import { getParishSchedulingConfiguration } from "../../SchedulingConfiguration.js";
import { DocumentRequirementService } from "../../DocumentRequirementService.js";
import {
  getEligiblePriestsForParish,
  validateRequestedPriestEligibility,
  loadPriestConflictSnapshot,
} from "../../ScheduleAvailabilityDomainService.js";
import { ScheduleService } from "../../ScheduleService.js";
import { ParishionerRequestRepository } from "../../../repositories/ParishionerRequestRepository.js";
import {
  getManilaDateString,
  parseStrictManilaDateOnly,
  parseManilaDateOnly,
  parseManilaDateTime,
  computeOperationalEndDatetime,
  evaluatePriestConflictFromSnapshot,
} from "../../ConflictHelper.js";
import { normalizeTimeSlotString } from "../../BookingValidator.js";
import { ParishEventService } from "../../ParishEventService.js";
import { resolveMassDisplayLabel } from "../../../shared/LayMinisterPresentation.js";

export class LiveToolRegistry {
  constructor({
    prismaClient = prisma,
    scheduleService = new ScheduleService(),
    requestRepository = new ParishionerRequestRepository(),
  } = {}) {
    this.prisma = prismaClient;
    this.scheduleService = scheduleService;
    this.requestRepository = requestRepository;
  }

  async getClassifiedSlotAvailability(parishId, date, eventType) {
    if (typeof this.scheduleService.getAvailableSlotsDetailed === "function") {
      return this.scheduleService.getAvailableSlotsDetailed(parishId, date, eventType);
    }

    const slots = await this.scheduleService.getAvailableSlots(parishId, date, eventType);
    return {
      parishId: Number(parishId),
      eventType,
      date,
      serviceAvailable: true,
      reasonCode: Array.isArray(slots) && slots.length ? null : "NO_AVAILABLE_SLOTS",
      candidateSlots: Array.isArray(slots) ? [...slots] : [],
      slots: Array.isArray(slots) ? slots : [],
      exclusionCounts: null,
    };
  }

  formatAvailabilityReason(reasonCode, { parishName, eventType, date }) {
    const eventName = humanizeEventType(eventType);
    switch (reasonCode) {
      case "EVENT_NOT_OFFERED":
        return `**${parishName}** does not currently offer **${eventName}** scheduling. Please choose one of the services enabled by the parish or contact the parish office.`;
      case "SCHEDULING_CONFIGURATION_INCOMPLETE":
      case "NO_SCHEDULING_WINDOW":
        return `**${parishName}** does not currently have valid **${eventName}** scheduling slots configured for **${date}**.`;
      case "PARISH_CLOSED":
        return `**${parishName}** is closed for scheduling on **${date}**.`;
      case "DATE_NOT_ALLOWED":
        return `**${eventName}** scheduling is not offered by **${parishName}** on **${date}**.`;
      case "NO_ELIGIBLE_SLOTS":
        return `None of the configured **${eventName}** slot starts fall within the valid scheduling window at **${parishName}** on **${date}**.`;
      case "FULLY_BOOKED":
        return `All configured **${eventName}** slots at **${parishName}** on **${date}** have reached capacity.`;
      default:
        return `There are no available slots for **${eventName}** at **${parishName}** on **${date}**.`;
    }
  }

  /**
   * Safe helper to format parish contact snippet
   */
  formatParishContact(parish) {
    if (!parish) return "";
    const parts = [];
    if (parish.contactNumber) parts.push(`📞 Phone: ${parish.contactNumber}`);
    if (parish.email) parts.push(`✉️ Email: ${parish.email}`);
    if (parish.address) parts.push(`📍 Address: ${parish.address}`);
    return parts.length > 0 ? parts.join("\n") : "";
  }

  /**
   * Tool 1: GET_ACTIVE_PARISH_PRIESTS
   */
  async getActiveParishPriests({ parishId }) {
    const pId = Number(parishId);
    if (!pId || !Number.isInteger(pId) || pId <= 0) {
      throw new Error("A valid parish ID is required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: { id: true, parishName: true, isActive: true, contactNumber: true, email: true },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const priests = await getEligiblePriestsForParish(pId, null, this.prisma);

    if (!priests || priests.length === 0) {
      return {
        answer: `There are currently no active priests listed for **${parish.parishName}** in the TESTIMONIUM directory. Please contact the parish office for clergy assignments.\n\n${this.formatParishContact(parish)}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const priestLines = priests.map((p) => {
      const roleSuffix = p.isAssistant ? " *(Parochial Vicar / Assistant Priest)*" : " *(Parish Priest)*";
      const displayName = formatClergyName(p.name);
      return `- **${displayName}**${roleSuffix}`;
    });

    const answer = `The currently listed active priests for **${parish.parishName}** are:\n\n${priestLines.join("\n")}\n\n*This information comes directly from the current TESTIMONIUM parish directory.*`;

    const structuredFacts = {
      parishName: parish.parishName,
      priests: priests.map((p) => ({
        name: formatClergyName(p.name),
        isAssistant: Boolean(p.isAssistant),
      })),
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
    };
  }

  /**
   * Tool 2: GET_PARISH_DOCUMENTS
   */
  async getParishDocuments({ parishId }) {
    const pId = Number(parishId);
    if (!pId || !Number.isInteger(pId) || pId <= 0) {
      throw new Error("A valid parish ID is required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: { id: true, parishName: true, isActive: true, availableDocuments: true, contactNumber: true, email: true },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const offeredTypes = getEffectiveOfferedDocuments(parish.availableDocuments);

    if (!offeredTypes || offeredTypes.length === 0) {
      return {
        answer: `Currently, **${parish.parishName}** does not offer any sacramental documents for online requests in TESTIMONIUM. Please contact their parish office directly.\n\n${this.formatParishContact(parish)}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const docLines = offeredTypes.map((type) => `- **${humanizeDocumentType(type)}**`);

    const answer = `**${parish.parishName}** currently accepts requests for the following sacramental documents:\n\n${docLines.join("\n")}\n\nYou can start a request anytime from the Sacramental Documents section.`;

    const structuredFacts = {
      parishName: parish.parishName,
      documents: offeredTypes.map((t) => humanizeDocumentType(t)),
      documentTypes: offeredTypes,
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
    };
  }

  /**
   * Tool: GET_PARISH_SCHEDULABLE_EVENTS
   */
  async getParishSchedulableEvents({ parishId }) {
    const pId = Number(parishId);
    if (!pId || !Number.isInteger(pId) || pId <= 0) {
      throw new Error("A valid parish ID is required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: {
        id: true,
        parishName: true,
        isActive: true,
        eventSettings: true,
        contactNumber: true,
        email: true,
        address: true,
      },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const config = getParishSchedulingConfiguration(parish);
    const enabledEvents = Array.isArray(config?.enabledServices) ? config.enabledServices : [];

    if (!config.isConfigured || enabledEvents.length === 0) {
      const answer = `Currently, **${parish.parishName}** does not have any sacramental events configured for appointment scheduling in TESTIMONIUM. Please contact the parish office directly.\n\n${this.formatParishContact(parish)}`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          schedulableEvents: [],
          eventTypes: [],
          isConfigured: Boolean(config?.isConfigured),
        },
        liveData: {
          label: "Current TESTIMONIUM Data",
          asOf: new Date().toISOString(),
          parishId: pId,
          eventTypes: [],
          totalEvents: 0,
        },
      };
    }

    const eventLines = enabledEvents.map((type) => `- **${humanizeEventType(type)}**`);
    const answer = `**${parish.parishName}** currently offers appointment scheduling for the following events and services:\n\n${eventLines.join("\n")}\n\nYou can check availability or book a schedule through the Sacramental Scheduling module.`;

    const structuredFacts = {
      parishName: parish.parishName,
      schedulableEvents: enabledEvents.map((t) => humanizeEventType(t)),
      eventTypes: enabledEvents,
      isConfigured: true,
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: {
        label: "Current TESTIMONIUM Data",
        asOf: new Date().toISOString(),
        parishId: pId,
        eventTypes: enabledEvents,
        totalEvents: enabledEvents.length,
      },
    };
  }

  /**
   * Tool 3: GET_DOCUMENT_REQUIREMENTS
   */
  async getDocumentRequirements({ documentType, parishId }) {
    if (!documentType) {
      throw new Error("Document type is required.");
    }

    const pId = parishId ? Number(parishId) : null;
    let parish = null;
    if (pId) {
      parish = await this.prisma.parish.findUnique({
        where: { id: pId },
        select: { id: true, parishName: true, isActive: true, availableDocuments: true, contactNumber: true, email: true },
      });
    }

    if (parish && !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const docTitle = humanizeDocumentType(documentType);

    // State A: DOCUMENT_NOT_OFFERED
    if (parish) {
      const offeredTypes = getEffectiveOfferedDocuments(parish.availableDocuments);
      if (!offeredTypes.includes(documentType)) {
        const contactStr = this.formatParishContact(parish);
        const answer = `**${parish.parishName}** does not currently offer **${docTitle}** for online requests in TESTIMONIUM. Please contact their parish office directly.${contactStr ? `\n\n${contactStr}` : ""}`;
        return {
          answer,
          fallbackAnswer: answer,
          structuredFacts: {
            parishName: parish.parishName,
            documentType,
            documentTitle: docTitle,
            isOffered: false,
            requirements: [],
          },
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, state: "DOCUMENT_NOT_OFFERED" },
        };
      }
    }

    const config = await DocumentRequirementService.getRequirements(documentType, pId, this.prisma);
    const parishHeader = parish ? ` at **${parish.parishName}**` : "";

    const reqDocs = config.requiredDocuments || [];
    const primaryDocs = reqDocs.filter((d) => d.category === "primary");
    const supportingDocs = reqDocs.filter((d) => d.category === "supporting");

    // State B: DOCUMENT_OFFERED_BUT_NO_REQUIREMENTS_CONFIGURED
    if (primaryDocs.length === 0 && supportingDocs.length === 0) {
      const contactStr = parish ? this.formatParishContact(parish) : "";
      const answer = `**${docTitle}**${parishHeader} currently does not have any specific upload requirements configured in TESTIMONIUM. Please contact the parish office for further instructions.${contactStr ? `\n\n${contactStr}` : ""}`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish ? parish.parishName : null,
          documentType,
          documentTitle: docTitle,
          isOffered: true,
          requirements: [],
          hasRequirementsConfigured: false,
        },
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, state: "DOCUMENT_OFFERED_BUT_NO_REQUIREMENTS_CONFIGURED" },
      };
    }

    // State D: DOCUMENT_OFFERED_WITH_DATA
    let requirementsText = "";
    if (primaryDocs.length > 0) {
      requirementsText += `**Primary Requirements:**\n` + primaryDocs.map((d) => `- **${d.label}**${d.description ? `: ${d.description}` : ""}`).join("\n") + "\n\n";
    }
    if (supportingDocs.length > 0) {
      requirementsText += `**Supporting Documents:**\n` + supportingDocs.map((d) => `- **${d.label}**${d.description ? `: ${d.description}` : ""}`).join("\n") + "\n\n";
    }

    const feeText = config.baseFee !== undefined && config.baseFee !== null ? `\n- **Standard Fee:** ₱${Number(config.baseFee).toFixed(2)}` : "";
    const processingText = config.estimatedProcessingDays ? `\n- **Estimated Processing Time:** ~${config.estimatedProcessingDays} business days` : "";

    const answer = `Here are the current requirements for a **${docTitle}**${parishHeader}:\n\n${requirementsText}**Additional Details:**${feeText}${processingText}\n\n*Note: An Authorization Letter and valid ID of the representative are strictly required if requesting on behalf of someone else.*`;

    const structuredFacts = {
      parishName: parish ? parish.parishName : null,
      documentType,
      documentTitle: docTitle,
      isOffered: true,
      hasRequirementsConfigured: true,
      primaryRequirements: primaryDocs.map((d) => d.label),
      supportingRequirements: supportingDocs.map((d) => d.label),
      requirements: reqDocs.map((d) => ({
        label: d.label,
        description: d.description || null,
        category: d.category,
      })),
      fee: config.baseFee !== undefined && config.baseFee !== null ? `₱${Number(config.baseFee).toFixed(2)}` : null,
      estimatedProcessingDays: config.estimatedProcessingDays || null,
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, state: "DOCUMENT_OFFERED_WITH_DATA" },
    };
  }

  /**
   * Tool 4: GET_DOCUMENT_FEE
   */
  async getDocumentFee({ documentType, parishId }) {
    const pId = Number(parishId);
    if (!pId || !Number.isInteger(pId) || pId <= 0) {
      throw new Error("A valid parish ID is required for fee inquiries.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: { id: true, parishName: true, isActive: true, contactNumber: true, email: true, documentSettings: true, availableDocuments: true },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const docName = humanizeDocumentType(documentType);
    const contactStr = this.formatParishContact(parish);

    // State A: DOCUMENT_NOT_OFFERED
    const offeredTypes = getEffectiveOfferedDocuments(parish.availableDocuments);
    if (!offeredTypes.includes(documentType)) {
      const answer = `**${parish.parishName}** does not currently offer **${docName}** for online requests in TESTIMONIUM. Please contact their parish office directly.${contactStr ? `\n\n${contactStr}` : ""}`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          documentType,
          documentTitle: docName,
          isOffered: false,
          fee: null,
        },
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, state: "DOCUMENT_NOT_OFFERED" },
      };
    }

    const config = await DocumentRequirementService.getRequirements(documentType, pId, this.prisma);

    // State C: DOCUMENT_OFFERED_BUT_NO_FEE_CONFIGURED
    if (config.baseFee === undefined || config.baseFee === null || isNaN(Number(config.baseFee))) {
      const answer = `I don't have a current **${docName}** fee recorded for **${parish.parishName}** in TESTIMONIUM. Please contact the parish office to confirm the current fee.${contactStr ? `\n\n${contactStr}` : ""}`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          documentType,
          documentTitle: docName,
          isOffered: true,
          hasFeeConfigured: false,
          fee: null,
        },
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, state: "DOCUMENT_OFFERED_BUT_NO_FEE_CONFIGURED" },
      };
    }

    // State D: DOCUMENT_OFFERED_WITH_DATA
    const feeAmount = Number(config.baseFee).toFixed(2);
    const processingDays = config.estimatedProcessingDays || 3;

    const answer = `The current fee for a **${docName}** at **${parish.parishName}** is **₱${feeAmount}**.\n\n*Estimated processing time is approximately ${processingDays} business days.* Payments can be settled via uploaded GCash proof or official cash payment upon pickup.`;

    const structuredFacts = {
      parishName: parish.parishName,
      documentType,
      documentTitle: docName,
      isOffered: true,
      hasFeeConfigured: true,
      fee: `₱${feeAmount}`,
      feeAmount: Number(feeAmount),
      isFree: Number(feeAmount) === 0,
      estimatedProcessingDays: processingDays,
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, state: "DOCUMENT_OFFERED_WITH_DATA" },
    };
  }

  /**
   * Tool 5: GET_PARISH_OFFICE_INFO
   */
  async getParishOfficeInfo({ parishId }) {
    const pId = Number(parishId);
    if (!pId || !Number.isInteger(pId) || pId <= 0) {
      throw new Error("A valid parish ID is required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: {
        id: true,
        parishName: true,
        patronSaint: true,
        address: true,
        municipalityCity: true,
        province: true,
        contactNumber: true,
        email: true,
        officeHours: true,
        isActive: true,
      },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    let hoursText = "Not specified in directory";
    if (parish.officeHours) {
      if (typeof parish.officeHours === "string") {
        try {
          const parsed = JSON.parse(parish.officeHours);
          if (typeof parsed === "object" && parsed !== null) {
            const lines = [];
            for (const [day, val] of Object.entries(parsed)) {
              if (val) {
                if (typeof val === "string") lines.push(`- **${day}**: ${val}`);
                else if (val.open && val.close) lines.push(`- **${day}**: ${val.open} - ${val.close}`);
                else if (val.isClosed) lines.push(`- **${day}**: Closed`);
              }
            }
            if (lines.length > 0) hoursText = "\n" + lines.join("\n");
            else hoursText = parish.officeHours;
          } else {
            hoursText = parish.officeHours;
          }
        } catch {
          hoursText = parish.officeHours;
        }
      }
    }

    const locationText = [parish.address, parish.municipalityCity, parish.province].filter(Boolean).join(", ") || "Diocese of Antique";

    const answer = `Here is the current office information for **${parish.parishName}**:\n\n- **Patron Saint:** ${parish.patronSaint || "N/A"}\n- **Address:** ${locationText}\n- **Office Hours:** ${hoursText}\n- **Contact Number:** ${parish.contactNumber || "Not listed"}\n- **Email:** ${parish.email || "Not listed"}`;

    const structuredFacts = {
      parishName: parish.parishName,
      patronSaint: parish.patronSaint || null,
      address: locationText,
      contactNumber: parish.contactNumber || null,
      email: parish.email || null,
      officeHours: hoursText,
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
    };
  }

  /**
   * Tool 6: GET_CALENDAR_SLOT_AVAILABILITY
   */
  async getCalendarSlotAvailability({ parishId, eventType, date, timeSlot = null }) {
    const pId = Number(parishId);
    if (!pId || !eventType || !date) {
      throw new Error("parishId, eventType, and date are required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: { id: true, parishName: true, isActive: true, contactNumber: true, email: true },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    let availability;
    try {
      availability = await this.getClassifiedSlotAvailability(pId, date, eventType);
    } catch (err) {
      return {
        answer: `I could not check availability for **${humanizeEventType(eventType)}** on **${date}** at **${parish.parishName}**: ${err.message}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    // slots from ScheduleService.getAvailableSlots is an array of strings like ["08:00 AM", "09:30 AM"]
    const availableSlots = Array.isArray(availability?.slots)
      ? availability.slots
          .map((s) => (typeof s === "string" ? s : s.timeSlot || (s.available ? s.slot : null)))
          .filter(Boolean)
      : [];

    if (!availability?.serviceAvailable || availability?.reasonCode === "EVENT_NOT_OFFERED") {
      const answer = `${this.formatAvailabilityReason(availability?.reasonCode, { parishName: parish.parishName, eventType, date })}\n\n${this.formatParishContact(parish)}`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          eventType,
          humanEventType: humanizeEventType(eventType),
          date,
          isAvailable: false,
          isOffered: false,
          reasonCode: availability?.reasonCode || "EVENT_NOT_OFFERED",
          safeReason: availability?.reasonCode || "EVENT_NOT_OFFERED",
          availableSlots: [],
        },
        liveData: {
          label: "Current TESTIMONIUM Data",
          asOf: new Date().toISOString(),
          parishId: pId,
          reasonCode: availability?.reasonCode,
          candidateCount: availability?.candidateSlots?.length || 0,
          totalAvailable: 0,
          slots: [],
        },
      };
    }

    // Specific time check
    if (timeSlot) {
      const targetNorm = normalizeTimeSlotString(timeSlot);
      const isSlotAvailable = availableSlots.some((s) => normalizeTimeSlotString(s) === targetNorm);

      if (isSlotAvailable) {
        const answer = `✅ **${timeSlot}** is currently **available** for **${humanizeEventType(eventType)}** at **${parish.parishName}** on **${date}**.\n\nYou can book this appointment slot anytime through the Sacramental Scheduling module.`;
        return {
          answer,
          fallbackAnswer: answer,
          structuredFacts: {
            parishName: parish.parishName,
            eventType,
            humanEventType: humanizeEventType(eventType),
            date,
            requestedTimeSlot: timeSlot,
            isAvailable: true,
            availableSlots,
          },
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, isAvailable: true, timeSlot, reasonCode: null },
        };
      } else {
        const altLines = availableSlots.length > 0
          ? availableSlots.map((s) => `- ⏰ **${s}**`).join("\n")
          : "There are no alternative slots open on this date.";

        const answer = `**${timeSlot}** is currently **unavailable** for **${humanizeEventType(eventType)}** at **${parish.parishName}** on **${date}**.\n\n` +
          (availableSlots.length > 0 ? `Available alternative times on this date include:\n\n${altLines}\n\n` : `${altLines}\n\n`) +
          this.formatParishContact(parish);

        return {
          answer,
          fallbackAnswer: answer,
          structuredFacts: {
            parishName: parish.parishName,
            eventType,
            humanEventType: humanizeEventType(eventType),
            date,
            requestedTimeSlot: timeSlot,
            isAvailable: false,
            availableSlots,
          },
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, isAvailable: false, timeSlot, reasonCode: availability?.reasonCode || "SLOT_UNAVAILABLE" },
        };
      }
    }

    if (availableSlots.length === 0) {
      const answer = `${this.formatAvailabilityReason(availability?.reasonCode, { parishName: parish.parishName, eventType, date })}\n\nPlease check another date or contact the parish office for special arrangements.\n\n${this.formatParishContact(parish)}`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          eventType,
          humanEventType: humanizeEventType(eventType),
          date,
          isAvailable: false,
          isOffered: true,
          reasonCode: availability?.reasonCode || "NO_AVAILABLE_SLOTS",
          safeReason: availability?.reasonCode || "NO_AVAILABLE_SLOTS",
          availableSlots: [],
        },
        liveData: {
          label: "Current TESTIMONIUM Data",
          asOf: new Date().toISOString(),
          parishId: pId,
          reasonCode: availability?.reasonCode || "NO_AVAILABLE_SLOTS",
          candidateCount: availability?.candidateSlots?.length || 0,
          totalAvailable: 0,
          slots: [],
        },
      };
    }

    const slotLines = availableSlots.map((s) => `- ⏰ **${s}**`);

    const answer = `Here are the available appointment slots for **${humanizeEventType(eventType)}** at **${parish.parishName}** on **${date}**:\n\n${slotLines.join("\n")}\n\nYou can book any of these slots through the Sacramental Scheduling module.`;

    const structuredFacts = {
      parishName: parish.parishName,
      eventType,
      humanEventType: humanizeEventType(eventType),
      date,
      isAvailable: true,
      availableSlots,
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: {
        label: "Current TESTIMONIUM Data",
        asOf: new Date().toISOString(),
        parishId: pId,
        slots: availableSlots,
        totalAvailable: availableSlots.length,
        candidateCount: availability?.candidateSlots?.length || availableSlots.length,
        reasonCode: null,
      },
    };
  }

  /**
   * Tool 6B: GET_AVAILABLE_DATES
   */
  async getAvailableDates({ parishId, eventType, startDate = null, rangeDays = null }) {
    const pId = Number(parishId);
    if (!pId || !eventType) {
      throw new Error("parishId and eventType are required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: { id: true, parishName: true, isActive: true, contactNumber: true, email: true },
    });
    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, dates: [] },
      };
    }

    if (typeof this.scheduleService.getAvailableDatesInRange !== "function") {
      throw new Error("The canonical range availability service is unavailable.");
    }

    const result = await this.scheduleService.getAvailableDatesInRange(
      pId,
      eventType,
      startDate,
      rangeDays || 14
    );

    if (!result.serviceAvailable || result.reasonCode === "EVENT_NOT_OFFERED") {
      const answer = `${this.formatAvailabilityReason(result.reasonCode, { parishName: parish.parishName, eventType, date: `${result.startDate} through ${result.endDate}` })}\n\n${this.formatParishContact(parish)}`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          eventType,
          humanEventType: humanizeEventType(eventType),
          startDate: result.startDate,
          endDate: result.endDate,
          rangeDays: result.rangeDays,
          isAvailable: false,
          isOffered: result.reasonCode !== "EVENT_NOT_OFFERED",
          reasonCode: result.reasonCode || "EVENT_NOT_OFFERED",
          safeReason: result.reasonCode || "EVENT_NOT_OFFERED",
          availableDates: [],
        },
        liveData: {
          label: "Current TESTIMONIUM Data",
          asOf: new Date().toISOString(),
          parishId: pId,
          startDate: result.startDate,
          endDate: result.endDate,
          rangeDays: result.rangeDays,
          reasonCode: result.reasonCode,
          dates: [],
        },
      };
    }

    if (!result.dates.length) {
      const answer = `There are no **${humanizeEventType(eventType)}** dates with an available slot at **${parish.parishName}** from **${result.startDate}** through **${result.endDate}**.`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          eventType,
          humanEventType: humanizeEventType(eventType),
          startDate: result.startDate,
          endDate: result.endDate,
          rangeDays: result.rangeDays,
          isAvailable: false,
          isOffered: true,
          reasonCode: result.reasonCode || "NO_AVAILABLE_SLOTS",
          safeReason: result.reasonCode || "NO_AVAILABLE_SLOTS",
          availableDates: [],
        },
        liveData: {
          label: "Current TESTIMONIUM Data",
          asOf: new Date().toISOString(),
          parishId: pId,
          startDate: result.startDate,
          endDate: result.endDate,
          rangeDays: result.rangeDays,
          reasonCode: result.reasonCode,
          dates: [],
        },
      };
    }

    const formatter = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const lines = result.dates.map(({ date, slots }) =>
      `- **${formatter.format(new Date(`${date}T00:00:00+08:00`))}** (${slots.length} ${slots.length === 1 ? "slot" : "slots"})`
    );
    const answer = `**${parish.parishName}** currently has **${humanizeEventType(eventType)}** availability on:\n\n${lines.join("\n")}\n\nWould you like the available times for one of those dates?`;

    const structuredFacts = {
      parishName: parish.parishName,
      eventType,
      humanEventType: humanizeEventType(eventType),
      startDate: result.startDate,
      endDate: result.endDate,
      rangeDays: result.rangeDays,
      isAvailable: true,
      availableDates: result.dates.map((d) => ({
        date: d.date,
        slotCount: d.slots.length,
      })),
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: {
        label: "Current TESTIMONIUM Data",
        asOf: new Date().toISOString(),
        parishId: pId,
        startDate: result.startDate,
        endDate: result.endDate,
        rangeDays: result.rangeDays,
        reasonCode: null,
        dates: result.dates,
      },
    };
  }

  /**
   * Tool 7: CHECK_MY_REQUEST_STATUS
   * Strictly enforces userId from authenticated principal.
   */
  async checkMyRequestStatus({ userId, trackingNumber }) {
    const authUserId = Number(userId);
    if (!authUserId || !Number.isInteger(authUserId) || authUserId <= 0) {
      return {
        answer: "Please sign in to check your document request status.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
      };
    }

    // Case 1: Specific tracking number provided
    if (trackingNumber && typeof trackingNumber === "string" && trackingNumber.trim()) {
      const cleanTracking = trackingNumber.trim();
      const request = await this.requestRepository.findByTrackingNumber(cleanTracking, authUserId);

      if (!request) {
        return {
          answer: `I couldn't find a document request with tracking number **${cleanTracking}** under your account. Please make sure the tracking number is correct or check your Request History in the dashboard.`,
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
        };
      }

      return this.formatSingleRequestStatus(request);
    }

    // Case 2: No tracking number provided -> list recent user requests
    const { data: userRequests } = await this.requestRepository.findMany({
      userId: authUserId,
      page: 1,
      limit: 5,
    });

    if (!userRequests || userRequests.length === 0) {
      return {
        answer: "You do not have any submitted document requests in your account yet. You can submit a new request anytime from the Sacramental Documents menu.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
      };
    }

    // If exactly 1 request exists, show its status directly
    if (userRequests.length === 1) {
      return this.formatSingleRequestStatus(userRequests[0]);
    }

    // Multiple requests exist -> return safe summary list
    const requestLines = userRequests.map((r) => {
      const doc = humanizeDocumentType(r.documentType);
      const parishName = r.parish?.parishName || "Parish";
      const statusLabel = humanizeDocumentStatus(r.status);
      const trackingPrefix = r.trackingNumber ? `**${r.trackingNumber}**: ` : "";
      return `- ${trackingPrefix}${doc} at ${parishName} — **${statusLabel}**`;
    });

    const exampleTracking = userRequests.find((r) => r.trackingNumber)?.trackingNumber;
    const examplePrompt = exampleTracking
      ? `*"What is the status of ${exampleTracking}?"*`
      : `*"What is the status of my ${humanizeDocumentType(userRequests[0].documentType)}?"*`;

    const answer = `You currently have **${userRequests.length}** recent document requests:\n\n${requestLines.join("\n")}\n\nTo check detailed remarks for a specific request, you can ask: ${examplePrompt}`;

    const structuredFacts = {
      requests: userRequests.map((r) => ({
        trackingNumber: r.trackingNumber || null,
        documentType: humanizeDocumentType(r.documentType),
        safeStatus: humanizeDocumentStatus(r.status),
        parishName: r.parish?.parishName || "Parish",
      })),
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
    };
  }

  formatSingleRequestStatus(request) {
    const docName = humanizeDocumentType(request.documentType);
    const parishName = request.parish?.parishName || "your parish";
    const statusLabel = humanizeDocumentStatus(request.status);
    const trackingDescriptor = request.trackingNumber ? ` (**${request.trackingNumber}**)` : "";

    let statusExplanation = "";
    let safeNextAction = "";
    switch (request.status) {
      case "PENDING":
      case "UNDER_REVIEW":
        statusExplanation = "Parish staff are reviewing your submitted documents and information.";
        safeNextAction = "Waiting for parish review.";
        break;
      case "NEEDS_CORRECTION":
        statusExplanation = "Your request requires document correction. Please review the requirements in your dashboard and upload the requested documents.";
        safeNextAction = "Please review requirements in your dashboard and upload requested documents.";
        break;
      case "PAYMENT_PENDING":
        statusExplanation = "Your request has been reviewed and is awaiting payment submission.";
        safeNextAction = "Awaiting payment submission.";
        break;
      case "PAYMENT_UNDER_REVIEW":
        statusExplanation = "Parish staff are reviewing your submitted payment proof.";
        safeNextAction = "Payment proof is under review by parish staff.";
        break;
      case "PAYMENT_NEEDS_CORRECTION":
        statusExplanation = "Your payment proof requires correction. Please upload a clear payment receipt with visible reference number in your dashboard.";
        safeNextAction = "Please upload a clear payment receipt with visible reference number.";
        break;
      case "PAYMENT_VERIFIED":
      case "PROCESSING":
      case "READY_FOR_SIGNING":
        statusExplanation = "Your payment has been verified. The parish office is currently preparing your certificate.";
        safeNextAction = "Certificate is being prepared.";
        break;
      case "READY_FOR_PICKUP":
        statusExplanation = "🎉 Your certificate is printed and ready for pickup at the parish office during regular office hours! Please bring your valid ID.";
        safeNextAction = "Ready for pickup at parish office during regular hours with valid ID.";
        break;
      case "COMPLETED":
        statusExplanation = "This request has been fulfilled and completed.";
        safeNextAction = "Request completed.";
        break;
      case "REJECTED":
        statusExplanation = "This request was rejected by the parish office. Please contact the parish office or check your dashboard for further details.";
        safeNextAction = "Contact parish office for further details.";
        break;
      case "CANCELLED":
        statusExplanation = "This request was cancelled.";
        safeNextAction = "Request cancelled.";
        break;
      default:
        statusExplanation = "Your request is being processed.";
        safeNextAction = "Request is being processed.";
    }

    const dateStr = request.dateRequested ? new Date(request.dateRequested).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recently";

    const answer = `Your request for a **${docName}**${trackingDescriptor} at **${parishName}** is currently **${statusLabel}**.\n\n${statusExplanation}\n\n*Date Requested: ${dateStr}*`;

    const structuredFacts = {
      trackingNumber: request.trackingNumber || null,
      documentType: docName,
      safeStatus: statusLabel,
      safeNextAction,
      parishName,
      dateRequested: dateStr,
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: request.parishId },
    };
  }

  /**
   * Tool 8: CHECK_MY_PAYMENT_STATUS
   * Strictly enforces userId from authenticated principal.
   */
  async checkMyPaymentStatus({ userId, trackingNumber }) {
    const authUserId = Number(userId);
    if (!authUserId || !Number.isInteger(authUserId) || authUserId <= 0) {
      return {
        answer: "Please sign in to check your payment verification status.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
      };
    }

    let targetRequest = null;

    if (trackingNumber && typeof trackingNumber === "string" && trackingNumber.trim()) {
      targetRequest = await this.requestRepository.findByTrackingNumber(trackingNumber.trim(), authUserId);
      if (!targetRequest) {
        return {
          answer: `I couldn't find a request with tracking number **${trackingNumber.trim()}** under your account.`,
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
        };
      }
    } else {
      // Find the most recent request requiring or with payment
      const { data: requests } = await this.requestRepository.findMany({
        userId: authUserId,
        page: 1,
        limit: 5,
      });

      if (!requests || requests.length === 0) {
        return {
          answer: "You do not have any active document requests with payment records.",
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
        };
      }

      if (requests.length === 1) {
        targetRequest = requests[0];
      } else {
        // Find one that is payment-related, or list them
        const paymentRelated = requests.filter((r) =>
          ["PAYMENT_PENDING", "PAYMENT_UNDER_REVIEW", "PAYMENT_NEEDS_CORRECTION", "PAYMENT_VERIFIED", "PROCESSING"].includes(r.status) ||
          r.paymentStatus !== "UNPAID"
        );

        if (paymentRelated.length === 1) {
          targetRequest = paymentRelated[0];
        } else if (paymentRelated.length > 1) {
          const lines = paymentRelated.map((r) => {
            const pStatus = humanizePaymentStatus(r.paymentStatus);
            const rStatus = humanizeDocumentStatus(r.status);
            const trackingPrefix = r.trackingNumber ? `**${r.trackingNumber}**: ` : "";
            return `- ${trackingPrefix}${humanizeDocumentType(r.documentType)} — Payment: **${pStatus}** (${rStatus})`;
          });

          const exampleTracking = paymentRelated.find((r) => r.trackingNumber)?.trackingNumber;
          const examplePrompt = exampleTracking
            ? `*"Is my payment for ${exampleTracking} verified?"*`
            : `*"Is my payment for ${humanizeDocumentType(paymentRelated[0].documentType)} verified?"*`;

          return {
            answer: `You have multiple requests with payment activity:\n\n${lines.join("\n")}\n\nTo check a specific one, please ask: ${examplePrompt}`,
            fallbackAnswer: `You have multiple requests with payment activity:\n\n${lines.join("\n")}\n\nTo check a specific one, please ask: ${examplePrompt}`,
            structuredFacts: {
              requests: paymentRelated.map((r) => ({
                trackingNumber: r.trackingNumber || null,
                documentType: humanizeDocumentType(r.documentType),
                safePaymentStatus: humanizePaymentStatus(r.paymentStatus),
                safeRequestStatus: humanizeDocumentStatus(r.status),
              })),
            },
            liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
          };
        } else {
          targetRequest = requests[0];
        }
      }
    }

    const docName = humanizeDocumentType(targetRequest.documentType);
    const trackingDescriptor = targetRequest.trackingNumber ? ` (**${targetRequest.trackingNumber}**)` : "";
    const pStatus = humanizePaymentStatus(targetRequest.paymentStatus);
    const rStatus = humanizeDocumentStatus(targetRequest.status);

    let paymentExplanation = "";
    let safeNextAction = null;
    if (targetRequest.status === "PAYMENT_UNDER_REVIEW" || targetRequest.paymentStatus === "PROOF_SUBMITTED") {
      paymentExplanation = "Your payment proof was received and is currently under review by parish staff. Verification typically takes 1 business day.";
      safeNextAction = "Payment proof is under review by parish staff.";
    } else if (targetRequest.status === "PAYMENT_NEEDS_CORRECTION") {
      safeNextAction = "Please upload a clear payment receipt with visible reference number in your dashboard.";
      paymentExplanation = "Your payment proof requires correction. Please submit a clear payment receipt screenshot with visible transaction reference number in your dashboard.";
    } else if (targetRequest.status === "PAYMENT_VERIFIED" || targetRequest.paymentStatus === "CONFIRMED") {
      paymentExplanation = "✅ Your payment has been verified by the parish office! Your certificate is currently being prepared.";
      safeNextAction = "Certificate is being prepared.";
    } else if (targetRequest.paymentStatus === "UNPAID") {
      paymentExplanation = `Your payment is currently unpaid. The amount due is ₱${targetRequest.fee ? Number(targetRequest.fee).toFixed(2) : "0.00"}. You can upload your payment proof in your dashboard.`;
      safeNextAction = "Awaiting payment upload.";
    } else {
      paymentExplanation = `Current payment state is ${pStatus}.`;
    }

    const answer = `Payment status for **${docName}**${trackingDescriptor}:\n\n- **Payment State:** ${pStatus}\n- **Request State:** ${rStatus}\n\n${paymentExplanation}`;

    const structuredFacts = {
      trackingNumber: targetRequest.trackingNumber || null,
      documentType: docName,
      safePaymentStatus: pStatus,
      safeRequestStatus: rStatus,
      amountDue: targetRequest.fee ? `₱${Number(targetRequest.fee).toFixed(2)}` : null,
      safeNextAction,
      parishName: targetRequest.parish?.parishName || null,
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: targetRequest.parishId },
    };
  }

  /**
   * Tool 9: GET_MY_UPCOMING_SCHEDULES
   * Strictly enforces userId from authenticated principal.
   */
  async getMyUpcomingSchedules({ userId }) {
    const authUserId = Number(userId);
    if (!authUserId || !Number.isInteger(authUserId) || authUserId <= 0) {
      return {
        answer: "Please sign in to view your upcoming sacramental appointments.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
      };
    }

    const todayStr = getManilaDateString(new Date());
    const parsedToday = parseStrictManilaDateOnly(todayStr);
    const minDate = parsedToday ? parsedToday.databaseDate : new Date();

    const upcomingSchedules = await this.prisma.schedule.findMany({
      where: {
        userId: authUserId,
        status: { notIn: ["CANCELLED", "REJECTED", "COMPLETED"] },
        OR: [
          { requestedDate: { gte: minDate } },
          { startDatetime: { gte: new Date() } },
        ],
      },
      include: {
        parish: { select: { id: true, parishName: true } },
        assignedPriest: { select: { id: true, fullName: true } },
      },
      orderBy: [
        { requestedDate: "asc" },
        { startDatetime: "asc" },
      ],
      take: 5,
    });

    if (!upcomingSchedules || upcomingSchedules.length === 0) {
      return {
        answer: "You do not have any upcoming sacramental appointments scheduled in TESTIMONIUM. You can request a baptism, wedding, blessing, or Mass intention from the Schedules section.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
      };
    }

    const scheduleLines = upcomingSchedules.map((s) => {
      const eventTitle = humanizeEventType(s.eventType);
      const parishName = s.parish?.parishName || "Parish";
      const statusLabel = humanizeScheduleStatus(s.status);
      const dateStr = s.requestedDate
        ? new Date(s.requestedDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
        : "Pending Date";
      const celebrant = s.assignedPriest?.fullName
        ? ` (Celebrant: ${formatClergyName(s.assignedPriest.fullName)})`
        : "";

      return `- 📅 **${eventTitle}** at **${parishName}**\n  - Date: ${dateStr}\n  - Status: **${statusLabel}**${celebrant}`;
    });

    const answer = `Here are your upcoming sacramental appointments:\n\n${scheduleLines.join("\n\n")}`;

    const structuredFacts = {
      schedules: upcomingSchedules.map((s) => ({
        eventType: humanizeEventType(s.eventType),
        parishName: s.parish?.parishName || "Parish",
        date: s.requestedDate
          ? new Date(s.requestedDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
          : "Pending Date",
        time: s.startDatetime
          ? new Date(s.startDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
          : null,
        safeStatus: humanizeScheduleStatus(s.status),
        celebrant: s.assignedPriest?.fullName ? formatClergyName(s.assignedPriest.fullName) : null,
      })),
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
    };
  }

  /**
   * Tool 10: GET_ACTIVE_PARISHES
   */
  async getActiveParishes() {
    const parishes = await this.prisma.parish.findMany({
      where: { isActive: true },
      select: {
        id: true,
        parishName: true,
        type: true,
        municipalityCity: true,
        province: true,
        contactNumber: true,
        email: true,
      },
      orderBy: [{ type: "asc" }, { parishName: "asc" }],
    });

    if (!parishes || parishes.length === 0) {
      return {
        answer: "There are currently no active parishes registered in TESTIMONIUM.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
      };
    }

    const lines = parishes.map((p) => {
      const typeLabel = humanizeParishType(p.type);
      const loc = [p.municipalityCity, p.province].filter(Boolean).join(", ");
      const locText = loc ? ` — ${loc}` : "";
      return `- **${p.parishName}** *(${typeLabel})*${locText}`;
    });

    const answer = `Here are the active parishes, quasi-parishes, and mission stations in TESTIMONIUM:\n\n${lines.join("\n")}\n\n*This list comes directly from the current verified parish directory.*`;

    const structuredFacts = {
      parishes: parishes.map((p) => ({
        parishName: p.parishName,
        type: humanizeParishType(p.type),
        location: [p.municipalityCity, p.province].filter(Boolean).join(", "),
      })),
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: {
        label: "Current TESTIMONIUM Data",
        asOf: new Date().toISOString(),
        parishes: parishes.map((p) => ({ id: p.id, name: p.parishName, type: p.type })),
      },
    };
  }

  /**
   * Tool: GET_VICARIATE_DIRECTORY
   * Returns active church units belonging to a specific Vicariate,
   * including counts by organizational type.
   */
  async getVicariateDirectory({ vicariateName = null, conversationContext = null } = {}) {
    const parishes = await this.prisma.parish.findMany({
      where: { isActive: true },
      select: {
        id: true,
        parishName: true,
        type: true,
        municipalityCity: true,
        province: true,
        contactNumber: true,
        email: true,
      },
      orderBy: [{ type: "asc" }, { parishName: "asc" }],
    });

    const activeUnits = (parishes || []).filter((p) => p.isActive !== false);

    if (activeUnits.length === 0) {
      return {
        answer: "There are currently no active church units registered in TESTIMONIUM.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
      };
    }

    // Discover registered vicariates dynamically from active units
    const registeredVicariates = Array.from(
      new Set(activeUnits.map((p) => p.vicariate || "Vicariate of Canlaon"))
    );

    const candidateName =
      (typeof vicariateName === "string" && vicariateName.trim()) ||
      conversationContext?.lastVicariateName ||
      null;

    const matchedVicariate = resolveVicariateName(candidateName, registeredVicariates);

    if (!matchedVicariate) {
      const knownList = registeredVicariates.join(", ");
      return {
        answer: candidateName
          ? `I couldn't find a Vicariate matching "${candidateName}" in TESTIMONIUM. Currently registered vicariates include: ${knownList}.`
          : `Please specify which Vicariate directory you'd like to view (${knownList}).`,
        fallback: true,
        fallbackReason: "INVALID_VICARIATE",
        responseType: "FALLBACK",
        category: "LIVE_DATA",
        sources: [],
        liveData: {
          label: "Current TESTIMONIUM Data",
          asOf: new Date().toISOString(),
          registeredVicariates,
        },
      };
    }

    const memberUnits = activeUnits.filter(
      (p) => (p.vicariate || "Vicariate of Canlaon").toLowerCase() === matchedVicariate.toLowerCase()
    );

    const counts = {
      PARISH: 0,
      QUASI_PARISH: 0,
      MISSION_STATION: 0,
    };

    for (const unit of memberUnits) {
      const typeKey = String(unit.type).toUpperCase();
      if (counts[typeKey] !== undefined) {
        counts[typeKey]++;
      } else {
        counts[typeKey] = 1;
      }
    }

    const total = memberUnits.length;

    const breakdownParts = [];
    if (counts.PARISH > 0) {
      breakdownParts.push(`${counts.PARISH} ${counts.PARISH === 1 ? "Parish" : "Parishes"}`);
    }
    if (counts.QUASI_PARISH > 0) {
      breakdownParts.push(`${counts.QUASI_PARISH} ${counts.QUASI_PARISH === 1 ? "Quasi-Parish" : "Quasi-Parishes"}`);
    }
    if (counts.MISSION_STATION > 0) {
      breakdownParts.push(`${counts.MISSION_STATION} ${counts.MISSION_STATION === 1 ? "Mission Station" : "Mission Stations"}`);
    }

    let breakdownText = "";
    if (breakdownParts.length === 0) {
      breakdownText = "0 active church units";
    } else if (breakdownParts.length === 1) {
      breakdownText = breakdownParts[0];
    } else if (breakdownParts.length === 2) {
      breakdownText = `${breakdownParts[0]} and ${breakdownParts[1]}`;
    } else {
      breakdownText = `${breakdownParts.slice(0, -1).join(", ")}, and ${breakdownParts[breakdownParts.length - 1]}`;
    }

    const unitNoun = total === 1 ? "active church unit" : "active church units";
    const header = `The **${matchedVicariate}** currently has ${total} ${unitNoun} in TESTIMONIUM: **${breakdownText}**.\n\n`;

    const lines = memberUnits.map((p) => {
      const typeLabel = humanizeParishType(p.type);
      const loc = [p.municipalityCity, p.province].filter(Boolean).join(", ");
      const locText = loc ? ` — ${loc}` : "";
      return `- **${p.parishName}** *(${typeLabel})*${locText}`;
    });

    const answer = `${header}${lines.join("\n")}\n\n*This list comes directly from the current verified diocesan hierarchy.*`;

    const structuredFacts = {
      vicariateName: matchedVicariate,
      total,
      counts,
      parishes: memberUnits.map((u) => ({
        parishName: u.parishName,
        type: humanizeParishType(u.type),
        location: [u.municipalityCity, u.province].filter(Boolean).join(", "),
      })),
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: {
        label: "Current TESTIMONIUM Data",
        asOf: new Date().toISOString(),
        vicariate: matchedVicariate,
        total,
        counts,
        units: memberUnits.map((u) => ({
          name: u.parishName,
          type: u.type,
          municipalityCity: u.municipalityCity,
          province: u.province,
        })),
      },
    };
  }

  /**
   * Tool 11: CHECK_PRIEST_AVAILABILITY
   */
  async checkPriestAvailability({ parishId, priestId = null, priestName = null, date, timeSlot = null, eventType = null }) {
    const pId = Number(parishId);
    if (!pId || !date) {
      throw new Error("parishId and date are required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: { id: true, parishName: true, isActive: true, contactNumber: true, email: true },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const eligiblePriests = await getEligiblePriestsForParish(pId, null, this.prisma);
    let targetPriest = null;

    if (priestId) {
      const parsedPriestId = Number(priestId);
      targetPriest = eligiblePriests.find((p) => p.id === parsedPriestId) || null;
    } else if (priestName && typeof priestName === "string") {
      const cleanTarget = priestName.toLowerCase().replace(/^(rev\.?\s*fr\.?|fr\.?|father)\s+/i, "").trim();
      if (cleanTarget === "parish priest" || cleanTarget === "pastor") {
        targetPriest = eligiblePriests.find((p) => !p.isAssistant) || eligiblePriests[0] || null;
      } else {
        targetPriest = eligiblePriests.find((p) => {
          const pClean = (p.name || "").toLowerCase().replace(/^(rev\.?\s*fr\.?|fr\.?|father)\s+/i, "").trim();
          return pClean.includes(cleanTarget) || cleanTarget.includes(pClean);
        }) || null;
      }
    }

    if (!targetPriest) {
      const priestDisplay = priestName ? `"${priestName}"` : "The requested priest";
      const availablePriestNames = eligiblePriests.map((p) => formatClergyName(p.name)).join(", ");
      return {
        answer: `${priestDisplay} was not found among the active assigned clergy for **${parish.parishName}**.\n\nCurrently assigned clergy: ${availablePriestNames || "None listed"}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const formattedPriest = formatClergyName(targetPriest.name);
    const effectiveEvent = eventType || "WEDDING";
    let parishAvailability;
    try {
      parishAvailability = await this.getClassifiedSlotAvailability(pId, date, effectiveEvent);
    } catch (err) {
      return {
        answer: `I could not check parish scheduling availability: ${err.message}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, isAvailable: false },
      };
    }
    const parishSlots = Array.isArray(parishAvailability?.slots)
      ? parishAvailability.slots.map((s) => (typeof s === "string" ? s : s.timeSlot)).filter(Boolean)
      : [];
    if (!parishAvailability?.serviceAvailable || parishAvailability?.reasonCode === "EVENT_NOT_OFFERED") {
      return {
        answer: `${this.formatAvailabilityReason(parishAvailability?.reasonCode, { parishName: parish.parishName, eventType: effectiveEvent, date })}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, isAvailable: false, priestId: targetPriest.id, reasonCode: parishAvailability?.reasonCode },
      };
    }

    const priestSnapshot = await loadPriestConflictSnapshot(targetPriest.id, date, date, this.prisma);

    if (timeSlot) {
      const candidateStart = parseManilaDateTime(date, timeSlot);
      if (!candidateStart) {
        return {
          answer: `Could not parse the requested time "${timeSlot}". Please provide a time like "2:00 PM" or "10:00 AM".`,
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
        };
      }

      const candidateEnd = computeOperationalEndDatetime(candidateStart);
      const conflict = evaluatePriestConflictFromSnapshot(priestSnapshot, candidateStart, candidateEnd);

      const targetNorm = normalizeTimeSlotString(timeSlot);
      const parishSlotAvailable = parishSlots.some((s) => normalizeTimeSlotString(s) === targetNorm);

      if (conflict.available && parishSlotAvailable) {
        const answer = `✅ **${formattedPriest}** is currently **available** for **${humanizeEventType(effectiveEvent)}** at **${parish.parishName}** on **${date}** at **${timeSlot}**.\n\nYou can select this clergy assignment when completing your schedule booking.`;
        return {
          answer,
          fallbackAnswer: answer,
          structuredFacts: {
            parishName: parish.parishName,
            priestName: formattedPriest,
            date,
            timeSlot,
            eventType: humanizeEventType(effectiveEvent),
            isAvailable: true,
            availableSlots: [timeSlot],
          },
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, isAvailable: true, priestId: targetPriest.id, timeSlot },
        };
      } else {
        const safeAlternatives = [];
        for (const slot of parishSlots) {
          const sStart = parseManilaDateTime(date, slot);
          if (sStart) {
            const sEnd = computeOperationalEndDatetime(sStart);
            const slotConflict = evaluatePriestConflictFromSnapshot(priestSnapshot, sStart, sEnd);
            if (slotConflict.available) {
              safeAlternatives.push(slot);
            }
          }
        }

        const altText = safeAlternatives.length > 0
          ? `Available alternative times with **${formattedPriest}** on this date include:\n\n${safeAlternatives.map((s) => `- ⏰ **${s}**`).join("\n")}\n\n`
          : `There are no alternative slots open for **${formattedPriest}** on this date.\n\n`;

        const answer = `**${formattedPriest}** is currently **not available** at **${timeSlot}** on **${date}**.\n\n${altText}*Confidential scheduling details are never disclosed.*`;

        return {
          answer,
          fallbackAnswer: answer,
          structuredFacts: {
            parishName: parish.parishName,
            priestName: formattedPriest,
            date,
            timeSlot,
            eventType: humanizeEventType(effectiveEvent),
            isAvailable: false,
            availableSlots: safeAlternatives,
          },
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, isAvailable: false, priestId: targetPriest.id, timeSlot },
        };
      }
    }

    // General day query
    const freeSlots = [];
    for (const slot of parishSlots) {
      const sStart = parseManilaDateTime(date, slot);
      if (sStart) {
        const sEnd = computeOperationalEndDatetime(sStart);
        const slotConflict = evaluatePriestConflictFromSnapshot(priestSnapshot, sStart, sEnd);
        if (slotConflict.available) {
          freeSlots.push(slot);
        }
      }
    }

    if (freeSlots.length > 0) {
      const slotLines = freeSlots.map((s) => `- ⏰ **${s}**`).join("\n");
      const answer = `**${formattedPriest}** currently has the following available times at **${parish.parishName}** on **${date}**:\n\n${slotLines}\n\nYou can book any of these slots through the Sacramental Scheduling module.`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          priestName: formattedPriest,
          date,
          eventType: humanizeEventType(effectiveEvent),
          isAvailable: true,
          availableSlots: freeSlots,
        },
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, priestId: targetPriest.id },
      };
    } else {
      const answer = `**${formattedPriest}** does not have any available appointment slots at **${parish.parishName}** on **${date}**.\n\nPlease choose another date or select another celebrant.\n\n${this.formatParishContact(parish)}`;
      return {
        answer,
        fallbackAnswer: answer,
        structuredFacts: {
          parishName: parish.parishName,
          priestName: formattedPriest,
          date,
          eventType: humanizeEventType(effectiveEvent),
          isAvailable: false,
          availableSlots: [],
        },
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, priestId: targetPriest.id },
      };
    }
  }

  /**
   * Tool 12: GET_AVAILABLE_PRIESTS_FOR_SLOT
   */
  async getAvailablePriestsForSlot({ parishId, date, timeSlot = null, eventType = null }) {
    const pId = Number(parishId);
    if (!pId || !date) {
      throw new Error("parishId and date are required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: { id: true, parishName: true, isActive: true, contactNumber: true, email: true },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const effectiveEvent = eventType || "WEDDING";
    const parishAvailability = await this.getClassifiedSlotAvailability(pId, date, effectiveEvent);
    const parishSlots = Array.isArray(parishAvailability?.slots)
      ? parishAvailability.slots.map((s) => (typeof s === "string" ? s : s.timeSlot)).filter(Boolean)
      : [];
    if (!parishAvailability?.serviceAvailable || parishAvailability?.reasonCode === "EVENT_NOT_OFFERED") {
      return {
        answer: this.formatAvailabilityReason(parishAvailability?.reasonCode, { parishName: parish.parishName, eventType: effectiveEvent, date }),
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, availablePriests: [], reasonCode: parishAvailability?.reasonCode },
      };
    }

    let candidateSlots = parishSlots;
    if (timeSlot) {
      const normalizedRequested = normalizeTimeSlotString(timeSlot);
      candidateSlots = parishSlots.filter((slot) => normalizeTimeSlotString(slot) === normalizedRequested);
      if (!candidateSlots.length) {
        return {
          answer: `**${timeSlot}** is not an available **${humanizeEventType(effectiveEvent)}** slot at **${parish.parishName}** on **${date}**.`,
          liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, availablePriests: [], reasonCode: "SLOT_UNAVAILABLE" },
        };
      }
    }

    const eligiblePriests = await getEligiblePriestsForParish(pId, null, this.prisma);
    if (!eligiblePriests || eligiblePriests.length === 0) {
      return {
        answer: `There are currently no active priests listed for **${parish.parishName}**.`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const availablePriests = [];
    for (const priest of eligiblePriests) {
      const priestSnapshot = await loadPriestConflictSnapshot(priest.id, date, date, this.prisma);

      const hasAvailableSlot = candidateSlots.some((slot) => {
        const candidateStart = parseManilaDateTime(date, slot);
        if (!candidateStart) return false;
        const candidateEnd = computeOperationalEndDatetime(candidateStart);
        return evaluatePriestConflictFromSnapshot(priestSnapshot, candidateStart, candidateEnd).available;
      });
      if (hasAvailableSlot) {
        availablePriests.push(priest);
      }
    }

    const timeText = timeSlot ? ` at **${timeSlot}**` : "";
    if (availablePriests.length === 0) {
      return {
        answer: `There are no clergy available for **${parish.parishName}** on **${date}**${timeText}.\n\nPlease check another time or contact the parish office.\n\n${this.formatParishContact(parish)}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const priestLines = availablePriests.map((p) => {
      const roleSuffix = p.isAssistant ? " *(Assistant Priest)*" : " *(Parish Priest)*";
      return `- **${formatClergyName(p.name)}**${roleSuffix}`;
    });

    const answer = `The following clergy are currently available at **${parish.parishName}** on **${date}**${timeText}:\n\n${priestLines.join("\n")}\n\nYou can request any of these priests during schedule booking.`;

    const structuredFacts = {
      parishName: parish.parishName,
      date,
      timeSlot,
      eventType: humanizeEventType(effectiveEvent),
      availablePriests: availablePriests.map((p) => ({
        name: formatClergyName(p.name),
        isAssistant: Boolean(p.isAssistant),
      })),
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: {
        label: "Current TESTIMONIUM Data",
        asOf: new Date().toISOString(),
        parishId: pId,
        availablePriests: availablePriests.map((p) => ({
          id: p.id,
          name: formatClergyName(p.name),
          isAssistant: p.isAssistant,
        })),
      },
    };
  }

  /**
   * Tool 13: GET_PARISH_EVENTS_FOR_DATE
   */
  async getParishEventsForDate({ parishId, date }) {
    const pId = Number(parishId);
    if (!pId || !date) {
      throw new Error("parishId and date are required.");
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id: pId },
      select: { id: true, parishName: true, isActive: true },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const parsedDate = parseStrictManilaDateOnly(date);
    if (!parsedDate) {
      return {
        answer: `Invalid date format "${date}". Please provide a date in YYYY-MM-DD format.`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    let events = [];
    try {
      if (this.prisma?.parishEvent?.findMany) {
        const dayStart = parsedDate.databaseDate;
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        events = await this.prisma.parishEvent.findMany({
          where: {
            parishId: pId,
            isActive: true,
            visibility: "PUBLIC",
            eventDate: { gte: dayStart, lt: dayEnd },
          },
          select: {
            id: true,
            parishId: true,
            title: true,
            eventType: true,
            description: true,
            location: true,
            eventDate: true,
            startTime: true,
            endTime: true,
            visibility: true,
          },
          orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
        });
      } else {
        const eventService = new ParishEventService();
        events = await eventService.getEvents(pId, parsedDate.year, parsedDate.month, { publicOnly: true });
      }
    } catch {
      events = [];
    }

    const dateEvents = (events || []).filter((e) => {
      const rawDate = e.eventDate;
      if (!rawDate) return false;
      const eDateStr = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : getManilaDateString(new Date(rawDate));
      return eDateStr === parsedDate.dateStr && e.visibility !== "PARISH_PRIVATE";
    });

    let massSchedules = [];
    try {
      const templateDelegate = this.prisma?.massScheduleTemplate || this.prisma?.parishMassScheduleTemplate;
      if (templateDelegate?.findMany) {
        const pDate = parseManilaDateOnly(parsedDate.dateStr);
        const dayOfWeek = pDate ? new Date(Date.UTC(pDate.year, pDate.month - 1, pDate.day)).getUTCDay() : new Date(parsedDate.dateStr).getDay();
        const targetDayType = dayOfWeek === 0 ? "SUNDAY" : "WEEKDAY";
        const templates = await templateDelegate.findMany({
          where: { parishId: pId, isActive: true },
          select: {
            id: true,
            dayType: true,
            timeSlot: true,
            label: true,
            layMinisterAssigned: true,
          },
        });
        massSchedules = (templates || []).filter((t) => {
          if (t.dayOfWeek !== undefined) {
            return Number(t.dayOfWeek) === Number(dayOfWeek);
          }
          return t.dayType === targetDayType || !t.dayType;
        });
      }
    } catch {
      massSchedules = [];
    }

    if (dateEvents.length === 0 && massSchedules.length === 0) {
      return {
        answer: `There are no public calendar events scheduled at **${parish.parishName}** on **${date}**.\n\nRegular appointments and sacramental services may still be booked through the scheduling system.`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId, publicEvents: [], massSchedules: [] },
      };
    }

    const eventLines = dateEvents.map((e) => {
      const timeSpan = e.startTime ? ` (${e.startTime}${e.endTime ? ` - ${e.endTime}` : ""})` : "";
      const loc = e.location ? ` — *${e.location}*` : "";
      return `- 📅 **${e.title}**${timeSpan}${loc}`;
    });

    const massLines = massSchedules.map((m) => {
      const timeDisplay = m.timeSlot || m.time || "Regular Time";
      const labelDisplay = resolveMassDisplayLabel(m);
      const lang = m.language ? ` (${m.language})` : "";
      const loc = m.location ? ` — *${m.location}*` : "";
      return `- ⛪ **${labelDisplay}**: ${timeDisplay}${lang}${loc}`;
    });

    const combinedSections = [];
    if (eventLines.length > 0) {
      combinedSections.push(eventLines.join("\n"));
    }
    if (massLines.length > 0) {
      combinedSections.push(`**Scheduled Masses:**\n${massLines.join("\n")}`);
    }

    const answer = `Public parish events and services at **${parish.parishName}** on **${date}**:\n\n${combinedSections.join("\n\n")}\n\n*Only public diocesan and parish-approved activities are listed.*`;

    const structuredFacts = {
      parishName: parish.parishName,
      date: parsedDate.dateStr,
      events: dateEvents.map((e) => ({
        title: e.title,
        eventType: e.eventType,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
      })),
      massSchedules: massSchedules.map((m) => ({
        label: resolveMassDisplayLabel(m),
        configuredLabel: m.label || "Holy Mass",
        layMinisterAssigned: Boolean(m.layMinisterAssigned),
        timeSlot: m.timeSlot || m.time || "Regular Time",
        language: m.language || null,
        location: m.location || null,
      })),
    };

    return {
      answer,
      fallbackAnswer: answer,
      structuredFacts,
      liveData: {
        label: "Current TESTIMONIUM Data",
        asOf: new Date().toISOString(),
        parishId: pId,
        publicEvents: dateEvents,
        massSchedules,
      },
    };
  }

  /**
   * Universal executor for any tool in the registry
   */
  async execute(toolId, params = {}, user = null) {
    const contextUser = user || (params.userId ? { id: params.userId } : null);
    const mergedParams = { ...params, userId: contextUser?.id || null };

    switch (toolId) {
      case TOOL_IDS.GET_ACTIVE_PARISHES:
        return this.getActiveParishes();
      case TOOL_IDS.GET_VICARIATE_DIRECTORY:
        return this.getVicariateDirectory({
          vicariateName: mergedParams.vicariateName,
          conversationContext: mergedParams.conversationContext,
        });
      case TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS:
        return this.getActiveParishPriests({ parishId: mergedParams.parishId });
      case TOOL_IDS.GET_PARISH_DOCUMENTS:
        return this.getParishDocuments({ parishId: mergedParams.parishId });
      case TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS:
        return this.getParishSchedulableEvents({ parishId: mergedParams.parishId });
      case TOOL_IDS.GET_DOCUMENT_REQUIREMENTS:
        return this.getDocumentRequirements({
          documentType: mergedParams.documentType,
          parishId: mergedParams.parishId,
        });
      case TOOL_IDS.GET_DOCUMENT_FEE:
        return this.getDocumentFee({
          documentType: mergedParams.documentType,
          parishId: mergedParams.parishId,
        });
      case TOOL_IDS.GET_PARISH_OFFICE_INFO:
        return this.getParishOfficeInfo({ parishId: mergedParams.parishId });
      case TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY:
        return this.getCalendarSlotAvailability({
          parishId: mergedParams.parishId,
          eventType: mergedParams.eventType,
          date: mergedParams.date,
          timeSlot: mergedParams.timeSlot,
        });
      case TOOL_IDS.GET_AVAILABLE_DATES:
        return this.getAvailableDates({
          parishId: mergedParams.parishId,
          eventType: mergedParams.eventType,
          startDate: mergedParams.startDate,
          rangeDays: mergedParams.rangeDays,
        });
      case TOOL_IDS.CHECK_PRIEST_AVAILABILITY:
        return this.checkPriestAvailability({
          parishId: mergedParams.parishId,
          priestId: mergedParams.priestId,
          priestName: mergedParams.priestName,
          date: mergedParams.date,
          timeSlot: mergedParams.timeSlot,
          eventType: mergedParams.eventType,
        });
      case TOOL_IDS.GET_AVAILABLE_PRIESTS_FOR_SLOT:
        return this.getAvailablePriestsForSlot({
          parishId: mergedParams.parishId,
          date: mergedParams.date,
          timeSlot: mergedParams.timeSlot,
          eventType: mergedParams.eventType,
        });
      case TOOL_IDS.GET_PARISH_EVENTS_FOR_DATE:
        return this.getParishEventsForDate({
          parishId: mergedParams.parishId,
          date: mergedParams.date,
        });
      case TOOL_IDS.CHECK_MY_REQUEST_STATUS:
        return this.checkMyRequestStatus({
          userId: mergedParams.userId,
          trackingNumber: mergedParams.trackingNumber,
        });
      case TOOL_IDS.CHECK_MY_PAYMENT_STATUS:
        return this.checkMyPaymentStatus({
          userId: mergedParams.userId,
          trackingNumber: mergedParams.trackingNumber,
        });
      case TOOL_IDS.GET_MY_UPCOMING_SCHEDULES:
        return this.getMyUpcomingSchedules({ userId: mergedParams.userId });
      default:
        return {
          success: false,
          errorCategory: "INVALID_TOOL_INPUT",
          answer: "The requested tool is not recognized.",
        };
    }
  }
}

/**
 * Resolves a user or model-provided Vicariate name against known registered records.
 * Supports exact case-insensitive match, normalized match ("Canlaon" -> "Vicariate of Canlaon"),
 * and substring match. Returns canonical registered name, or null if no match found.
 */
export function resolveVicariateName(candidateName, availableVicariates = []) {
  if (!availableVicariates || availableVicariates.length === 0) return null;
  if (!candidateName || typeof candidateName !== "string") {
    return availableVicariates.length === 1 ? availableVicariates[0] : null;
  }

  const clean = candidateName.trim().toLowerCase();
  if (!clean) {
    return availableVicariates.length === 1 ? availableVicariates[0] : null;
  }

  const normalize = (str) =>
    String(str)
      .toLowerCase()
      .replace(/\bvicariate\s+of\b/gi, "")
      .replace(/\bvicariate\b/gi, "")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const normCandidate = normalize(clean);

  // 1. Exact case-insensitive match
  for (const v of availableVicariates) {
    if (v.toLowerCase() === clean) return v;
  }

  // 2. Normalized match (e.g. "Canlaon" matches "Vicariate of Canlaon")
  if (normCandidate) {
    for (const v of availableVicariates) {
      if (normalize(v) === normCandidate) return v;
    }
  }

  // 3. Substring match
  if (normCandidate) {
    for (const v of availableVicariates) {
      const normV = normalize(v);
      if (normV.includes(normCandidate) || normCandidate.includes(normV)) return v;
    }
  }

  return null;
}

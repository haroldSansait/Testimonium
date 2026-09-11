import { prisma } from "../../../config/db.js";
import { TOOL_IDS } from "./liveToolSchemas.js";
import {
  humanizeDocumentType,
  humanizeDocumentStatus,
  humanizePaymentStatus,
  humanizeVerificationStatus,
  humanizeEventType,
  humanizeScheduleStatus,
} from "./enumFormatters.js";
import { getEffectiveOfferedDocuments } from "../../../config/documents.js";
import { DocumentRequirementService } from "../../DocumentRequirementService.js";
import { getEligiblePriestsForParish } from "../../ScheduleAvailabilityDomainService.js";
import { ScheduleService } from "../../ScheduleService.js";
import { ParishionerRequestRepository } from "../../../repositories/ParishionerRequestRepository.js";
import { getManilaDateString, parseStrictManilaDateOnly } from "../../ConflictHelper.js";

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
      const displayName = p.name ? (p.name.startsWith("Fr.") || p.name.startsWith("Rev.") ? p.name : `Fr. ${p.name}`) : "Father";
      return `- **${displayName}**${roleSuffix}`;
    });

    const answer = `The currently listed active priests for **${parish.parishName}** are:\n\n${priestLines.join("\n")}\n\n*This information comes directly from the current TESTIMONIUM parish directory.*`;

    return {
      answer,
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

    return {
      answer,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
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
        select: { id: true, parishName: true, isActive: true },
      });
    }

    const config = await DocumentRequirementService.getRequirements(documentType, pId);

    const docTitle = config.title || humanizeDocumentType(documentType);
    const parishHeader = parish ? ` at **${parish.parishName}**` : "";

    const reqDocs = config.requiredDocuments || [];
    const primaryDocs = reqDocs.filter((d) => d.category === "primary");
    const supportingDocs = reqDocs.filter((d) => d.category === "supporting");

    let requirementsText = "";
    if (primaryDocs.length > 0) {
      requirementsText += `**Primary Requirements:**\n` + primaryDocs.map((d) => `- **${d.label}**${d.description ? `: ${d.description}` : ""}`).join("\n") + "\n\n";
    }
    if (supportingDocs.length > 0) {
      requirementsText += `**Supporting Documents:**\n` + supportingDocs.map((d) => `- **${d.label}**${d.description ? `: ${d.description}` : ""}`).join("\n") + "\n\n";
    }

    if (!requirementsText) {
      requirementsText = "No specific uploaded documents are required for this request.\n\n";
    }

    const feeText = config.baseFee !== undefined && config.baseFee !== null ? `\n- **Standard Fee:** ₱${Number(config.baseFee).toFixed(2)}` : "";
    const processingText = config.estimatedProcessingDays ? `\n- **Estimated Processing Time:** ~${config.estimatedProcessingDays} business days` : "";

    const answer = `Here are the current requirements for a **${docTitle}**${parishHeader}:\n\n${requirementsText}**Additional Details:**${feeText}${processingText}\n\n*Note: An Authorization Letter and valid ID of the representative are strictly required if requesting on behalf of someone else.*`;

    return {
      answer,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
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
      select: { id: true, parishName: true, isActive: true, contactNumber: true, email: true, documentSettings: true },
    });

    if (!parish || !parish.isActive) {
      return {
        answer: "The requested parish could not be found or is currently inactive.",
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const config = await DocumentRequirementService.getRequirements(documentType, pId);
    const docName = humanizeDocumentType(documentType);

    if (config.baseFee === undefined || config.baseFee === null || isNaN(Number(config.baseFee))) {
      const contactStr = this.formatParishContact(parish);
      return {
        answer: `I don't have a current **${docName}** fee recorded for **${parish.parishName}** in TESTIMONIUM. Please contact the parish office to confirm the current fee.${contactStr ? `\n\n${contactStr}` : ""}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const feeAmount = Number(config.baseFee).toFixed(2);
    const processingDays = config.estimatedProcessingDays || 3;

    const answer = `The current fee for a **${docName}** at **${parish.parishName}** is **₱${feeAmount}**.\n\n*Estimated processing time is approximately ${processingDays} business days.* Payments can be settled via uploaded GCash proof or official cash payment upon pickup.`;

    return {
      answer,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
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

    return {
      answer,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
    };
  }

  /**
   * Tool 6: GET_CALENDAR_SLOT_AVAILABILITY
   */
  async getCalendarSlotAvailability({ parishId, eventType, date }) {
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

    let slots = [];
    try {
      slots = await this.scheduleService.getAvailableSlots(pId, date, eventType);
    } catch (err) {
      return {
        answer: `I could not check availability for **${humanizeEventType(eventType)}** on **${date}** at **${parish.parishName}**: ${err.message}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const availableSlots = Array.isArray(slots) ? slots.filter((s) => s.available) : [];

    if (availableSlots.length === 0) {
      return {
        answer: `There are no available slots for **${humanizeEventType(eventType)}** at **${parish.parishName}** on **${date}**.\n\nPlease check another date or contact the parish office for special arrangements.\n\n${this.formatParishContact(parish)}`,
        liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
      };
    }

    const slotLines = availableSlots.map((s) => `- ⏰ **${s.timeSlot}**`);

    const answer = `Here are the available appointment slots for **${humanizeEventType(eventType)}** at **${parish.parishName}** on **${date}**:\n\n${slotLines.join("\n")}\n\nYou can book any of these slots through the Sacramental Scheduling module.`;

    return {
      answer,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString(), parishId: pId },
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
      const tracking = r.trackingNumber || `ID #${r.id}`;
      return `- **${tracking}**: ${doc} at ${parishName} — **${statusLabel}**`;
    });

    const answer = `You currently have **${userRequests.length}** recent document requests:\n\n${requestLines.join("\n")}\n\nTo check detailed remarks for a specific request, you can ask: *"What is the status of ${userRequests[0].trackingNumber || 'your tracking number'}?"*`;

    return {
      answer,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
    };
  }

  formatSingleRequestStatus(request) {
    const docName = humanizeDocumentType(request.documentType);
    const parishName = request.parish?.parishName || "your parish";
    const statusLabel = humanizeDocumentStatus(request.status);
    const tracking = request.trackingNumber || `ID #${request.id}`;

    let statusExplanation = "";
    switch (request.status) {
      case "PENDING":
      case "UNDER_REVIEW":
        statusExplanation = "Parish staff are reviewing your submitted documents and information.";
        break;
      case "NEEDS_CORRECTION":
        statusExplanation = `Your request requires correction: ${request.correctionNote || "Please review the requirements in your dashboard and upload the requested documents."}`;
        break;
      case "PAYMENT_PENDING":
        statusExplanation = "Your request has been reviewed and is awaiting payment submission.";
        break;
      case "PAYMENT_UNDER_REVIEW":
        statusExplanation = "Parish staff are reviewing your submitted payment proof.";
        break;
      case "PAYMENT_NEEDS_CORRECTION":
        statusExplanation = `Your payment proof requires correction: ${request.paymentCorrectionNote || "Please upload a clearer receipt photo or reference number."}`;
        break;
      case "PAYMENT_VERIFIED":
      case "PROCESSING":
        statusExplanation = "Your payment has been verified. The parish office is currently preparing your certificate.";
        break;
      case "READY_FOR_PICKUP":
        statusExplanation = "🎉 Your certificate is printed and ready for pickup at the parish office during regular office hours! Please bring your valid ID.";
        break;
      case "COMPLETED":
        statusExplanation = "This request has been fulfilled and completed.";
        break;
      case "REJECTED":
        statusExplanation = `This request was rejected by the parish office: ${request.remarks || "Please contact the parish office for further details."}`;
        break;
      case "CANCELLED":
        statusExplanation = "This request was cancelled.";
        break;
      default:
        statusExplanation = "Your request is being processed.";
    }

    const dateStr = request.dateRequested ? new Date(request.dateRequested).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recently";

    const answer = `Your request for a **${docName}** (**${tracking}**) at **${parishName}** is currently **${statusLabel}**.\n\n${statusExplanation}\n\n*Date Requested: ${dateStr}*`;

    return {
      answer,
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
            return `- **${r.trackingNumber || `ID #${r.id}`}**: ${humanizeDocumentType(r.documentType)} — Payment: **${pStatus}** (${rStatus})`;
          });

          return {
            answer: `You have multiple requests with payment activity:\n\n${lines.join("\n")}\n\nTo check a specific one, please ask: *"Is my payment for ${paymentRelated[0].trackingNumber || 'your tracking number'} verified?"*`,
            liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
          };
        } else {
          targetRequest = requests[0];
        }
      }
    }

    const docName = humanizeDocumentType(targetRequest.documentType);
    const tracking = targetRequest.trackingNumber || `ID #${targetRequest.id}`;
    const pStatus = humanizePaymentStatus(targetRequest.paymentStatus);
    const rStatus = humanizeDocumentStatus(targetRequest.status);

    let paymentExplanation = "";
    if (targetRequest.status === "PAYMENT_UNDER_REVIEW" || targetRequest.paymentStatus === "PROOF_SUBMITTED") {
      paymentExplanation = "Your payment proof was received and is currently under review by parish staff. Verification typically takes 1 business day.";
    } else if (targetRequest.status === "PAYMENT_NEEDS_CORRECTION") {
      paymentExplanation = `Your payment proof requires correction: ${targetRequest.paymentCorrectionNote || "Please submit a clear screenshot with visible transaction reference number."}`;
    } else if (targetRequest.status === "PAYMENT_VERIFIED" || targetRequest.paymentStatus === "CONFIRMED") {
      paymentExplanation = "✅ Your payment has been verified by the parish office! Your certificate is currently being prepared.";
    } else if (targetRequest.paymentStatus === "UNPAID") {
      paymentExplanation = `Your payment is currently unpaid. The amount due is ₱${targetRequest.fee ? Number(targetRequest.fee).toFixed(2) : "0.00"}. You can upload your payment proof in your dashboard.`;
    } else {
      paymentExplanation = `Current payment state is ${pStatus}.`;
    }

    const answer = `Payment status for **${docName}** (**${tracking}**):\n\n- **Payment State:** ${pStatus}\n- **Request State:** ${rStatus}\n\n${paymentExplanation}`;

    return {
      answer,
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
      const celebrant = s.assignedPriest?.fullName ? ` (Celebrant: Fr. ${s.assignedPriest.fullName})` : "";

      return `- 📅 **${eventTitle}** at **${parishName}**\n  - Date: ${dateStr}\n  - Status: **${statusLabel}**${celebrant}`;
    });

    const answer = `Here are your upcoming sacramental appointments:\n\n${scheduleLines.join("\n\n")}`;

    return {
      answer,
      liveData: { label: "Current TESTIMONIUM Data", asOf: new Date().toISOString() },
    };
  }

  /**
   * Universal executor for any tool in the registry
   */
  async execute(toolId, params = {}, user = null) {
    const contextUser = user || (params.userId ? { id: params.userId } : null);
    const mergedParams = { ...params, userId: contextUser?.id || null };

    switch (toolId) {
      case TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS:
        return this.getActiveParishPriests({ parishId: mergedParams.parishId });
      case TOOL_IDS.GET_PARISH_DOCUMENTS:
        return this.getParishDocuments({ parishId: mergedParams.parishId });
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


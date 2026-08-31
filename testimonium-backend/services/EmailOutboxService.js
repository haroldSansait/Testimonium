import { prisma } from "../config/db.js";
import { formatManilaTimeSlot } from "./ConflictHelper.js";
import { resolveEventMetadata } from "../shared/EventTypeCatalog.js";

const validEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export class EmailOutboxService {
  static async enqueueDocumentReady(requestId, oldStatus, newStatus, tx = null) {
    if (oldStatus === "READY_FOR_PICKUP" || newStatus !== "READY_FOR_PICKUP") return null;
    const client = tx || prisma;
    const request = await client.documentRequest.findUnique({
      where: { id: Number(requestId) },
      include: {
        user: { select: { fullName: true, email: true } },
        parish: { select: { parishName: true } },
      },
    });
    if (!request) return null;
    return this.enqueue({
      transitionKey: `document:${request.id}:ready:${request.updatedAt.toISOString()}`,
      recipientEmail: request.user.email,
      emailType: "DOCUMENT_READY_FOR_PICKUP",
      referenceType: "DOCUMENT_REQUEST",
      referenceId: request.id,
      payload: {
        recipientName: request.user.fullName,
        parishName: request.parish.parishName,
        trackingNumber: request.trackingNumber,
        documentType: request.documentType,
      },
    }, client);
  }

  static async enqueueScheduleTransition(schedule, oldStatus, transitionVersion, tx = null) {
    const client = tx || prisma;
    let emailType = null;
    let transitionKey = null;
    if (!oldStatus && ["PENDING", "REQUESTED"].includes(schedule.status)) {
      emailType = "SCHEDULE_SUBMITTED";
      transitionKey = `schedule:${schedule.id}:submitted`;
    } else if (["PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE"].includes(schedule.status)) {
      emailType = "SCHEDULE_PROPOSED_RESCHEDULE";
      transitionKey = `schedule:${schedule.id}:proposal:${schedule.proposalVersion}`;
    } else if (oldStatus !== "CONFIRMED" && schedule.status === "CONFIRMED") {
      emailType = "SCHEDULE_CONFIRMED";
      transitionKey = `schedule:${schedule.id}:confirmed:${transitionVersion}`;
    }
    if (!emailType) return null;

    const full = schedule.user?.email && schedule.parish?.parishName
      ? schedule
      : await client.schedule.findUnique({
          where: { id: schedule.id },
          include: {
            user: { select: { fullName: true, email: true } },
            parish: { select: { parishName: true } },
          },
        });
    if (!full) return null;
    return this.enqueue({
      transitionKey,
      recipientEmail: full.user.email,
      emailType,
      referenceType: "SCHEDULE_REQUEST",
      referenceId: full.id,
      payload: {
        recipientName: full.user.fullName,
        parishName: full.parish.parishName,
        serviceLabel: resolveEventMetadata(full.eventType)?.title || full.displayTitle || full.eventType,
        requestedDate: full.requestedDate,
        proposedDate: full.proposedDate,
        timeSlot: formatManilaTimeSlot(full.proposedStartDatetime || full.startDatetime),
        location: full.location,
      },
    }, client);
  }

  static async enqueue(data, client = prisma) {
    const invalidRecipient = !validEmail(data.recipientEmail);
    return client.emailOutbox.upsert({
      where: { transitionKey: data.transitionKey },
      update: {},
      create: {
        ...data,
        status: invalidRecipient ? "FAILED" : "QUEUED",
        lastError: invalidRecipient ? "Invalid recipient email address." : null,
      },
    });
  }
}

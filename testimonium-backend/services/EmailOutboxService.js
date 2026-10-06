import { prisma } from "../config/db.js";
import { formatManilaTimeSlot } from "./ConflictHelper.js";
import { resolveEventMetadata } from "../shared/EventTypeCatalog.js";

const validEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function resolveAuthoritativePreference(user, userId, client) {
  if (user && typeof user.emailNotificationsEnabled === "boolean") {
    return user.emailNotificationsEnabled;
  }
  const idToLookup = userId || user?.id;
  if (!idToLookup || typeof client?.user?.findUnique !== "function") return false; // Fail-closed

  const record = await client.user.findUnique({
    where: { id: Number(idToLookup) },
    select: { emailNotificationsEnabled: true },
  });

  if (record && typeof record.emailNotificationsEnabled === "boolean") {
    return record.emailNotificationsEnabled;
  }
  return false; // Fail-closed
}

export class EmailOutboxService {
  static async enqueueDocumentReady(requestId, oldStatus, newStatus, tx = null) {
    return this.enqueueDocumentTransition({ requestId, oldStatus, newStatus }, tx);
  }

  static async enqueueDocumentTransition({ requestId, oldStatus, newStatus, historyId = null, request = null, correctionContext = null }, tx = null) {
    const client = tx || prisma;
    let emailType = null;
    let transitionKey = null;

    if (oldStatus === "DRAFT" && newStatus === "PENDING") {
      emailType = "DOCUMENT_SUBMITTED";
      transitionKey = `document:${requestId}:submitted`;
    } else if (oldStatus !== "NEEDS_CORRECTION" && newStatus === "NEEDS_CORRECTION") {
      emailType = "DOCUMENT_NEEDS_CORRECTION";
      transitionKey = historyId
        ? `document:${requestId}:correction:${historyId}`
        : `document:${requestId}:correction:${new Date().toISOString()}`;
    } else if (oldStatus !== "PAYMENT_NEEDS_CORRECTION" && newStatus === "PAYMENT_NEEDS_CORRECTION") {
      emailType = "DOCUMENT_PAYMENT_NEEDS_CORRECTION";
      transitionKey = historyId
        ? `document:${requestId}:payment-correction:${historyId}`
        : `document:${requestId}:payment-correction:${new Date().toISOString()}`;
    } else if (oldStatus !== "READY_FOR_PICKUP" && newStatus === "READY_FOR_PICKUP") {
      emailType = "DOCUMENT_READY_FOR_PICKUP";
    }

    if (!emailType) return null;

    const full = (request?.user?.email && request?.parish?.parishName)
      ? request
      : await client.documentRequest.findUnique({
          where: { id: Number(requestId) },
          include: {
            user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
            parish: { select: { parishName: true } },
          },
        });

    if (!full) return null;

    if (emailType === "DOCUMENT_READY_FOR_PICKUP") {
      transitionKey = `document:${full.id}:ready:${full.updatedAt ? full.updatedAt.toISOString() : new Date().toISOString()}`;
    }

    const enabled = await resolveAuthoritativePreference(full.user, full.userId, client);
    if (!enabled) return null;

    return this.enqueue({
      transitionKey,
      recipientEmail: full.user.email,
      emailType,
      referenceType: "DOCUMENT_REQUEST",
      referenceId: full.id,
      payload: {
        recipientName: full.user.fullName,
        parishName: full.parish.parishName,
        trackingNumber: full.trackingNumber,
        documentType: full.documentType,
        correctionContext: correctionContext || null,
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

    const full = (schedule.user?.email && schedule.parish?.parishName)
      ? schedule
      : await client.schedule.findUnique({
          where: { id: schedule.id },
          include: {
            user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
            parish: { select: { parishName: true } },
          },
        });
    if (!full) return null;

    const enabled = await resolveAuthoritativePreference(full.user, full.userId, client);
    if (!enabled) return null;

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

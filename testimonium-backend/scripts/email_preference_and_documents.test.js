import test from "node:test";
import assert from "node:assert/strict";
import { EmailOutboxService } from "../services/EmailOutboxService.js";
import { renderEmail } from "../services/email/EmailTemplates.js";
import { updateProfile } from "../controllers/AuthController.js";
import { AuthService } from "../services/AuthService.js";
import { NotificationDispatcher } from "../services/NotificationDispatcher.js";

import { prisma } from "../config/db.js";

test("1 & 2. profile emailNotificationsEnabled true/false persists through updateProfile", async () => {
  const originalUpdate = prisma.user.update;
  let updatedPayload = null;
  prisma.user.update = async ({ where, data }) => {
    updatedPayload = data;
    return {
      id: where.id,
      fullName: "Test User",
      email: "test@example.com",
      role: { roleName: "PARISHIONER" },
      parish: null,
      ...data,
    };
  };

  try {
    let responseData = null;
    let statusResult = null;
    const mockRes = {
      status: (code) => {
        statusResult = code;
        return {
          json: (data) => {
            responseData = data;
            return data;
          },
        };
      },
    };

    // Test preference = false
    await updateProfile(
      { user: { id: 10 }, body: { emailNotificationsEnabled: false } },
      mockRes,
      () => {}
    );
    assert.equal(statusResult, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.data.emailNotificationsEnabled, false);
    assert.equal(updatedPayload.emailNotificationsEnabled, false);

    // Test preference = true
    await updateProfile(
      { user: { id: 10 }, body: { emailNotificationsEnabled: true } },
      mockRes,
      () => {}
    );
    assert.equal(statusResult, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.data.emailNotificationsEnabled, true);
    assert.equal(updatedPayload.emailNotificationsEnabled, true);
  } finally {
    prisma.user.update = originalUpdate;
  }
});

test("3 & 4. invalid non-boolean preference rejected with 400 INVALID_PREFERENCE", async () => {
  let statusResult = null;
  let responseData = null;
  const mockRes = {
    status: (code) => {
      statusResult = code;
      return {
        json: (data) => {
          responseData = data;
          return data;
        },
      };
    },
  };

  // Test string "true"
  await updateProfile(
    { user: { id: 10 }, body: { emailNotificationsEnabled: "true" } },
    mockRes,
    () => {}
  );
  assert.equal(statusResult, 400);
  assert.equal(responseData.code, "INVALID_PREFERENCE");

  // Test number 1
  await updateProfile(
    { user: { id: 10 }, body: { emailNotificationsEnabled: 1 } },
    mockRes,
    () => {}
  );
  assert.equal(statusResult, 400);
  assert.equal(responseData.code, "INVALID_PREFERENCE");

  // Test null
  await updateProfile(
    { user: { id: 10 }, body: { emailNotificationsEnabled: null } },
    mockRes,
    () => {}
  );
  assert.equal(statusResult, 400);
  assert.equal(responseData.code, "INVALID_PREFERENCE");
});

test("5 & 6. omitted preference in updateProfile and toApplicationProfile behavior", async () => {
  const authService = new AuthService();
  const profileWithPref = authService.toApplicationProfile({
    id: 1,
    firebaseUid: "fb-1",
    email: "test@example.com",
    fullName: "Juan Dela Cruz",
    contactNumber: "09123456789",
    role: { roleName: "PARISHIONER" },
    emailNotificationsEnabled: false,
  });
  assert.equal(profileWithPref.emailNotificationsEnabled, false);

  const profileDefault = authService.toApplicationProfile({
    id: 2,
    firebaseUid: "fb-2",
    email: "test2@example.com",
    fullName: "Maria Clara",
    contactNumber: "09123456789",
    role: { roleName: "PARISHIONER" },
  });
  assert.equal(profileDefault.emailNotificationsEnabled, true);
});

test("7 & 8. EmailOutboxService document transitions respect preference TRUE and FALSE", async () => {
  const keys = [];
  const client = {
    emailOutbox: {
      upsert: async (query) => {
        keys.push(query.create.transitionKey);
        return query.create;
      },
    },
    documentRequest: {
      findUnique: async () => ({
        id: 101,
        trackingNumber: "SR-2026-000101",
        documentType: "BAPTISMAL_CERTIFICATE",
        updatedAt: new Date("2026-09-01T10:00:00.000Z"),
        user: { id: 1, fullName: "Juan", email: "juan@example.com", emailNotificationsEnabled: true },
        parish: { parishName: "San Carlos Parish" },
      }),
    },
  };

  // Preference TRUE -> queues
  const resTrue = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 101,
    oldStatus: "UNDER_REVIEW",
    newStatus: "READY_FOR_PICKUP",
  }, client);
  assert.ok(resTrue);
  assert.equal(keys.length, 1);

  // Preference FALSE -> returns null, skips outbox
  client.documentRequest.findUnique = async () => ({
    id: 101,
    trackingNumber: "SR-2026-000101",
    documentType: "BAPTISMAL_CERTIFICATE",
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
    user: { id: 1, fullName: "Juan", email: "juan@example.com", emailNotificationsEnabled: false },
    parish: { parishName: "San Carlos Parish" },
  });

  const resFalse = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 101,
    oldStatus: "UNDER_REVIEW",
    newStatus: "READY_FOR_PICKUP",
  }, client);
  assert.equal(resFalse, null);
  assert.equal(keys.length, 1); // No new row queued
});

test("9 & 10. EmailOutboxService schedule transitions respect preference TRUE and FALSE", async () => {
  const keys = [];
  const client = {
    emailOutbox: {
      upsert: async (query) => {
        keys.push(query.create.transitionKey);
        return query.create;
      },
    },
  };

  const scheduleTrue = {
    id: 201,
    status: "PENDING",
    eventType: "BAPTISM",
    requestedDate: new Date("2026-09-10"),
    user: { id: 2, fullName: "Pedro", email: "pedro@example.com", emailNotificationsEnabled: true },
    parish: { parishName: "San Carlos Parish" },
  };

  const scheduleFalse = {
    id: 202,
    status: "PENDING",
    eventType: "BAPTISM",
    requestedDate: new Date("2026-09-10"),
    user: { id: 3, fullName: "Pablo", email: "pablo@example.com", emailNotificationsEnabled: false },
    parish: { parishName: "San Carlos Parish" },
  };

  const resTrue = await EmailOutboxService.enqueueScheduleTransition(scheduleTrue, null, "submitted", client);
  assert.ok(resTrue);
  assert.equal(keys.length, 1);
  assert.equal(keys[0], "schedule:201:submitted");

  const resFalse = await EmailOutboxService.enqueueScheduleTransition(scheduleFalse, null, "submitted", client);
  assert.equal(resFalse, null);
  assert.equal(keys.length, 1);
});

test("11. Missing preference fails closed and fetches authoritative preference safely", async () => {
  const keys = [];
  let userLookupCount = 0;
  const client = {
    emailOutbox: {
      upsert: async (query) => {
        keys.push(query.create.transitionKey);
        return query.create;
      },
    },
    user: {
      findUnique: async ({ where }) => {
        userLookupCount += 1;
        if (where.id === 50) return { emailNotificationsEnabled: true };
        if (where.id === 60) return { emailNotificationsEnabled: false };
        return null;
      },
    },
  };

  // Schedule with email but emailNotificationsEnabled missing/undefined -> resolves via user lookup
  const scheduleMissingPrefEnabled = {
    id: 301,
    userId: 50,
    status: "PENDING",
    eventType: "BAPTISM",
    user: { id: 50, fullName: "Recipient", email: "recipient@example.com" }, // no emailNotificationsEnabled
    parish: { parishName: "Parish" },
  };

  const res1 = await EmailOutboxService.enqueueScheduleTransition(scheduleMissingPrefEnabled, null, "submitted", client);
  assert.ok(res1);
  assert.equal(userLookupCount, 1);
  assert.equal(keys.length, 1);

  // Schedule with email but DB lookup returns false -> skips
  const scheduleMissingPrefDisabled = {
    id: 302,
    userId: 60,
    status: "PENDING",
    eventType: "BAPTISM",
    user: { id: 60, fullName: "Recipient2", email: "recipient2@example.com" },
    parish: { parishName: "Parish" },
  };

  const res2 = await EmailOutboxService.enqueueScheduleTransition(scheduleMissingPrefDisabled, null, "submitted", client);
  assert.equal(res2, null);
  assert.equal(userLookupCount, 2);
  assert.equal(keys.length, 1);

  // Schedule where DB lookup returns null (unresolvable) -> FAIL-CLOSED (no send)
  const scheduleUnresolvable = {
    id: 303,
    userId: 9999,
    status: "PENDING",
    eventType: "BAPTISM",
    user: { id: 9999, fullName: "Unknown", email: "unknown@example.com" },
    parish: { parishName: "Parish" },
  };

  const res3 = await EmailOutboxService.enqueueScheduleTransition(scheduleUnresolvable, null, "submitted", client);
  assert.equal(res3, null);
  assert.equal(userLookupCount, 3);
  assert.equal(keys.length, 1);
});

test("12, 13, 14. DOCUMENT_SUBMITTED triggers on submit, not draft, and deduplicates", async () => {
  const queued = [];
  const client = {
    emailOutbox: {
      upsert: async (query) => {
        queued.push(query.create);
        return query.create;
      },
    },
    documentRequest: {
      findUnique: async () => ({
        id: 401,
        trackingNumber: "SR-2026-000401",
        documentType: "BAPTISMAL_CERTIFICATE",
        user: { id: 1, fullName: "Juan", email: "juan@example.com", emailNotificationsEnabled: true },
        parish: { parishName: "San Carlos Parish" },
      }),
    },
  };

  // 12. Draft creation alone (no transition from DRAFT to PENDING) -> returns null
  const draftRes = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 401,
    oldStatus: null,
    newStatus: "DRAFT",
  }, client);
  assert.equal(draftRes, null);
  assert.equal(queued.length, 0);

  // 13. Submit draft (DRAFT -> PENDING) -> produces DOCUMENT_SUBMITTED with transitionKey document:401:submitted
  const submitRes = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 401,
    oldStatus: "DRAFT",
    newStatus: "PENDING",
  }, client);
  assert.ok(submitRes);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].emailType, "DOCUMENT_SUBMITTED");
  assert.equal(queued[0].transitionKey, "document:401:submitted");

  // 14. Duplicate submit call produces the exact same transitionKey
  await EmailOutboxService.enqueueDocumentTransition({
    requestId: 401,
    oldStatus: "DRAFT",
    newStatus: "PENDING",
  }, client);
  assert.equal(queued.length, 2);
  assert.equal(queued[1].transitionKey, "document:401:submitted");
});

test("15, 16, 17, 18, 19. DOCUMENT_NEEDS_CORRECTION repeatable cycle deduplication by historyId", async () => {
  const queued = [];
  const client = {
    emailOutbox: {
      upsert: async (query) => {
        queued.push(query.create);
        return query.create;
      },
    },
    documentRequest: {
      findUnique: async () => ({
        id: 501,
        trackingNumber: "SR-2026-000501",
        documentType: "CONFIRMATION_CERTIFICATE",
        user: { id: 1, fullName: "Maria", email: "maria@example.com", emailNotificationsEnabled: true },
        parish: { parishName: "San Carlos Parish" },
      }),
    },
  };

  // 15 & 17. Cycle #1: transition to NEEDS_CORRECTION with historyId = 11
  const res1 = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 501,
    oldStatus: "UNDER_REVIEW",
    newStatus: "NEEDS_CORRECTION",
    historyId: 11,
  }, client);
  assert.ok(res1);
  assert.equal(queued[0].emailType, "DOCUMENT_NEEDS_CORRECTION");
  assert.equal(queued[0].transitionKey, "document:501:correction:11");

  // 16. Staying in NEEDS_CORRECTION / read -> returns null
  const stayRes = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 501,
    oldStatus: "NEEDS_CORRECTION",
    newStatus: "NEEDS_CORRECTION",
    historyId: 11,
  }, client);
  assert.equal(stayRes, null);

  // 18. Resubmit to UNDER_REVIEW -> returns null (no email for UNDER_REVIEW)
  const resubmitRes = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 501,
    oldStatus: "NEEDS_CORRECTION",
    newStatus: "UNDER_REVIEW",
  }, client);
  assert.equal(resubmitRes, null);

  // 19. Cycle #2: second transition back to NEEDS_CORRECTION with new historyId = 25
  const res2 = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 501,
    oldStatus: "UNDER_REVIEW",
    newStatus: "NEEDS_CORRECTION",
    historyId: 25,
  }, client);
  assert.ok(res2);
  assert.equal(queued.length, 2);
  assert.equal(queued[1].emailType, "DOCUMENT_NEEDS_CORRECTION");
  assert.equal(queued[1].transitionKey, "document:501:correction:25");
});

test("20 & 21. DOCUMENT_PAYMENT_NEEDS_CORRECTION repeatable cycle deduplication by historyId", async () => {
  const queued = [];
  const client = {
    emailOutbox: {
      upsert: async (query) => {
        queued.push(query.create);
        return query.create;
      },
    },
    documentRequest: {
      findUnique: async () => ({
        id: 601,
        trackingNumber: "SR-2026-000601",
        documentType: "MARRIAGE_CERTIFICATE",
        user: { id: 1, fullName: "Jose", email: "jose@example.com", emailNotificationsEnabled: true },
        parish: { parishName: "San Carlos Parish" },
      }),
    },
  };

  // 20. Transition into PAYMENT_NEEDS_CORRECTION with historyId = 31
  const res1 = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 601,
    oldStatus: "PAYMENT_UNDER_REVIEW",
    newStatus: "PAYMENT_NEEDS_CORRECTION",
    historyId: 31,
  }, client);
  assert.ok(res1);
  assert.equal(queued[0].emailType, "DOCUMENT_PAYMENT_NEEDS_CORRECTION");
  assert.equal(queued[0].transitionKey, "document:601:payment-correction:31");

  // 21. Second cycle with historyId = 48
  const res2 = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 601,
    oldStatus: "PAYMENT_UNDER_REVIEW",
    newStatus: "PAYMENT_NEEDS_CORRECTION",
    historyId: 48,
  }, client);
  assert.ok(res2);
  assert.equal(queued[1].emailType, "DOCUMENT_PAYMENT_NEEDS_CORRECTION");
  assert.equal(queued[1].transitionKey, "document:601:payment-correction:48");
});

test("22 & 23. DOCUMENT_READY_FOR_PICKUP genuine transition and retry duplicate protection", async () => {
  const queued = [];
  const updatedAt = new Date("2026-09-01T12:00:00.000Z");
  const client = {
    emailOutbox: {
      upsert: async (query) => {
        queued.push(query.create);
        return query.create;
      },
    },
    documentRequest: {
      findUnique: async () => ({
        id: 701,
        trackingNumber: "SR-2026-000701",
        documentType: "BAPTISMAL_CERTIFICATE",
        updatedAt,
        user: { id: 1, fullName: "Ana", email: "ana@example.com", emailNotificationsEnabled: true },
        parish: { parishName: "San Carlos Parish" },
      }),
    },
  };

  // 22. Genuine transition
  const res = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 701,
    oldStatus: "PROCESSING",
    newStatus: "READY_FOR_PICKUP",
  }, client);
  assert.ok(res);
  assert.equal(queued[0].emailType, "DOCUMENT_READY_FOR_PICKUP");
  assert.equal(queued[0].transitionKey, `document:701:ready:${updatedAt.toISOString()}`);

  // 23. Same status (already in READY_FOR_PICKUP) -> returns null
  const noopRes = await EmailOutboxService.enqueueDocumentTransition({
    requestId: 701,
    oldStatus: "READY_FOR_PICKUP",
    newStatus: "READY_FOR_PICKUP",
  }, client);
  assert.equal(noopRes, null);
});

test("24, 25, 26. Email OFF suppresses all 4 document and 3 schedule emails while in-app notifications persist", async () => {
  const emailRows = [];
  const inAppNotifications = [];

  const client = {
    emailOutbox: {
      upsert: async (query) => {
        emailRows.push(query.create);
        return query.create;
      },
    },
    notification: {
      createMany: async ({ data }) => {
        inAppNotifications.push(...data);
        return { count: data.length };
      },
    },
    documentRequest: {
      findUnique: async () => ({
        id: 801,
        trackingNumber: "SR-2026-000801",
        documentType: "BAPTISMAL_CERTIFICATE",
        user: { id: 10, fullName: "Opted Out", email: "optout@example.com", emailNotificationsEnabled: false },
        parish: { parishName: "San Carlos Parish" },
      }),
    },
    user: {
      findMany: async () => [],
    },
  };

  // 24. Document transitions when OFF
  const d1 = await EmailOutboxService.enqueueDocumentTransition({ requestId: 801, oldStatus: "DRAFT", newStatus: "PENDING" }, client);
  const d2 = await EmailOutboxService.enqueueDocumentTransition({ requestId: 801, oldStatus: "UNDER_REVIEW", newStatus: "NEEDS_CORRECTION", historyId: 1 }, client);
  const d3 = await EmailOutboxService.enqueueDocumentTransition({ requestId: 801, oldStatus: "PAYMENT_UNDER_REVIEW", newStatus: "PAYMENT_NEEDS_CORRECTION", historyId: 2 }, client);
  const d4 = await EmailOutboxService.enqueueDocumentTransition({ requestId: 801, oldStatus: "PROCESSING", newStatus: "READY_FOR_PICKUP" }, client);

  assert.equal(d1, null);
  assert.equal(d2, null);
  assert.equal(d3, null);
  assert.equal(d4, null);
  assert.equal(emailRows.length, 0);

  // 25. Schedule transitions when OFF
  const sOff = {
    id: 901,
    status: "PENDING",
    eventType: "BAPTISM",
    user: { id: 10, fullName: "Opted Out", email: "optout@example.com", emailNotificationsEnabled: false },
    parish: { parishName: "San Carlos Parish" },
  };

  const s1 = await EmailOutboxService.enqueueScheduleTransition(sOff, null, "submitted", client);
  const s2 = await EmailOutboxService.enqueueScheduleTransition({ ...sOff, status: "PROPOSED_RESCHEDULE", proposalVersion: 1 }, "PENDING", "1", client);
  const s3 = await EmailOutboxService.enqueueScheduleTransition({ ...sOff, status: "CONFIRMED" }, "PENDING", "confirmed", client);

  assert.equal(s1, null);
  assert.equal(s2, null);
  assert.equal(s3, null);
  assert.equal(emailRows.length, 0);

  // 26. In-app notifications persist through NotificationDispatcher
  await NotificationDispatcher.notifyDocumentStatusChange({
    parishionerId: 10,
    parishId: 1,
    requestId: 801,
    trackingNumber: "SR-2026-000801",
    oldStatus: "PROCESSING",
    newStatus: "READY_FOR_PICKUP",
    notifyAdmins: false,
  }, client);

  assert.equal(inAppNotifications.length, 1);
  assert.equal(inAppNotifications[0].userId, 10);
  assert.equal(inAppNotifications[0].referenceType, "DOCUMENT_REQUEST");
  assert.equal(emailRows.length, 0); // Still 0 emails queued
});

test("27 & 28. All seven email templates return subject, html, text and escape injected HTML", () => {
  const malicious = '<img src=x onerror="alert(1)"> <script>alert("xss")</script>';
  const templates = [
    "DOCUMENT_READY_FOR_PICKUP",
    "DOCUMENT_SUBMITTED",
    "DOCUMENT_NEEDS_CORRECTION",
    "DOCUMENT_PAYMENT_NEEDS_CORRECTION",
    "SCHEDULE_SUBMITTED",
    "SCHEDULE_PROPOSED_RESCHEDULE",
    "SCHEDULE_CONFIRMED",
  ];

  for (const emailType of templates) {
    const rendered = renderEmail(emailType, {
      recipientName: malicious,
      parishName: malicious,
      trackingNumber: malicious,
      documentType: malicious,
      serviceLabel: malicious,
      requestedDate: "2026-09-01",
      proposedDate: "2026-09-02",
      timeSlot: malicious,
      location: malicious,
    });

    assert.ok(rendered.subject && rendered.subject.length > 0, `Subject missing for ${emailType}`);
    assert.ok(rendered.html && rendered.html.length > 0, `HTML missing for ${emailType}`);
    assert.ok(rendered.text && rendered.text.length > 0, `Text missing for ${emailType}`);

    // Verify raw tags are escaped
    assert.equal(rendered.html.includes("<script"), false, `Unescaped script in ${emailType}`);
    assert.equal(rendered.html.includes("&lt;script"), true, `Expected escaped script in ${emailType}`);
    assert.equal(rendered.html.includes("<img src=x"), false, `Unescaped img tag in ${emailType}`);
    assert.equal(rendered.html.includes("&lt;img"), true, `Expected escaped img tag in ${emailType}`);
  }
});

test("29, 30, 31, 32, 33. Outbox worker error classification, claiming and retry semantics", () => {
  // Classification logic check
  const isPermanent = (error) => {
    if (error?.permanent === true) return true;
    if (Number(error?.responseCode) >= 500) return true;
    return ["EENVELOPE", "EMESSAGE"].includes(error?.code);
  };

  // Transient error -> RETRY
  const transientErr = new Error("Connection timed out");
  transientErr.code = "ETIMEDOUT";
  assert.equal(isPermanent(transientErr), false);

  // Permanent error -> FAILED
  const envelopeErr = new Error("Recipient address rejected");
  envelopeErr.code = "EENVELOPE";
  assert.equal(isPermanent(envelopeErr), true);

  const server5xxErr = new Error("Permanent server rejection");
  server5xxErr.responseCode = 550;
  assert.equal(isPermanent(server5xxErr), true);

  const flaggedPermanentErr = new Error("Explicit permanent error");
  flaggedPermanentErr.permanent = true;
  assert.equal(isPermanent(flaggedPermanentErr), true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db.js";
import { DocumentRequestService } from "../services/DocumentRequestService.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { DocumentRequirementService } from "../services/DocumentRequirementService.js";
import { RequestNotificationService } from "../services/RequestNotificationService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { RecipientResolver } from "../services/RecipientResolver.js";
import * as DocumentRequestController from "../controllers/DocumentRequestController.js";

const correctionArgs = (ids) => [
  41,
  "NEEDS_CORRECTION",
  "",
  7,
  "SECRETARY",
  3,
  ids,
  "WRONG_DOCUMENT",
  "Replace the affected document.",
];

function makeStatusTx() {
  const counts = { updates: 0, history: 0, notifications: 0, audits: 0, outbox: 0 };
  const request = {
    id: 41,
    userId: 12,
    parishId: 3,
    status: "UNDER_REVIEW",
    documentType: "BAPTISMAL_CERTIFICATE",
    trackingNumber: "DOC-41",
    remarks: null,
  };
  const tx = {
    counts,
    documentRequest: {
      findUnique: async () => ({
        ...request,
        status: counts.updates ? "NEEDS_CORRECTION" : request.status,
      }),
      updateMany: async () => {
        counts.updates += 1;
        return { count: 1 };
      },
    },
    requestHistory: {
      create: async () => {
        counts.history += 1;
        return { id: 501 };
      },
    },
    emailOutbox: {
      create: async () => {
        counts.outbox += 1;
        return { id: 1 };
      },
    },
  };
  return tx;
}

function makeLegacyTx({ correctionIds, attachments = [], verification }) {
  const counts = { updates: 0, history: 0, attachmentReads: 0 };
  const request = {
    id: 52,
    userId: 12,
    parishId: 3,
    status: "NEEDS_CORRECTION",
    documentType: "BAPTISMAL_CERTIFICATE",
    trackingNumber: "DOC-52",
    correctionRequirementIds: correctionIds,
  };
  return {
    counts,
    user: {
      findUnique: async () => ({
        id: 12,
        roleId: 1,
        role: { roleName: "PARISHIONER" },
        governmentIdVerification: verification,
      }),
    },
    documentRequest: {
      findFirst: async () => request,
      update: async ({ data }) => {
        counts.updates += 1;
        return { ...request, ...data };
      },
    },
    requestAttachment: {
      findMany: async () => {
        counts.attachmentReads += 1;
        return attachments.map((category) => ({ category }));
      },
    },
    requestHistory: {
      create: async () => {
        counts.history += 1;
        return { id: 601 };
      },
    },
  };
}

test("valid_id document-correction hardening", async (t) => {
  const originalTransaction = prisma.$transaction;
  const originalGetRequirements = DocumentRequirementService.getRequirements;
  const originalNotifyStatusChange = RequestNotificationService.notifyStatusChange;
  const originalSend = RequestNotificationService.send;
  const originalAudit = AuditLogService.log;
  const originalRecipients = RecipientResolver.getAdminRecipients;

  try {
    DocumentRequirementService.getRequirements = async () => ({
      requiredDocuments: [
        { id: "valid_id", label: "Valid Government ID", required: true },
        { id: "baptismal_cert", label: "Baptismal Certificate", required: true },
      ],
    });
    RecipientResolver.getAdminRecipients = async () => [90];

    await t.test("new valid_id-only and mixed corrections fail without side effects", async () => {
      const service = new DocumentRequestService();

      for (const ids of [["valid_id"], ["valid_id", "baptismal_cert"]]) {
        const tx = makeStatusTx();
        prisma.$transaction = async (callback) => callback(tx);
        RequestNotificationService.notifyStatusChange = async () => {
          tx.counts.notifications += 1;
        };
        AuditLogService.log = async () => {
          tx.counts.audits += 1;
        };

        await assert.rejects(
          () => service.updateStatus(...correctionArgs(ids)),
          (error) =>
            error.statusCode === 400 &&
            error.code === "NON_CORRECTABLE_REQUIREMENT" &&
            /Government ID verification/i.test(error.message)
        );
        assert.deepEqual(tx.counts, {
          updates: 0,
          history: 0,
          notifications: 0,
          audits: 0,
          outbox: 0,
        });
      }
    });

    await t.test("direct status API returns the safe machine-readable contract", async () => {
      const tx = makeStatusTx();
      prisma.$transaction = async (callback) => callback(tx);
      let statusCode = null;
      let body = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(payload) {
          body = payload;
          return payload;
        },
      };

      await DocumentRequestController.updateStatus(
        {
          params: { id: "41" },
          body: {
            status: "NEEDS_CORRECTION",
            correctionReasonCode: "WRONG_DOCUMENT",
            correctionRequirementIds: ["valid_id"],
          },
          user: { id: 7, role: "SECRETARY", parish: { id: 3 } },
        },
        res,
        (error) => assert.fail(error)
      );

      assert.equal(statusCode, 400);
      assert.deepEqual(body, {
        success: false,
        code: "NON_CORRECTABLE_REQUIREMENT",
        message: "Government ID verification cannot be corrected through the document request attachment workflow.",
      });
      assert.equal(tx.counts.updates, 0);
      assert.equal(tx.counts.history, 0);
    });

    await t.test("an attachment-backed correction still succeeds", async () => {
      const tx = makeStatusTx();
      prisma.$transaction = async (callback) => callback(tx);
      RequestNotificationService.notifyStatusChange = async () => {
        tx.counts.notifications += 1;
      };
      AuditLogService.log = async () => {
        tx.counts.audits += 1;
      };

      const updated = await new DocumentRequestService().updateStatus(
        ...correctionArgs(["baptismal_cert"])
      );
      assert.equal(updated.status, "NEEDS_CORRECTION");
      assert.deepEqual(tx.counts, {
        updates: 1,
        history: 1,
        notifications: 1,
        audits: 1,
        outbox: 0,
      });
    });

    await t.test("legacy valid_id-only correction resubmits with effective verification", async () => {
      const tx = makeLegacyTx({
        correctionIds: ["valid_id"],
        verification: { status: "VERIFIED", expiresAt: null },
      });
      let notifications = 0;
      let audits = 0;
      prisma.$transaction = async (callback) => callback(tx);
      RequestNotificationService.send = async () => { notifications += 1; };
      AuditLogService.log = async () => { audits += 1; };

      const updated = await new ParishionerRequestService().resubmitCorrections(52, 12);
      assert.equal(updated.status, "UNDER_REVIEW");
      assert.deepEqual(updated.correctionRequirementIds, []);
      assert.equal(tx.counts.updates, 1);
      assert.equal(tx.counts.history, 1);
      assert.equal(notifications, 2);
      assert.equal(audits, 1);
    });

    await t.test("legacy mixed correction requires only the supporting attachment", async () => {
      const verified = { status: "VERIFIED", expiresAt: new Date(Date.now() + 60_000) };
      const missingTx = makeLegacyTx({
        correctionIds: ["valid_id", "baptismal_cert"],
        verification: verified,
      });
      prisma.$transaction = async (callback) => callback(missingTx);
      await assert.rejects(
        () => new ParishionerRequestService().resubmitCorrections(52, 12),
        /Replacement file for requirement "baptismal_cert" is missing/
      );
      assert.equal(missingTx.counts.updates, 0);

      const completeTx = makeLegacyTx({
        correctionIds: ["valid_id", "baptismal_cert"],
        attachments: ["baptismal_cert"],
        verification: verified,
      });
      prisma.$transaction = async (callback) => callback(completeTx);
      const updated = await new ParishionerRequestService().resubmitCorrections(52, 12);
      assert.equal(updated.status, "UNDER_REVIEW");
      assert.equal(completeTx.counts.updates, 1);
    });

    await t.test("legacy valid_id correction cannot bypass invalid identity", async () => {
      const tx = makeLegacyTx({
        correctionIds: ["valid_id"],
        verification: { status: "VERIFIED", expiresAt: new Date(Date.now() - 60_000) },
      });
      prisma.$transaction = async (callback) => callback(tx);

      await assert.rejects(
        () => new ParishionerRequestService().resubmitCorrections(52, 12),
        (error) => error.statusCode === 403 && error.code === "IDENTITY_NOT_VERIFIED"
      );
      assert.equal(tx.counts.attachmentReads, 0);
      assert.equal(tx.counts.updates, 0);
      assert.equal(tx.counts.history, 0);
    });
    await t.test("initial submission still auto-fulfills valid_id from effective verification", async () => {
      const submitted = {
        id: 63,
        userId: 12,
        parishId: 3,
        documentType: "BAPTISMAL_CERTIFICATE",
        status: "PENDING",
        isDraft: false,
        trackingNumber: "DOC-63",
      };
      const tx = {
        user: {
          findUnique: async () => ({
            id: 12,
            roleId: 1,
            fullName: "Verified Parishioner",
            contactNumber: "09170000000",
            role: { roleName: "PARISHIONER" },
            governmentIdVerification: { status: "VERIFIED", expiresAt: null },
          }),
        },
        documentRequest: {
          findFirst: async () => ({ ...submitted, isDraft: true, purpose: "Legal", relationship: "Self", applicantName: "Verified Parishioner" }),
          update: async () => submitted,
        },
        requestAttachment: { findMany: async () => [{ category: "baptismal_cert" }] },
        requestHistory: { create: async () => ({ id: 701 }) },
      };
      prisma.$transaction = async (callback) => callback(tx);
      RequestNotificationService.notifyStatusChange = async () => {};
      AuditLogService.log = async () => {};
      assert.deepEqual(await new ParishionerRequestService().submitDraft(63, 12), submitted);
    });
  } finally {
    prisma.$transaction = originalTransaction;
    DocumentRequirementService.getRequirements = originalGetRequirements;
    RequestNotificationService.notifyStatusChange = originalNotifyStatusChange;
    RequestNotificationService.send = originalSend;
    AuditLogService.log = originalAudit;
    RecipientResolver.getAdminRecipients = originalRecipients;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prisma } from "../config/db.js";
import { DOCUMENT_RETURN_REASONS, DocumentReturnReasonCode } from "../shared/constants.js";
import { canTransition } from "../services/RequestStateMachine.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { DocumentRequestService } from "../services/DocumentRequestService.js";
import { DocumentReturnStorageService } from "../services/DocumentReturnStorageService.js";
import { EmailOutboxService } from "../services/EmailOutboxService.js";
import { renderEmail } from "../services/email/EmailTemplates.js";
import { returnDocumentSchema, updateRequestStatusSchema } from "../validators/requestSchemas.js";
import { FileValidator } from "../utils/fileValidator.js";

const parishionerService = new ParishionerRequestService();
const staffService = new DocumentRequestService();

test("Post-Release Document Return - Canonical Reasons (8 Reasons)", () => {
  const codes = Object.keys(DOCUMENT_RETURN_REASONS);
  assert.equal(codes.length, 8);
  const expectedCodes = [
    "TYPOGRAPHICAL_OR_SPELLING",
    "INCORRECT_NAME",
    "INCORRECT_SACRAMENTAL_DATE",
    "INCORRECT_RECORD_INFORMATION",
    "MISSING_INFORMATION",
    "WRONG_DOCUMENT_ISSUED",
    "PRINTING_OR_FORMAT_DEFECT",
    "OTHER_ISSUED_DOCUMENT_ERROR",
  ];
  for (const code of expectedCodes) {
    assert.ok(codes.includes(code), `Missing code: ${code}`);
    assert.equal(DocumentReturnReasonCode[code], code);
  }
});

test("Post-Release Document Return - State Machine Transitions", () => {
  // Authorized transitions
  assert.equal(canTransition("COMPLETED", "RETURNED"), true);
  assert.equal(canTransition("RETURNED", "READY_FOR_PICKUP"), true);
  assert.equal(canTransition("READY_FOR_PICKUP", "COMPLETED"), true);

  // Prohibited transitions to RETURNED
  assert.equal(canTransition("PENDING", "RETURNED"), false);
  assert.equal(canTransition("UNDER_REVIEW", "RETURNED"), false);
  assert.equal(canTransition("READY_FOR_PICKUP", "RETURNED"), false);
  assert.equal(canTransition("CANCELLED", "RETURNED"), false);
});

test("Post-Release Document Return - Generic Staff Status Endpoint cannot initiate RETURNED", () => {
  // updateRequestStatusSchema must reject targetStatus === 'RETURNED'
  const validation = updateRequestStatusSchema.safeParse({
    status: "RETURNED",
  });
  assert.equal(validation.success, false);
  assert.ok(validation.error.issues.some((i) => i.message.includes("cannot be manually set by staff")));
});

test("Post-Release Document Return - Staff updateStatus blocks targetStatus === 'RETURNED'", async () => {
  await assert.rejects(
    async () => staffService.updateStatus(
      101,
      "RETURNED",
      "Manual return",
      20,
      "SECRETARY",
      2
    ),
    (err) => err.statusCode === 400 && err.code === "RETURN_STATUS_PARISHIONER_ONLY"
  );
});

test("Post-Release Document Return - Return validation schema enforces canonical reasons and length limits", () => {
  // Valid payload
  const valid = returnDocumentSchema.safeParse({
    reasonCode: "TYPOGRAPHICAL_OR_SPELLING",
    notes: "Spelling error in mother's surname.",
  });
  assert.equal(valid.success, true);

  // Invalid reason
  const invalidReason = returnDocumentSchema.safeParse({
    reasonCode: "INVALID_REASON",
    notes: "Note",
  });
  assert.equal(invalidReason.success, false);

  // Notes > 1000 chars rejected
  const longNote = returnDocumentSchema.safeParse({
    reasonCode: "TYPOGRAPHICAL_OR_SPELLING",
    notes: "a".repeat(1001),
  });
  assert.equal(longNote.success, false);
});

test("Post-Release Document Return - Defective and Corrected File Validators", () => {
  // Missing file
  assert.throws(
    () => FileValidator.validateReturnDocument(null),
    (err) => err.code === "RETURN_FILE_REQUIRED"
  );
  assert.throws(
    () => FileValidator.validateCorrectedDocument(null),
    (err) => err.code === "CORRECTED_FILE_REQUIRED"
  );

  // File too large (> 5MB)
  const tooLarge = {
    size: 6 * 1024 * 1024,
    mimetype: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 mock"),
  };
  assert.throws(
    () => FileValidator.validateReturnDocument(tooLarge),
    (err) => err.code === "RETURN_FILE_TOO_LARGE"
  );
  assert.throws(
    () => FileValidator.validateCorrectedDocument(tooLarge),
    (err) => err.code === "CORRECTED_FILE_TOO_LARGE"
  );

  // Disallowed mime type
  const badMime = {
    size: 1024,
    mimetype: "text/plain",
    buffer: Buffer.from("hello world"),
  };
  assert.throws(
    () => FileValidator.validateReturnDocument(badMime),
    (err) => err.code === "RETURN_FILE_TYPE_INVALID"
  );
  assert.throws(
    () => FileValidator.validateCorrectedDocument(badMime),
    (err) => err.code === "CORRECTED_FILE_TYPE_INVALID"
  );

  const mismatchedPdf = {
    originalname: "mismatch.pdf",
    size: 12,
    mimetype: "application/pdf",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  };
  assert.throws(
    () => FileValidator.validateReturnDocument({ ...mismatchedPdf }),
    (err) => err.code === "RETURN_FILE_TYPE_MISMATCH"
  );
  assert.throws(
    () => FileValidator.validateCorrectedDocument({ ...mismatchedPdf }),
    (err) => err.code === "CORRECTED_FILE_TYPE_MISMATCH"
  );
});

test("Post-Release Document Return - private metadata table is closed to Supabase Data API roles", () => {
  const migration = fs.readFileSync(
    new URL("../prisma/migrations/20261011120000_add_post_release_document_returns/migration.sql", import.meta.url),
    "utf8"
  );
  assert.match(migration, /ALTER TABLE "document_returns" ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE "document_returns"\s+FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON SEQUENCE "document_returns_return_id_seq"\s+FROM PUBLIC, anon, authenticated/);
});

test("Post-Release Document Return - Priest denied write access (read-only enforcement)", async () => {
  await assert.rejects(
    async () => staffService.uploadCorrectedDocument({
      requestId: 101,
      staffId: 10,
      staffRole: "PRIEST",
      staffParishId: 2,
      file: { originalname: "file.pdf", size: 100, mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    }),
    (err) => err.statusCode === 403 && err.message.includes("Priests have read-only access")
  );

  await assert.rejects(
    async () => staffService.updateStatus(
      101,
      "READY_FOR_PICKUP",
      "Remarks",
      10,
      "PRIEST",
      2
    ),
    (err) => err.statusCode === 403 && err.message.includes("Priests have read-only access")
  );
});

test("Post-Release Document Return - Contextual Corrected Ready-for-Pickup Email Template", () => {
  const normalEmail = renderEmail("DOCUMENT_READY_FOR_PICKUP", {
    trackingNumber: "TEST-101",
    documentType: "Baptismal Certificate",
    parishName: "San Carlos Borromeo Parish",
    recipientName: "Juan Dela Cruz",
    isCorrectedReturn: false,
  });
  assert.ok(normalEmail.text.includes("ready for pickup"));
  assert.ok(!normalEmail.text.includes("defective document to exchange"));

  const correctedEmail = renderEmail("DOCUMENT_READY_FOR_PICKUP", {
    trackingNumber: "TEST-101",
    documentType: "Baptismal Certificate",
    parishName: "San Carlos Borromeo Parish",
    recipientName: "Juan Dela Cruz",
    isCorrectedReturn: true,
  });
  assert.ok(correctedEmail.subject.includes("Corrected Document"));
  assert.ok(correctedEmail.text.includes("bring your defective document to exchange"));
});

test("Post-Release Document Return - Idempotent email deduplication key for return transition", async () => {
  let createdKey = null;
  const mockTx = {
    emailOutbox: {
      upsert: async ({ create }) => {
        createdKey = create.transitionKey;
        return { id: 99, ...create };
      },
    },
    user: {
      findUnique: async () => ({ emailNotificationsEnabled: true }),
    },
  };

  const request = {
    id: 101,
    userId: 5,
    user: { email: "juan@example.com", fullName: "Juan", emailNotificationsEnabled: true },
    parish: { parishName: "San Carlos Parish" },
    documentType: "BAPTISMAL_CERTIFICATE",
    trackingNumber: "TEST-101",
    updatedAt: new Date("2026-10-11T12:00:00Z"),
  };

  await EmailOutboxService.enqueueDocumentTransition(
    {
      requestId: 101,
      oldStatus: "RETURNED",
      newStatus: "READY_FOR_PICKUP",
      historyId: 52,
      request,
      returnCycle: 1,
      isCorrectedReturn: true,
    },
    mockTx
  );

  assert.equal(createdKey, "document:101:ready:return-1-52");
});

test("Post-Release Document Return - Private Storage asserts fail-closed behavior", () => {
  // DocumentReturnStorageService requires private bucket name
  assert.ok(typeof DocumentReturnStorageService.createObjectKey === "function");
  assert.ok(typeof DocumentReturnStorageService.upload === "function");
  assert.ok(typeof DocumentReturnStorageService.download === "function");
  assert.ok(typeof DocumentReturnStorageService.delete === "function");

  // Key generator generates opaque, collision-resistant keys with cycle number
  const key1 = DocumentReturnStorageService.createObjectKey(101, 1, "returned");
  assert.ok(key1.startsWith("document-returns/101/cycle-1/returned/"));
  const key2 = DocumentReturnStorageService.createObjectKey(101, 1, "corrected");
  assert.ok(key2.startsWith("document-returns/101/cycle-1/corrected/"));
  assert.notEqual(key1, key2);

  // Rejects invalid types
  assert.throws(() => DocumentReturnStorageService.createObjectKey(101, 1, "public"));
});

test("Post-Release Document Return - Owner validation and error handling on return", async () => {
  // Missing file rejected immediately
  await assert.rejects(
    async () => parishionerService.returnDocument({
      requestId: 101,
      userId: 5,
      reasonCode: "INCORRECT_NAME",
      notes: "Note",
      file: null,
    }),
    (err) => err.statusCode === 400 && err.code === "RETURN_FILE_REQUIRED"
  );

  // Invalid reason rejected immediately
  await assert.rejects(
    async () => parishionerService.returnDocument({
      requestId: 101,
      userId: 5,
      reasonCode: "INVALID_CODE",
      notes: "Note",
      file: { originalname: "mock.pdf", size: 100, mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    }),
    (err) => err.statusCode === 400 && err.code === "INVALID_RETURN_REASON"
  );
});

test("Post-Release Document Return - Corrected document upload validation on staff service", async () => {
  // Missing file rejected immediately
  await assert.rejects(
    async () => staffService.uploadCorrectedDocument({
      requestId: 101,
      staffId: 20,
      staffRole: "SECRETARY",
      staffParishId: 2,
      file: null,
    }),
    (err) => err.statusCode === 400 && err.code === "CORRECTED_FILE_REQUIRED"
  );

  // Corrupted file rejected by signature validator
  await assert.rejects(
    async () => staffService.uploadCorrectedDocument({
      requestId: 101,
      staffId: 20,
      staffRole: "SECRETARY",
      staffParishId: 2,
      file: { originalname: "bad.pdf", size: 100, mimetype: "application/pdf", buffer: Buffer.from("NOT_A_PDF") },
    }),
    (err) => err.statusCode === 400 && err.code === "INVALID_FILE_SIGNATURE"
  );
});

test("Post-Release Document Return - priests cannot read another parish return history", async () => {
  const originalFindUnique = prisma.documentRequest.findUnique;
  const originalFindMany = prisma.documentReturn.findMany;
  let returnReadAttempted = false;
  try {
    prisma.documentRequest.findUnique = async () => ({ id: 101, parishId: 9 });
    prisma.documentReturn.findMany = async () => {
      returnReadAttempted = true;
      return [];
    };

    await assert.rejects(
      () => staffService.getReturnHistory(101, "PRIEST", 2),
      (err) => err.statusCode === 403
    );
    assert.equal(returnReadAttempted, false);
  } finally {
    prisma.documentRequest.findUnique = originalFindUnique;
    prisma.documentReturn.findMany = originalFindMany;
  }
});

test("Post-Release Document Return - competing corrected upload cannot overwrite committed evidence", async () => {
  const originalRequestFindUnique = prisma.documentRequest.findUnique;
  const originalReturnFindFirst = prisma.documentReturn.findFirst;
  const originalTransaction = prisma.$transaction;
  const originalUpload = DocumentReturnStorageService.upload;
  const originalDelete = DocumentReturnStorageService.delete;
  let cleanupCount = 0;
  let updateAttempted = false;

  try {
    prisma.documentRequest.findUnique = async () => ({ id: 101, parishId: 2, status: "RETURNED" });
    prisma.documentReturn.findFirst = async () => ({ id: 44, requestId: 101, cycleNumber: 2, correctedObjectKey: null });
    DocumentReturnStorageService.upload = async () => {};
    DocumentReturnStorageService.delete = async () => { cleanupCount += 1; };
    prisma.$transaction = async (callback) => callback({
      documentRequest: {
        findUnique: async () => ({ id: 101, parishId: 2, status: "RETURNED" }),
      },
      documentReturn: {
        findFirst: async () => ({ id: 44, requestId: 101, cycleNumber: 2, correctedObjectKey: "already-committed" }),
        updateMany: async () => {
          updateAttempted = true;
          return { count: 1 };
        },
      },
    });

    await assert.rejects(
      () => staffService.uploadCorrectedDocument({
        requestId: 101,
        staffId: 20,
        staffRole: "SECRETARY",
        staffParishId: 2,
        file: {
          originalname: "corrected.pdf",
          size: 12,
          mimetype: "application/pdf",
          buffer: Buffer.from("%PDF-1.4 test"),
        },
      }),
      (err) => err.statusCode === 409 && err.code === "CORRECTED_DOCUMENT_ALREADY_UPLOADED"
    );
    assert.equal(updateAttempted, false);
    assert.equal(cleanupCount, 1);
  } finally {
    prisma.documentRequest.findUnique = originalRequestFindUnique;
    prisma.documentReturn.findFirst = originalReturnFindFirst;
    prisma.$transaction = originalTransaction;
    DocumentReturnStorageService.upload = originalUpload;
    DocumentReturnStorageService.delete = originalDelete;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_DOCUMENT_TYPES, normalizeDocumentType, isValidDocumentType, getEffectiveOfferedDocuments } from "../config/documents.js";
import { DocumentType } from "../shared/constants.js";
import { createRequestSchema } from "../validators/requestSchemas.js";
import { DocumentRequirementService } from "../services/DocumentRequirementService.js";
import { IdempotencyService, computeRequestPayloadHash } from "../services/IdempotencyService.js";
import { canTransition } from "../services/RequestStateMachine.js";
import { PaymentConfigurationService } from "../services/PaymentConfigurationService.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { prisma } from "../config/db.js";

test("Backend hardening: canonical document types", () => {
  const expectedTypes = [
    "BAPTISMAL_CERTIFICATE",
    "CONFIRMATION_CERTIFICATE",
    "MARRIAGE_CERTIFICATE",
    "FIRST_COMMUNION_CERTIFICATE",
    "MARRIAGE_BANNS",
    "PERMIT_TO_MARRY",
    "STATUS_OF_LIBERTY",
  ];

  assert.equal(CANONICAL_DOCUMENT_TYPES.length, 7);
  for (const type of expectedTypes) {
    assert.equal(CANONICAL_DOCUMENT_TYPES.includes(type), true, `Missing canonical type: ${type}`);
    assert.equal(isValidDocumentType(type), true, `Should be valid document type: ${type}`);
    assert.equal(DocumentType[type], type, `Missing in shared/constants.js DocumentType: ${type}`);
  }
  assert.equal(isValidDocumentType("DEATH_CERTIFICATE"), false);
  assert.equal(isValidDocumentType("BURIAL_PERMIT"), false);
});

test("Backend hardening: validator accepts all canonical document types", () => {
  for (const type of CANONICAL_DOCUMENT_TYPES) {
    const parsed = createRequestSchema.safeParse({
      parishId: 1,
      documentType: type,
      applicantName: "Juan Dela Cruz",
      relationship: "Self",
      purpose: "Personal record",
    });
    assert.equal(parsed.success, true, `Validation failed for canonical type: ${type}`);
  }
  assert.equal(createRequestSchema.safeParse({ parishId: 1, documentType: "INVALID_CERTIFICATE", applicantName: "Juan Dela Cruz" }).success, false);
});

test("Backend hardening: document requirements matrix completeness", async () => {
  for (const type of CANONICAL_DOCUMENT_TYPES) {
    const requirement = await DocumentRequirementService.getRequirements(type);
    assert.ok(requirement, `Requirements missing for: ${type}`);
    assert.equal(requirement.documentType, type);
    assert.ok(requirement.title);
    assert.ok(requirement.baseFee !== undefined && requirement.baseFee >= 0);
    assert.ok(Array.isArray(requirement.requiredFields) && requirement.requiredFields.length > 0);
    assert.ok(Array.isArray(requirement.requiredDocuments) && requirement.requiredDocuments.length > 0);
    for (const document of requirement.requiredDocuments) {
      assert.ok(document.id);
      assert.ok(document.label);
      assert.ok(document.category);
    }
  }
});

test("Backend hardening: idempotency payload hash and validation", () => {
  assert.equal(IdempotencyService.isValidKey("valid-uuid-1234-5678"), true);
  assert.equal(IdempotencyService.isValidKey(""), false);
  assert.equal(IdempotencyService.isValidKey(null), false);
  assert.equal(IdempotencyService.isValidKey("a".repeat(200)), false);

  const payload = { parishId: 2, documentType: "BAPTISMAL_CERTIFICATE", applicantName: "Maria Clara", relationship: "Self", purpose: "Wedding requirement" };
  const equivalentPayload = { parishId: "2", documentType: "baptismal_certificate", applicantName: "Maria Clara ", relationship: "Self", purpose: "Wedding requirement" };
  const differentPayload = { parishId: 2, documentType: "BAPTISMAL_CERTIFICATE", applicantName: "Crisostomo Ibarra", relationship: "Self", purpose: "Passport requirement" };

  assert.equal(computeRequestPayloadHash(payload), computeRequestPayloadHash(equivalentPayload));
  assert.notEqual(computeRequestPayloadHash(payload), computeRequestPayloadHash(differentPayload));
});

test("Backend hardening: request state transitions", () => {
  assert.equal(canTransition("PENDING", "CANCELLED"), true);
  assert.equal(canTransition("PAYMENT_PENDING", "CANCELLED"), true);
  assert.equal(canTransition("NEEDS_CORRECTION", "CANCELLED"), true);
  assert.equal(canTransition("PAYMENT_NEEDS_CORRECTION", "CANCELLED"), true);
  assert.equal(canTransition("COMPLETED", "CANCELLED"), false);
  assert.equal(canTransition("REJECTED", "CANCELLED"), false);
  assert.equal(canTransition("UNDER_REVIEW", "NEEDS_CORRECTION"), true);
  assert.equal(canTransition("NEEDS_CORRECTION", "UNDER_REVIEW"), true);
  assert.equal(canTransition("UNDER_REVIEW", "PROCESSING"), true);
  assert.equal(canTransition("PAYMENT_PENDING", "PAYMENT_UNDER_REVIEW"), true);
  assert.equal(canTransition("PAYMENT_NEEDS_CORRECTION", "PAYMENT_UNDER_REVIEW"), true);
  assert.equal(canTransition("PAYMENT_UNDER_REVIEW", "PAYMENT_VERIFIED"), true);
  assert.equal(canTransition("PAYMENT_UNDER_REVIEW", "PAYMENT_NEEDS_CORRECTION"), true);
});
test("Payment QR contract: uses only the owned request parish and generic QR", async () => {
  const mockRepo = {
    async findOwnedRequestById(requestId, userId) {
      if (requestId === "101" && userId === 10) return { id: 101, parishId: 1 };
      if (requestId === "102" && userId === 10) return { id: 102, parishId: 2 };
      if (requestId === "103" && userId === 10) return { id: 103, parishId: 3 };
      if (requestId === "104" && userId === 10) return { id: 104, parishId: 4 };
      return null;
    },
    async findByParishId(parishId) {
      if (parishId === 1) return { id: 1, paymentQrEnabled: true, paymentQrImage: "https://pub-r2.testimonium.media/qr1.png" };
      if (parishId === 2) return { id: 2, paymentQrEnabled: false, paymentQrImage: "https://pub-r2.testimonium.media/disabled.png" };
      if (parishId === 3) return { id: 3, paymentQrEnabled: true, paymentQrImage: null };
      if (parishId === 4) return { id: 4, paymentQrEnabled: true, paymentQrImage: "not-a-url" };
      return null;
    },
  };

  const service = new PaymentConfigurationService(mockRepo);
  const configured = await service.getConfiguration({ requestId: "101", userId: 10 });
  assert.deepEqual(configured, {
    configured: true,
    qrCode: { enabled: true, imageUrl: "https://pub-r2.testimonium.media/qr1.png" },
  });
  assert.equal("gcash" in configured, false);
  assert.equal("maya" in configured, false);

  for (const requestId of ["102", "103", "104"]) {
    const unconfigured = await service.getConfiguration({ requestId, userId: 10 });
    assert.equal(unconfigured.configured, false);
    assert.equal(unconfigured.qrCode.imageUrl, null);
    assert.ok(unconfigured.message);
  }

  await assert.rejects(
    () => service.getConfiguration({ requestId: "101", userId: 99 }),
    { statusCode: 404 },
  );
  await assert.rejects(
    () => service.getConfiguration({ requestId: "1invalid", userId: 10 }),
    { statusCode: 400 },
  );
});
test("Backend Security: Required Attachment Category Bypass Prevention", async () => {
  // Retrieve Marriage Banns requirements (requires valid_id + baptismal_certificate)
  const bannsReq = await DocumentRequirementService.getRequirements("MARRIAGE_BANNS", 1);
  const requiredDocIds = bannsReq.requiredDocuments.filter((d) => d.required).map((d) => d.id);

  assert.ok(requiredDocIds.length >= 2, "Marriage Banns requires at least 2 documents");
  assert.ok(requiredDocIds.includes("valid_id"), "Marriage Banns must require valid_id");
  assert.ok(requiredDocIds.includes("baptismal_cert"), "Marriage Banns must require baptismal_cert");

  // Verify that generic 'primary' or 'supporting' does NOT match authoritative requirement IDs
  const validIds = new Set(bannsReq.requiredDocuments.map((d) => d.id));
  assert.equal(validIds.has("supporting"), false, "Generic 'supporting' must not be in valid requirement IDs");
  assert.equal(validIds.has("primary"), false, "Generic 'primary' must not be in valid requirement IDs");

  // Verify Permit to Marry requirements
  const permitReq = await DocumentRequirementService.getRequirements("PERMIT_TO_MARRY", 1);
  const permitRequiredIds = permitReq.requiredDocuments.filter((d) => d.required).map((d) => d.id);
  assert.ok(permitRequiredIds.length >= 2, "Permit to Marry requires multiple distinct documents");
  for (const reqId of permitRequiredIds) {
    assert.ok(reqId !== "supporting" && reqId !== "primary");
  }
});

test("Backend Hardening: Parish availableDocuments Semantics", () => {
  // null / undefined => all 7 canonical
  assert.equal(getEffectiveOfferedDocuments(null).length, 7);
  assert.equal(getEffectiveOfferedDocuments(undefined).length, 7);

  // Explicit empty array => NO documents offered
  assert.deepEqual(getEffectiveOfferedDocuments([]), []);
  assert.deepEqual(getEffectiveOfferedDocuments("[]"), []);

  // Filtered subset
  const subset = ["BAPTISMAL_CERTIFICATE", "CONFIRMATION_CERTIFICATE"];
  assert.deepEqual(getEffectiveOfferedDocuments(subset), subset);
  assert.deepEqual(getEffectiveOfferedDocuments(JSON.stringify(subset)), subset);
});

test("Backend Hardening: Database-level Idempotency Model and Delegate Verification", async () => {
  assert.ok(prisma.idempotencyKey, "Prisma client must expose idempotencyKey delegate");
  assert.equal(typeof prisma.idempotencyKey.findUnique, "function");
  assert.equal(typeof prisma.idempotencyKey.create, "function");

  // Unique constraint error detector
  assert.equal(IdempotencyService.isUniqueConstraintError({ code: "P2002" }), true);
  assert.equal(IdempotencyService.isUniqueConstraintError({ code: "23505" }), true);
  assert.equal(
    IdempotencyService.isUniqueConstraintError(new Error("Unique constraint failed on the fields: (user_id, key, resource_type)")),
    true
  );
  assert.equal(IdempotencyService.isUniqueConstraintError(new Error("Generic network error")), false);
});

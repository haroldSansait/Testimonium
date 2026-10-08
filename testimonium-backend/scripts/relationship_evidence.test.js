import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  canonicalizeRelationship,
  requireCanonicalRelationship,
  resolveRelationshipEvidence,
  SUPPORTED_RELATIONSHIPS,
} from "../config/relationshipEvidence.js";
import { FileValidator } from "../utils/fileValidator.js";
import { parseRegistrantIdOcr } from "../services/RegistrantIdOcrWorker.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { compareSelfRegistrantName, SELF_NAME_MATCH } from "../utils/selfRegistrantNameMatcher.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("relationship policy is canonical, fail-closed, and additive", () => {
  assert.equal(canonicalizeRelationship(undefined), "Self");
  assert.equal(canonicalizeRelationship(" spouse "), "Spouse");
  assert.equal(canonicalizeRelationship("friend"), null);
  assert.equal(resolveRelationshipEvidence("Self").length, 0);
  assert.deepEqual(
    resolveRelationshipEvidence("Parent").map(({ id }) => id),
    ["authorization_letter", "registrant_id_front", "registrant_id_back"]
  );
  assert.equal(SUPPORTED_RELATIONSHIPS.length, 7);
  assert.throws(
    () => requireCanonicalRelationship("Friend"),
    (error) => error.code === "INVALID_RELATIONSHIP" && error.statusCode === 400
  );
});

test("registrant image validation decodes JPEG/PNG and enforces bounded dimensions", async () => {
  const png = await sharp({
    create: { width: 320, height: 240, channels: 3, background: "#ffffff" },
  }).png().toBuffer();
  await assert.doesNotReject(() =>
    FileValidator.validateRegistrantIdImage(
      { buffer: png, mimetype: "image/png", size: png.length },
      "front"
    )
  );
  await assert.rejects(
    () =>
      FileValidator.validateRegistrantIdImage(
        { buffer: Buffer.from("not-an-image"), mimetype: "image/png", size: 12 },
        "back"
      ),
    (error) =>
      error.code === "REGISTRANT_ID_INVALID_IMAGE" ||
      error.code === "REGISTRANT_ID_UNSUPPORTED_TYPE"
  );
});

test("OCR parsing is advisory and bounded to structured fields", () => {
  const parsed = parseRegistrantIdOcr(
    "REPUBLIC OF THE PHILIPPINES\nNAME: JUAN DELA CRUZ\nDOB: 1990-01-02",
    "EXPIRY: 2030-12-31\nID NUMBER: 1234-5678"
  );
  assert.equal(typeof parsed, "object");
  assert.ok(Array.isArray(parsed.advisoryFlags));
  assert.equal(parsed.frontText, undefined);
  assert.equal(parsed.backText, undefined);
});

test("Self-name comparison accepts required legitimate variations", () => {
  const profile = "Juan Miguel de la Cruz Jr.";
  const clearMatches = [
    "Juan Miguel de la Cruz Jr.",
    "JUAN MIGUEL DE LA CRUZ JR",
    "  Juan   Miguel   de la Cruz  ",
    "Juan de la Cruz",
    "Juan M. de la Cruz",
    "de la Cruz, Juan Miguel",
    "Juan Miguel de la Cruz III",
  ];
  for (const applicant of clearMatches) {
    assert.equal(compareSelfRegistrantName(profile, applicant).outcome, SELF_NAME_MATCH.CLEAR, applicant);
  }
  assert.equal(compareSelfRegistrantName(profile, "Juan Cruz").outcome, SELF_NAME_MATCH.AMBIGUOUS);
});

test("Self-name comparison rejects unrelated names and controls missing profile names", () => {
  assert.equal(compareSelfRegistrantName("Juan Dela Cruz", "Maria Santos").outcome, SELF_NAME_MATCH.MISMATCH);
  assert.equal(compareSelfRegistrantName("", "Juan Dela Cruz").outcome, SELF_NAME_MATCH.UNAVAILABLE);
});

test("direct backend guard enforces Self and preserves non-Self behavior", () => {
  assert.equal(
    ParishionerRequestService.validateSelfRegistrantName("Self", "Cruz, Juan M.", "Juan Miguel Cruz").outcome,
    SELF_NAME_MATCH.CLEAR
  );
  assert.throws(
    () => ParishionerRequestService.validateSelfRegistrantName("Self", "Maria Santos", "Juan Cruz"),
    (error) => error.code === "SELF_REGISTRANT_NAME_MISMATCH" && error.statusCode === 400
  );
  assert.throws(
    () => ParishionerRequestService.validateSelfRegistrantName("Self", "Juan Cruz", ""),
    (error) => error.code === "SELF_REGISTRANT_NAME_UNAVAILABLE" && error.statusCode === 409
  );
  assert.deepEqual(
    ParishionerRequestService.validateSelfRegistrantName("Parent", "Maria Santos", "Juan Cruz"),
    { outcome: "NOT_APPLICABLE" }
  );
});

test("routes, workers, and DTOs preserve private-evidence boundaries", async () => {
  const [parishionerRoutes, staffRoutes, parishionerRepo, staffRepo, cleanupWorker, ocrWorker, uploadService, migration] =
    await Promise.all([
      read("../routes/parishionerRequestRoutes.js"),
      read("../routes/documentRequestRoutes.js"),
      read("../repositories/ParishionerRequestRepository.js"),
      read("../repositories/DocumentRequestRepository.js"),
      read("../services/PrivateObjectCleanupWorker.js"),
      read("../services/RegistrantIdOcrWorker.js"),
      read("../services/FileUploadService.js"),
      read("../prisma/migrations/20261008120000_add_registrant_id_evidence/migration.sql"),
    ]);

  assert.match(parishionerRoutes, /registrant-id/);
  assert.match(staffRoutes, /registrant-id/);
  assert.match(staffRoutes, /receipt/);
  assert.doesNotMatch(parishionerRepo, /r2ObjectKey:\s*true/);
  assert.doesNotMatch(staffRepo, /r2ObjectKey:\s*true/);
  assert.match(cleanupWorker, /SKIP LOCKED/);
  assert.match(ocrWorker, /SKIP LOCKED/);
  assert.match(ocrWorker, /ocrProcessingToken/);
  assert.match(ocrWorker, /ocr_claimed_version/);
  assert.match(uploadService, /uploadAuthorizationLetter/);
  assert.match(uploadService, /FOR UPDATE/);
  assert.match(uploadService, /RELATIONSHIP_EVIDENCE_UPLOAD_CONFLICT/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FROM PUBLIC, anon, authenticated/);
});

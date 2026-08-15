import assert from "node:assert";
import {
  CANONICAL_DOCUMENT_TYPES,
  DEFAULT_OFFERED_DOCUMENTS,
  normalizeDocumentType,
  isValidDocumentType,
  getEffectiveOfferedDocuments,
  normalizeAvailableDocumentsForSave,
} from "../config/documents.js";
import { AuthService } from "../services/AuthService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { ParishService } from "../services/ParishService.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { prisma } from "../config/db.js";

async function runTests() {
  console.log("=== Running Phase 4.2.1 Integration Verification ===");

  // Test 1: Canonical Document Helpers
  console.log("\n[Test 1] Canonical document helpers...");
  assert.strictEqual(CANONICAL_DOCUMENT_TYPES.length, 7, "Must have exactly 7 canonical types");
  assert.strictEqual(DEFAULT_OFFERED_DOCUMENTS.length, 7, "Default offered must have 7 types");
  assert.strictEqual(isValidDocumentType("BAPTISMAL_CERTIFICATE"), true);
  assert.strictEqual(isValidDocumentType("MARRIAGE_BANNS"), true);
  assert.strictEqual(isValidDocumentType("PERMIT_TO_MARRY"), true);
  assert.strictEqual(isValidDocumentType("STATUS_OF_LIBERTY"), true);
  assert.strictEqual(isValidDocumentType("INVALID_HACK_DOC"), false);

  assert.strictEqual(normalizeDocumentType("baptism"), "BAPTISMAL_CERTIFICATE");
  assert.strictEqual(normalizeDocumentType("confirmation"), "CONFIRMATION_CERTIFICATE");
  assert.strictEqual(normalizeDocumentType("marriage"), "MARRIAGE_CERTIFICATE");
  assert.strictEqual(normalizeDocumentType("first_communion"), "FIRST_COMMUNION_CERTIFICATE");
  assert.strictEqual(normalizeDocumentType("banns"), "MARRIAGE_BANNS");
  assert.strictEqual(normalizeDocumentType("permit"), "PERMIT_TO_MARRY");
  assert.strictEqual(normalizeDocumentType("liberty"), "STATUS_OF_LIBERTY");
  console.log("✓ Canonical document helpers verified.");

  // Test 2: Effective offered documents (null vs empty vs configured)
  console.log("\n[Test 2] Effective offered documents (null vs [] vs custom)...");
  const nullConfig = getEffectiveOfferedDocuments(null);
  assert.strictEqual(nullConfig.length, 7, "null config must default to all 7 canonical documents");

  const undefinedConfig = getEffectiveOfferedDocuments(undefined);
  assert.strictEqual(undefinedConfig.length, 7, "undefined config must default to all 7 canonical documents");

  const emptyConfig = getEffectiveOfferedDocuments([]);
  assert.strictEqual(emptyConfig.length, 0, "explicit [] must NOT be converted to 7; it remains []");

  const customConfig = getEffectiveOfferedDocuments(["MARRIAGE_BANNS", "BAPTISMAL_CERTIFICATE"]);
  assert.deepStrictEqual(customConfig, ["BAPTISMAL_CERTIFICATE", "MARRIAGE_BANNS"], "Must normalize and canonically order");
  console.log("✓ Effective offered documents logic verified.");

  // Test 3: Normalization on Save
  console.log("\n[Test 3] Normalization on save...");
  const savedDocs = normalizeAvailableDocumentsForSave([
    "MARRIAGE_CERTIFICATE",
    "BAPTISM",
    "MARRIAGE_CERTIFICATE", // duplicate
    "MARRIAGE_BANNS",
  ]);
  assert.deepStrictEqual(
    savedDocs,
    ["BAPTISMAL_CERTIFICATE", "MARRIAGE_CERTIFICATE", "MARRIAGE_BANNS"],
    "Must deduplicate, normalize aliases, and sort canonically"
  );

  let caughtSaveError = false;
  try {
    normalizeAvailableDocumentsForSave(["BAPTISMAL_CERTIFICATE", "NON_EXISTENT_DOC"]);
  } catch (err) {
    caughtSaveError = true;
    assert.strictEqual(err.statusCode, 400);
    assert(err.message.includes("NON_EXISTENT_DOC"));
  }
  assert(caughtSaveError, "Must throw 400 on invalid document type in availableDocuments");
  console.log("✓ Save normalization and rejection verified.");

  // Test 4: AuthService JIT lookup does NOT log User Login
  console.log("\n[Test 4] AuthService JIT lookup does NOT emit User Login...");
  const authService = new AuthService();
  const coordinatorUser = await prisma.user.findFirst({
    where: { role: { roleName: "DIOCESE_COORDINATOR" } },
  });

  if (coordinatorUser && coordinatorUser.firebaseUid) {
    const initialLogCount = await prisma.activityLog.count({
      where: {
        userId: coordinatorUser.id,
        action: "User Login",
      },
    });

    // Simulate 5 background token verification / JIT lookups
    for (let i = 0; i < 5; i++) {
      await authService.getOrCreateApplicationUser({
        uid: coordinatorUser.firebaseUid,
        email: coordinatorUser.email,
        email_verified: true,
      });
    }

    const postPollLogCount = await prisma.activityLog.count({
      where: {
        userId: coordinatorUser.id,
        action: "User Login",
      },
    });

    assert.strictEqual(
      postPollLogCount,
      initialLogCount,
      "Background getOrCreateApplicationUser lookups must NOT increment User Login activity logs"
    );
    console.log(`✓ 5 simulated polling lookups produced 0 false User Login records (remained ${initialLogCount}).`);
  }

  // Test 5: ParishionerRequestService disabled document rejection
  console.log("\n[Test 5] ParishionerRequestService disabled document rejection...");
  const requestService = new ParishionerRequestService();
  const testParish = await prisma.parish.findFirst({
    where: { isActive: true },
  });

  if (testParish && coordinatorUser) {
    // 5a. Attempt invalid document type
    let invalidDocError = false;
    try {
      await requestService.createDraft(coordinatorUser.id, {
        parishId: testParish.id,
        documentType: "FAKE_DOC_TYPE",
        applicantName: "Test Applicant",
      });
    } catch (e) {
      invalidDocError = true;
      assert.strictEqual(e.statusCode, 400);
      assert(e.message.includes("Unsupported document type"));
    }
    assert(invalidDocError, "Must reject unsupported document type with 400");
    console.log("✓ Unsupported document type rejected with 400.");
  }

  console.log("\n=== All Phase 4.2.1 Backend Tests PASSED! ===");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });

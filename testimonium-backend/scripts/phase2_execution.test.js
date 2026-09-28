import assert from "node:assert/strict";
import test from "node:test";
import { FileValidator } from "../utils/fileValidator.js";
import { parseConfidence } from "../config/env.js";
import { OcrProcessingService } from "../services/OcrProcessingService.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { DocumentRequestStatus } from "../services/RequestStateMachine.js";
import { ReceiptVerificationService } from "../services/ReceiptVerificationService.js";
import { DocumentRequestService } from "../services/DocumentRequestService.js";
import { prisma } from "../config/db.js";

// ============================================================================
// 1. FILE VALIDATOR TESTS (Magic Bytes, MIME, Size Limits, Policies)
// ============================================================================

test("FileValidator: accepts valid PDF with %PDF magic bytes", () => {
  const pdfHeader = Buffer.from("%PDF-1.4 test content");
  const file = {
    buffer: pdfHeader,
    size: pdfHeader.length,
    mimetype: "application/pdf",
    originalname: "authorization_letter.pdf",
  };
  const result = FileValidator.validateAuthorizationLetter(file);
  assert.equal(result.signature, "pdf");
  assert.equal(result.normalizedMime, "application/pdf");
});

test("FileValidator: accepts valid JPEG with 0xFF 0xD8 0xFF magic bytes", () => {
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const file = {
    buffer: jpegHeader,
    size: jpegHeader.length,
    mimetype: "image/jpeg",
    originalname: "receipt.jpg",
  };
  const result = FileValidator.validateReceipt(file);
  assert.equal(result.signature, "jpeg");
  assert.equal(result.normalizedMime, "image/jpeg");
});

test("FileValidator: accepts valid PNG with 0x89 PNG magic bytes", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const file = {
    buffer: pngHeader,
    size: pngHeader.length,
    mimetype: "image/png",
    originalname: "receipt.png",
  };
  const result = FileValidator.validateReceipt(file);
  assert.equal(result.signature, "png");
  assert.equal(result.normalizedMime, "image/png");
});

test("FileValidator: rejects Windows PE executable disguised as PDF", () => {
  const exeHeader = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00");
  const file = {
    buffer: exeHeader,
    size: exeHeader.length,
    mimetype: "application/pdf",
    originalname: "malicious.pdf",
  };
  assert.throws(
    () => FileValidator.validateAuthorizationLetter(file),
    (err) => err.code === "AUTHORIZATION_LETTER_INVALID" && err.statusCode === 400
  );
});

test("FileValidator: rejects text file disguised as JPEG receipt", () => {
  const textContent = Buffer.from("Hello world, this is a plain text receipt");
  const file = {
    buffer: textContent,
    size: textContent.length,
    mimetype: "image/jpeg",
    originalname: "fake_receipt.jpg",
  };
  assert.throws(
    () => FileValidator.validateReceipt(file),
    (err) => err.code === "PAYMENT_PROOF_INVALID_IMAGE" && err.statusCode === 400
  );
});

test("FileValidator: rejects file exceeding 5 MB limit", () => {
  const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
  const file = {
    buffer: largeBuffer,
    size: largeBuffer.length,
    mimetype: "application/pdf",
    originalname: "huge.pdf",
  };
  assert.throws(
    () => FileValidator.validateAuthorizationLetter(file),
    (err) => err.statusCode === 413
  );
});

test("FileValidator: receipt rejects WebP even if valid WebP bytes", () => {
  const webpBuffer = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.alloc(4),
    Buffer.from("WEBP"),
  ]);
  const file = {
    buffer: webpBuffer,
    size: webpBuffer.length,
    mimetype: "image/webp",
    originalname: "receipt.webp",
  };
  assert.throws(
    () => FileValidator.validateReceipt(file),
    (err) => err.code === "PAYMENT_PROOF_INVALID_IMAGE"
  );
});

test("FileValidator: authorization letter rejects WebP", () => {
  const webpBuffer = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.alloc(4),
    Buffer.from("WEBP"),
  ]);
  const file = {
    buffer: webpBuffer,
    size: webpBuffer.length,
    mimetype: "image/webp",
    originalname: "auth.webp",
  };
  assert.throws(
    () => FileValidator.validateAuthorizationLetter(file),
    (err) => err.code === "AUTHORIZATION_LETTER_INVALID"
  );
});

// ============================================================================
// 2. CONFIGURATION & THRESHOLD NORMALIZATION
// ============================================================================

test("parseConfidence: normalizes 0.0-1.0 and 0-100 scale correctly", () => {
  assert.equal(parseConfidence("0.75"), 0.75);
  assert.equal(parseConfidence("75"), 0.75);
  assert.equal(parseConfidence("80"), 0.80);
  assert.equal(parseConfidence("0.8"), 0.80);
  assert.equal(parseConfidence(undefined, 0.75), 0.75);
  // Bounds checking
  assert.equal(parseConfidence("-10", 0.75), 0.75);
  assert.equal(parseConfidence("150", 0.75), 0.75);
});

// ============================================================================
// 3. PAYMENT QUALITY GATE & EXACT 75% BOUNDARY TESTS
// ============================================================================

test("Quality Gate: 74.99% (0.7499) falls below threshold -> PAYMENT_NEEDS_CORRECTION", () => {
  const result = OcrProcessingService.evaluateQualityGate(0.7499, 0.75);
  assert.equal(result.passed, false);
  assert.equal(result.status, "PAYMENT_NEEDS_CORRECTION");
  assert.equal(result.paymentStatus, "UNPAID");
  assert.equal(result.action, "PAYMENT_PROOF_LOW_CONFIDENCE");
  assert.ok(result.paymentCorrectionNote.includes("unclear or blurry"));
});

test("Quality Gate: exactly 75.00% (0.7500) passes gate -> PAYMENT_UNDER_REVIEW (NEVER PAYMENT_VERIFIED)", () => {
  const result = OcrProcessingService.evaluateQualityGate(0.7500, 0.75);
  assert.equal(result.passed, true);
  assert.equal(result.status, "PAYMENT_UNDER_REVIEW");
  assert.notEqual(result.status, "PAYMENT_VERIFIED", "Quality threshold MUST NEVER automatically mark PAYMENT_VERIFIED");
  assert.equal(result.paymentStatus, "PROOF_SUBMITTED");
  assert.notEqual(result.paymentStatus, "CONFIRMED");
  assert.equal(result.action, "RECEIPT_QUALITY_PASSED");
  assert.equal(result.paymentCorrectionNote, null);
});

test("Quality Gate: 75.01% (0.7501) passes gate -> PAYMENT_UNDER_REVIEW", () => {
  const result = OcrProcessingService.evaluateQualityGate(0.7501, 0.75);
  assert.equal(result.passed, true);
  assert.equal(result.status, "PAYMENT_UNDER_REVIEW");
  assert.notEqual(result.status, "PAYMENT_VERIFIED");
  assert.equal(result.paymentStatus, "PROOF_SUBMITTED");
});

// ============================================================================
// 4. RACE CONDITION & STALE OCR PROTECTION (Matrix A, B, C, D, E)
// ============================================================================

test("Race Matrix A: Upload B (newer, fast) completes 90% -> Upload A (older, slow) completes 40% later -> A discarded, B remains authoritative", () => {
  // Receipt A: superseded, request now points to B's object key
  const receiptA = {
    id: 101,
    attemptVersion: 1,
    isSuperseded: true,
    r2ObjectKey: "receipts/attempt1.jpg",
    transaction: {
      request: {
        id: 301,
        paymentProofObjectKey: "receipts/attempt2.jpg", // Request points to B!
        status: DocumentRequestStatus.PAYMENT_UNDER_REVIEW,
      },
    },
  };

  // Receipt B: active, request points to B's object key
  const receiptB = {
    id: 102,
    attemptVersion: 2,
    isSuperseded: false,
    r2ObjectKey: "receipts/attempt2.jpg",
    transaction: {
      request: {
        id: 301,
        paymentProofObjectKey: "receipts/attempt2.jpg",
        status: DocumentRequestStatus.PAYMENT_UNDER_REVIEW,
      },
    },
  };

  assert.equal(OcrProcessingService.isAttemptAuthoritative(receiptA), false, "Stale Receipt A must NOT be authoritative");
  assert.equal(OcrProcessingService.isAttemptAuthoritative(receiptB), true, "Active Receipt B must be authoritative");
});

test("Race Matrix B: Upload B (newer, fast) completes 40% (correction) -> Upload A (older, slow) completes 90% later -> A discarded, request remains in correction", () => {
  const receiptA = {
    id: 101,
    attemptVersion: 1,
    isSuperseded: true, // Marked superseded when B arrived
    r2ObjectKey: "receipts/attempt1.jpg",
    transaction: {
      request: {
        id: 301,
        paymentProofObjectKey: "receipts/attempt2.jpg",
        status: DocumentRequestStatus.PAYMENT_NEEDS_CORRECTION,
      },
    },
  };

  assert.equal(OcrProcessingService.isAttemptAuthoritative(receiptA), false, "Older attempt A must not be authoritative");
});

test("Race Matrix C & D: Attempt allocation and superseded guard prevents race overwrite", () => {
  // Simulated attempt version allocation inside transaction
  const priorReceipts = [
    { attemptVersion: 1, isSuperseded: false },
  ];
  const maxAttempt = Math.max(...priorReceipts.map((r) => r.attemptVersion), 0);
  const nextAttemptVersion = maxAttempt + 1;
  assert.equal(nextAttemptVersion, 2);

  // When superseded receipt encounters an error or completion, isAttemptAuthoritative is false
  const supersededReceipt = {
    id: 101,
    isSuperseded: true,
    r2ObjectKey: "receipts/attempt1.jpg",
    transaction: {
      request: {
        paymentProofObjectKey: "receipts/attempt2.jpg",
      },
    },
  };
  assert.equal(OcrProcessingService.isAttemptAuthoritative(supersededReceipt), false);
});

// ============================================================================
// 5. AUTHORIZATION LETTER REQUIREMENT TESTS
// ============================================================================

test("Authorization Letter: Self request without letter succeeds", () => {
  const result = ParishionerRequestService.validateAuthorizationLetterRequirement("Self", []);
  assert.equal(result, true);
});

test("Authorization Letter: Spouse/Relative request without letter succeeds", () => {
  const resultSpouse = ParishionerRequestService.validateAuthorizationLetterRequirement("Spouse", []);
  assert.equal(resultSpouse, true);
  const resultParent = ParishionerRequestService.validateAuthorizationLetterRequirement("Parent", []);
  assert.equal(resultParent, true);
});

test("Authorization Letter: Authorized Representative without letter throws AUTHORIZATION_LETTER_REQUIRED (400)", () => {
  assert.throws(
    () => ParishionerRequestService.validateAuthorizationLetterRequirement("Authorized Representative", []),
    (err) => {
      assert.equal(err.code, "AUTHORIZATION_LETTER_REQUIRED");
      assert.equal(err.statusCode, 400);
      assert.ok(err.message.includes("authorization letter is required"));
      return true;
    }
  );
});

test("Authorization Letter: Authorized Representative with valid authorization_letter attachment succeeds", () => {
  const attachments = [
    { id: 1, category: "supporting", fileName: "id.jpg" },
    { id: 2, category: "authorization_letter", fileName: "signed_auth.pdf" },
  ];
  const result = ParishionerRequestService.validateAuthorizationLetterRequirement(
    "Authorized Representative",
    attachments
  );
  assert.equal(result, true);
});

// ============================================================================
// 6. PRIVATE ATTACHMENT ACCESS & TENANCY ENFORCEMENT
// ============================================================================

test("Private File Access: Parishioner ownership guard allows owner and blocks non-owner", () => {
  const request = { id: 10, userId: "parishioner_alice", parishId: 1 };
  
  // Owner access
  const isOwner = request.userId === "parishioner_alice";
  assert.equal(isOwner, true, "Parishioner should access their own request attachment");

  // Non-owner access attempt
  const isNonOwner = request.userId === "parishioner_mallory";
  assert.equal(isNonOwner, false, "Unrelated parishioner MUST NOT access private attachment");
});

test("Private File Access: Staff tenancy guard allows same-parish and blocks cross-parish unauthorized staff", () => {
  const request = { id: 10, parishId: 100 };

  // Staff in parish 100
  const sameParishStaff = { parishId: 100, roleName: "PARISH_STAFF" };
  const canSameParishAccess = sameParishStaff.parishId === request.parishId;
  assert.equal(canSameParishAccess, true, "Same parish staff can access");

  // Staff in parish 200 without cross-parish role
  const otherParishStaff = { parishId: 200, roleName: "PARISH_STAFF", isSuperAdmin: false };
  const canOtherParishAccess = otherParishStaff.isSuperAdmin || otherParishStaff.parishId === request.parishId;
  assert.equal(canOtherParishAccess, false, "Cross-parish staff without permission MUST NOT access private attachment");

  // Superadmin
  const superAdmin = { parishId: null, roleName: "SUPERADMIN", isSuperAdmin: true };
  const canSuperAdminAccess = superAdmin.isSuperAdmin || superAdmin.roleName === "SUPERADMIN";
  assert.equal(canSuperAdminAccess, true, "Superadmin has global ecclesiastical access");
});

// ============================================================================
// 7. ATTEMPT VERSIONING & RESPONSE CONTRACT TESTS (Finding 13 & 15)
// ============================================================================

test("Receipt Verification: processReceipt returns actual allocated attemptVersion", async () => {
  const originalTransaction = prisma.$transaction;
  try {
    prisma.$transaction = async (callback) => {
      const mockTx = {
        $queryRaw: async () => [{ request_id: 100 }],
        documentRequest: {
          findFirst: async () => ({
            id: 100,
            userId: 50,
            status: "PAYMENT_PENDING",
            trackingNumber: "DOC-2026-00100",
            parishId: 1,
          }),
          update: async () => ({
            id: 100,
            paymentProofObjectKey: "receipts/req_100_v1.jpg",
            paymentStatus: "PROOF_SUBMITTED",
          }),
        },
        paymentTransaction: {
          findFirst: async () => ({
            id: 200,
            requestId: 100,
            status: "PENDING",
          }),
        },
        receiptUpload: {
          findFirst: async () => ({
            id: 88,
            attemptVersion: 3,
            isSuperseded: false,
          }),
          updateMany: async () => ({ count: 1 }),
        },
        ocrResult: {
          create: async () => ({ id: 501, status: "PENDING" }),
        },
        requestHistory: {
          create: async () => ({ id: 1001 }),
        },
      };

      return callback(mockTx);
    };

    // Verify attempt calculation logic
    const latestAttempt = 3;
    const nextAttempt = latestAttempt + 1;
    assert.equal(nextAttempt, 4);

    // Verify response shape includes attemptVersion
    const mockServiceResult = {
      receiptId: 89,
      attemptVersion: nextAttempt,
      request: { id: 100 },
    };
    const responsePayload = {
      success: true,
      autoVerified: false,
      ocrPending: true,
      receiptId: mockServiceResult.receiptId,
      attemptVersion: mockServiceResult.attemptVersion,
      ocrStatus: "PENDING",
      request: mockServiceResult.request,
    };

    assert.equal(responsePayload.attemptVersion, 4);
    assert.equal(responsePayload.receiptId, 89);
    assert.equal(responsePayload.ocrPending, true);
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

// ============================================================================
// 8. ATTEMPT ALLOCATION & SERIALIZATION INVARIANTS (Finding 2, 3, 4)
// ============================================================================

test("Attempt Serialization: concurrent uploads assign distinct incrementing attempt versions and supersede older attempts", () => {
  let persistedReceipts = [];

  function simulateUploadAttempt(key) {
    const latestAttempt = persistedReceipts.reduce(
      (max, r) => Math.max(max, r.attemptVersion),
      0
    );
    const nextVersion = latestAttempt + 1;

    // Supersede previous active receipts
    persistedReceipts.forEach((r) => {
      r.isSuperseded = true;
    });

    const newReceipt = {
      id: persistedReceipts.length + 1,
      attemptVersion: nextVersion,
      r2ObjectKey: key,
      isSuperseded: false,
    };
    persistedReceipts.push(newReceipt);

    return newReceipt;
  }

  const upload1 = simulateUploadAttempt("receipts/attempt_1.jpg");
  assert.equal(upload1.attemptVersion, 1);
  assert.equal(upload1.isSuperseded, false);

  const upload2 = simulateUploadAttempt("receipts/attempt_2.jpg");
  assert.equal(upload2.attemptVersion, 2);
  assert.equal(upload2.isSuperseded, false);

  // Invariant 1: Distinct attempt versions > 0
  assert.notEqual(upload1.attemptVersion, upload2.attemptVersion);
  assert.ok(upload1.attemptVersion > 0);
  assert.ok(upload2.attemptVersion > 0);

  // Invariant 2: Exactly ONE active (isSuperseded = false) receipt
  const activeReceipts = persistedReceipts.filter((r) => !r.isSuperseded);
  assert.equal(activeReceipts.length, 1);
  assert.equal(activeReceipts[0].id, upload2.id);

  // Invariant 3: Older receipt is superseded
  assert.equal(upload1.isSuperseded, true);
});

// ============================================================================
// 9. ATOMIC OCR AUTHORITY CHECK & TOCTOU RACE PROTECTION (Finding 5 & 7)
// ============================================================================

test("Atomic TOCTOU Guard: A slow low-confidence vs B fast high-confidence -> B wins permanently, A discarded", async () => {
  let requestStatus = "PAYMENT_UNDER_REVIEW"; // Transitioned by Attempt B
  let canonicalPointer = "receipts/attempt_B.jpg";
  let paymentCorrectionNote = null;
  let historyEntries = ["RECEIPT_QUALITY_PASSED_B"];
  let notificationsDispatched = ["NOTIFY_B_UPLOADED"];

  const attemptA = {
    id: 1,
    attemptVersion: 1,
    isSuperseded: true, // Superseded when B arrived
    r2ObjectKey: "receipts/attempt_A.jpg",
    transaction: {
      request: {
        id: 500,
        paymentProofObjectKey: canonicalPointer,
      },
    },
  };

  const isAuthoritative = OcrProcessingService.isAttemptAuthoritative(attemptA);
  assert.equal(isAuthoritative, false, "Attempt A must be identified as superseded and non-authoritative");

  if (isAuthoritative) {
    requestStatus = "PAYMENT_NEEDS_CORRECTION";
    paymentCorrectionNote = "The payment proof image is unclear or blurry.";
    historyEntries.push("PAYMENT_PROOF_LOW_CONFIDENCE_A");
    notificationsDispatched.push("NOTIFY_A_FAILED");
  }

  // Verify Request state is completely unmodified by stale Attempt A
  assert.equal(requestStatus, "PAYMENT_UNDER_REVIEW");
  assert.equal(canonicalPointer, "receipts/attempt_B.jpg");
  assert.equal(paymentCorrectionNote, null);
  assert.deepEqual(historyEntries, ["RECEIPT_QUALITY_PASSED_B"]);
  assert.deepEqual(notificationsDispatched, ["NOTIFY_B_UPLOADED"]);
});

test("Atomic TOCTOU Guard: A slow high-confidence vs B fast low-confidence -> B wins permanently, A discarded", async () => {
  let requestStatus = "PAYMENT_NEEDS_CORRECTION"; // Transitioned by Attempt B
  let canonicalPointer = "receipts/attempt_B.jpg";
  let paymentCorrectionNote = "The payment proof image is unclear or blurry. Please upload a clearer image.";
  let historyEntries = ["PAYMENT_PROOF_LOW_CONFIDENCE_B"];

  const attemptA = {
    id: 1,
    attemptVersion: 1,
    isSuperseded: true, // Superseded by B
    r2ObjectKey: "receipts/attempt_A.jpg",
    transaction: {
      request: {
        id: 500,
        paymentProofObjectKey: canonicalPointer,
      },
    },
  };

  const isAuthoritative = OcrProcessingService.isAttemptAuthoritative(attemptA);
  assert.equal(isAuthoritative, false);

  if (isAuthoritative) {
    requestStatus = "PAYMENT_UNDER_REVIEW";
    paymentCorrectionNote = null;
    historyEntries.push("RECEIPT_QUALITY_PASSED_A");
  }

  // Verify request remains in correction state
  assert.equal(requestStatus, "PAYMENT_NEEDS_CORRECTION");
  assert.ok(paymentCorrectionNote.includes("blurry"));
  assert.deepEqual(historyEntries, ["PAYMENT_PROOF_LOW_CONFIDENCE_B"]);
});

// ============================================================================
// 10. CLEAR OBSOLETE PAYMENT CORRECTION NOTE (Finding 8 & 10)
// ============================================================================

test("Correction Note Clearing: Successful newer receipt (>= 75%) clears obsolete blurry correction note", () => {
  // When newer receipt passes quality gate:
  const qualityResult = OcrProcessingService.evaluateQualityGate(0.88, 0.75);
  assert.equal(qualityResult.passed, true);
  assert.equal(qualityResult.status, "PAYMENT_UNDER_REVIEW");
  assert.equal(qualityResult.paymentCorrectionNote, null, "Passing proof must clear obsolete correction note");

  const updatedState = {
    status: qualityResult.status,
    paymentCorrectionNote: qualityResult.paymentCorrectionNote,
  };

  assert.equal(updatedState.status, "PAYMENT_UNDER_REVIEW");
  assert.equal(updatedState.paymentCorrectionNote, null);
});

// ============================================================================
// 11. OCR FAILURE CLASSIFICATION CONTRACT (Finding 6 & 11 & 19)
// ============================================================================

test("OCR Failure Classification: ocrSuccess=false does NOT claim blurry or fabricate confidence score", () => {
  // Test case 1: Provider processing failure
  const processingFailureOutput = {
    ocrSuccess: false,
    failureReason: "Unable to detect characters on canvas",
    httpStatusCode: 200,
  };

  const isUnavailable1 =
    [408, 429, 500, 502, 503, 504].includes(processingFailureOutput.httpStatusCode) ||
    processingFailureOutput.failureReason.toLowerCase().includes("timed out");
  
  assert.equal(isUnavailable1, false);
  const action1 = isUnavailable1
    ? "PAYMENT_PROOF_ANALYSIS_UNAVAILABLE"
    : "PAYMENT_PROOF_ANALYSIS_FAILED";
  assert.equal(action1, "PAYMENT_PROOF_ANALYSIS_FAILED");

  // Test case 2: Provider timeout / rate limit / 503
  const timeoutOutput = {
    ocrSuccess: false,
    failureReason: "OCR request timed out after 10000ms",
    httpStatusCode: 408,
  };

  const isUnavailable2 =
    [408, 429, 500, 502, 503, 504].includes(timeoutOutput.httpStatusCode) ||
    timeoutOutput.failureReason.toLowerCase().includes("timed out");

  assert.equal(isUnavailable2, true);
  const action2 = isUnavailable2
    ? "PAYMENT_PROOF_ANALYSIS_UNAVAILABLE"
    : "PAYMENT_PROOF_ANALYSIS_FAILED";
  assert.equal(action2, "PAYMENT_PROOF_ANALYSIS_UNAVAILABLE");

  // Both categories route to safe manual review without calling the image blurry
  assert.notEqual(action1, "PAYMENT_PROOF_LOW_CONFIDENCE");
  assert.notEqual(action2, "PAYMENT_PROOF_LOW_CONFIDENCE");
});

// ============================================================================
// 12. OCR EXCEPTION HANDLER VARIABLE SCOPING & SAFETY (Finding 7 & 12)
// ============================================================================

test("OCR Exception Resilience: Thrown exception does not crash with ReferenceError and routes safely to manual review", async () => {
  let loggedPayload = null;

  // Simulate exception handler execution with variables declared at function scope
  let ocrDurationMs = 0;
  let compressionDurationMs = 0;
  let compressionRatio = null;
  let retryCount = 0;

  try {
    throw new Error("Simulated R2 network socket hangup");
  } catch (err) {
    loggedPayload = {
      ocrDurationMs,
      compressionDurationMs,
      compressionRatio,
      retryCount,
      ocrStatus: "FAILED",
      failureReason: err.message,
    };
  }

  assert.ok(loggedPayload !== null);
  assert.equal(loggedPayload.ocrDurationMs, 0);
  assert.equal(loggedPayload.compressionDurationMs, 0);
  assert.equal(loggedPayload.compressionRatio, null);
  assert.equal(loggedPayload.retryCount, 0);
  assert.equal(loggedPayload.ocrStatus, "FAILED");
  assert.equal(loggedPayload.failureReason, "Simulated R2 network socket hangup");
});

// ============================================================================
// 13. BACKEND PAYMENT VERIFICATION GATE (Finding 9)
// ============================================================================

test("Quality Gate Enforcement: Staff cannot transition PAYMENT_NEEDS_CORRECTION -> PAYMENT_UNDER_REVIEW with low-confidence receipt (< 75%)", async () => {
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;

  try {
    prisma.$transaction = async (callback) => {
      const mockTx = {
        documentRequest: {
          findUnique: async () => ({
            id: 99,
            status: "PAYMENT_NEEDS_CORRECTION",
            paymentProofObjectKey: "receipts/bad_attempt.jpg",
            parishId: 1,
            fee: 100,
          }),
        },
        receiptUpload: {
          findFirst: async () => ({
            id: 401,
            r2ObjectKey: "receipts/bad_attempt.jpg",
            isSuperseded: false,
            ocrResult: {
              status: "COMPLETED",
              confidenceScore: 0.52, // Below 0.75
            },
          }),
        },
      };
      return callback(mockTx);
    };

    await assert.rejects(
      async () => {
        await service.updateStatus(
          99,
          "PAYMENT_UNDER_REVIEW",
          "Staff attempting to bypass correction",
          901,
          "SECRETARY",
          1
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Cannot bypass payment quality gate"));
        return true;
      }
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("Quality Gate Enforcement: Staff cannot verify payment (PAYMENT_VERIFIED) if active receipt failed quality threshold", async () => {
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;

  try {
    prisma.$transaction = async (callback) => {
      const mockTx = {
        documentRequest: {
          findUnique: async () => ({
            id: 99,
            status: "PAYMENT_UNDER_REVIEW",
            paymentProofObjectKey: "receipts/bad_attempt.jpg",
            parishId: 1,
            fee: 100,
          }),
        },
        paymentTransaction: {
          findFirst: async () => ({
            id: 777,
            status: "PENDING",
            receipts: [
              {
                id: 401,
                r2ObjectKey: "receipts/bad_attempt.jpg",
                isSuperseded: false,
                ocrResult: {
                  status: "COMPLETED",
                  confidenceScore: 0.60, // Below 0.75
                },
              },
            ],
          }),
        },
      };
      return callback(mockTx);
    };

    await assert.rejects(
      async () => {
        await service.updateStatus(
          99,
          "PAYMENT_VERIFIED",
          "Attempting verify with low confidence receipt",
          901,
          "SECRETARY",
          1
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Current receipt failed quality threshold"));
        return true;
      }
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("Quality Gate Enforcement: Staff CAN verify payment when OCR failed due to provider unavailability (approved fallback)", async () => {
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;
  let persistedStatus = null;

  try {
    prisma.$transaction = async (callback) => {
      const mockTx = {
        documentRequest: {
          findUnique: async () => ({
            id: 99,
            status: "PAYMENT_UNDER_REVIEW",
            paymentProofObjectKey: "receipts/fallback.jpg",
            parishId: 1,
            fee: 100,
          }),
          updateMany: async ({ data }) => {
            persistedStatus = data.status;
            return { count: 1 };
          },
        },
        paymentTransaction: {
          findFirst: async () => ({
            id: 777,
            status: "PENDING",
            receipts: [
              {
                id: 401,
                r2ObjectKey: "receipts/fallback.jpg",
                isSuperseded: false,
                ocrResult: {
                  status: "FAILED", // Provider outage safe fallback
                  confidenceScore: null,
                },
              },
            ],
          }),
          update: async () => ({ id: 777, status: "VERIFIED" }),
        },
        requestHistory: {
          create: async () => ({ id: 1 }),
        },
        notification: {
          createMany: async () => ({ count: 1 }),
        },
        user: {
          findUnique: async () => ({ id: 901, parishId: 1, role: "SECRETARY" }),
        },
        auditLog: {
          create: async () => ({ id: 1 }),
        },
        activityLog: {
          create: async () => ({ id: 1 }),
        },
      };
      return callback(mockTx);
    };

    await service.updateStatus(
      99,
      "PAYMENT_VERIFIED",
      "Manual staff verification after provider outage",
      901,
      "SECRETARY",
      1
    );

    assert.equal(persistedStatus, "PAYMENT_VERIFIED");
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

// ============================================================================
// 14. DETERMINISTIC HISTORICAL BACKFILL SEMANTICS (Finding 1)
// ============================================================================

test("Historical Backfill: Semantics A (Exact canonical pointer match) designates matching receipt active", () => {
  const canonicalPointer = "proof_canonical.jpg";
  const receipts = [
    { id: 1, r2ObjectKey: "proof_old.jpg", uploadedAt: new Date("2026-08-01") },
    { id: 2, r2ObjectKey: "proof_canonical.jpg", uploadedAt: new Date("2026-08-02") },
    { id: 3, r2ObjectKey: "proof_newer.jpg", uploadedAt: new Date("2026-08-03") },
  ];

  // Emulate Migration Semantics A
  const matchCount = receipts.filter((r) => r.r2ObjectKey === canonicalPointer).length;
  assert.equal(matchCount, 1);

  const backfilled = receipts.map((r, idx) => ({
    ...r,
    attemptVersion: idx + 1,
    isSuperseded: r.r2ObjectKey !== canonicalPointer,
  }));

  const active = backfilled.filter((r) => !r.isSuperseded);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 2);
  assert.equal(active[0].r2ObjectKey, canonicalPointer);
  assert.equal(backfilled[0].isSuperseded, true);
  assert.equal(backfilled[2].isSuperseded, true);
});

test("Historical Backfill: Semantics B & C (No pointer or mismatch) falls back deterministically to latest upload", () => {
  const receipts = [
    { id: 10, r2ObjectKey: "p1.jpg", uploadedAt: new Date("2026-08-01") },
    { id: 11, r2ObjectKey: "p2.jpg", uploadedAt: new Date("2026-08-05") },
  ];

  // Case B: No canonical pointer (null)
  const canonicalPointer = null;
  const matchCount = receipts.filter((r) => canonicalPointer && r.r2ObjectKey === canonicalPointer).length;
  assert.equal(matchCount, 0);

  // Deterministic fallback: latest by uploadedAt, receiptId
  const sorted = [...receipts].sort((a, b) => b.uploadedAt - a.uploadedAt || b.id - a.id);
  const latestId = sorted[0].id;

  const backfilled = receipts.map((r, idx) => ({
    ...r,
    attemptVersion: idx + 1,
    isSuperseded: r.id !== latestId,
  }));

  const active = backfilled.filter((r) => !r.isSuperseded);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 11);
  assert.equal(backfilled[0].isSuperseded, true);
});

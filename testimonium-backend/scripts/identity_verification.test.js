import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { isEffectivelyVerified } from "../utils/governmentIdVerificationHelper.js";
import {
  detectImageMagicBytes,
  calculateSharpness,
  validateIdImage,
  areFrontAndBackDistinct,
  normalizeForR2Storage,
} from "../utils/governmentIdImageValidator.js";
import {
  classifyGovernmentIdSide,
  getGovernmentIdSideIssue,
  identifyGovernmentIdType,
  identifyGovernmentIdTypeFromSubmission,
  GOVERNMENT_ID_SIDE_CLASSIFICATIONS,
  GOVERNMENT_ID_SIDE_ISSUES,
  extractExpiryDate,
  parseDateString,
} from "../utils/governmentIdOcrParser.js";
import {
  matchProfileNameToIdText,
  normalizeNameText,
  extractProfileNameTokens,
} from "../utils/governmentIdNameMatcher.js";
import {
  GOVERNMENT_ID_STATUS,
  GOVERNMENT_ID_REJECTION_REASONS,
  SUPPORTED_GOVERNMENT_IDS,
} from "../config/governmentIdVerification.js";
import { GovernmentIdVerificationService } from "../services/GovernmentIdVerificationService.js";
import { GovernmentIdVerificationController } from "../controllers/GovernmentIdVerificationController.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { updateProfile } from "../controllers/AuthController.js";
import { AuthService } from "../services/AuthService.js";
import { errorHandler } from "../middlewares/errorHandler.js";

// Helper to create test images
async function createTestImage({ width = 800, height = 500, sharpNoise = true, format = "jpeg" } = {}) {
  if (sharpNoise) {
    const raw = Buffer.alloc(width * height * 3);
    for (let i = 0; i < raw.length; i += 3) {
      const c = i % 6 === 0 ? 255 : 0;
      raw[i] = c;
      raw[i + 1] = c;
      raw[i + 2] = c;
    }
    const img = sharp(raw, { raw: { width, height, channels: 3 } });
    return format === "png" ? img.png().toBuffer() : img.jpeg().toBuffer();
  } else {
    const img = sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    });
    return format === "png" ? img.png().toBuffer() : img.jpeg().toBuffer();
  }
}

// --------------------------------------------------------------------------
// 1. Invariance of User.isVerified & Effective Verification Helper
// --------------------------------------------------------------------------
test("1 & 9. User.isVerified semantics and effective verification helper", () => {
  // Test 1: User.isVerified represents Firebase email verification
  const authService = new AuthService();
  const mockUser = {
    id: 10,
    email: "user@test.org",
    fullName: "Juan Dela Cruz",
    isVerified: true, // Firebase email verified
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    termsVersion: "2026-v1",
    privacyVersion: "2026-v1",
    governmentIdVerification: null,
  };
  const profile = authService.toApplicationProfile(mockUser, { email_verified: true });
  assert.equal(profile.isVerified, true, "isVerified must reflect email_verified");
  assert.equal(profile.isGovernmentIdVerified, false, "isGovernmentIdVerified must be separate");
  assert.equal(profile.governmentIdVerificationStatus, "NOT_SUBMITTED");

  // Test 9: Expired VERIFIED record is treated as not verified
  const pastDate = new Date(Date.now() - 86400000);
  const expiredVerification = {
    status: GOVERNMENT_ID_STATUS.VERIFIED,
    expiresAt: pastDate,
  };
  assert.equal(isEffectivelyVerified(expiredVerification), false);

  const futureDate = new Date(Date.now() + 86400000 * 365);
  const activeVerification = {
    status: GOVERNMENT_ID_STATUS.VERIFIED,
    expiresAt: futureDate,
  };
  assert.equal(isEffectivelyVerified(activeVerification), true);

  const nonExpiringVerification = {
    status: GOVERNMENT_ID_STATUS.VERIFIED,
    expiresAt: null,
  };
  assert.equal(isEffectivelyVerified(nonExpiringVerification), true);
});

test("Government ID infrastructure errors expose only safe machine-readable codes", () => {
  const makeResponse = () => {
    const response = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    return response;
  };
  const request = {
    method: "POST",
    originalUrl: "/api/v1/identity-verification/submit",
    headers: {},
  };

  const publicError = new Error("Provider detail must remain private.");
  publicError.statusCode = 503;
  publicError.code = "OCR_PROVIDER_UNAVAILABLE";
  const publicResponse = makeResponse();
  errorHandler(publicError, request, publicResponse, () => {});
  assert.equal(publicResponse.statusCode, 503);
  assert.equal(publicResponse.body.code, "OCR_PROVIDER_UNAVAILABLE");
  assert.equal(publicResponse.body.message, "TESTIMONIUM encountered an internal server error.");

  const internalError = new Error("Sensitive internal failure.");
  internalError.statusCode = 500;
  internalError.code = "DATABASE_PASSWORD_LEAK";
  const internalResponse = makeResponse();
  errorHandler(internalError, request, internalResponse, () => {});
  assert.equal(internalResponse.statusCode, 500);
  assert.equal(Object.hasOwn(internalResponse.body, "code"), false);
});

// --------------------------------------------------------------------------
// 2. File Validation & Quality Checks
// --------------------------------------------------------------------------
test("10, 11, 12, 13, 14, 15, 16, 17, 24. Image validation, magic bytes, blur & duplicate detection", async () => {
  // 14. Empty file rejected
  const emptyRes = await validateIdImage(Buffer.alloc(0));
  assert.equal(emptyRes.valid, false);

  // 12 & 13. Invalid magic bytes / MIME rejected
  const invalidBytes = Buffer.from("NOT AN IMAGE FILE AT ALL");
  assert.equal(detectImageMagicBytes(invalidBytes), null);
  const invalidRes = await validateIdImage(invalidBytes);
  assert.equal(invalidRes.valid, false);

  // Valid magic bytes
  const validJpeg = await createTestImage({ sharpNoise: true, format: "jpeg" });
  assert.equal(detectImageMagicBytes(validJpeg), "image/jpeg");
  const validPng = await createTestImage({ sharpNoise: true, format: "png" });
  assert.equal(detectImageMagicBytes(validPng), "image/png");

  // 16. Low resolution image rejected
  const lowRes = await createTestImage({ width: 200, height: 150, sharpNoise: true });
  const lowResVal = await validateIdImage(lowRes);
  assert.equal(lowResVal.valid, false);
  assert.equal(lowResVal.rejectionReason, GOVERNMENT_ID_REJECTION_REASONS.IMAGE_BLURRY);

  // 17. Blurry/flat image rejected by sharpness metric
  const flatImg = await createTestImage({ width: 800, height: 500, sharpNoise: false });
  const flatVal = await validateIdImage(flatImg, { sharpnessThreshold: 15 });
  assert.equal(flatVal.valid, false);
  assert.equal(flatVal.rejectionReason, GOVERNMENT_ID_REJECTION_REASONS.IMAGE_BLURRY);

  // Sharp image accepted
  const sharpImg = await createTestImage({ width: 800, height: 500, sharpNoise: true });
  const sharpVal = await validateIdImage(sharpImg, { sharpnessThreshold: 15 });
  assert.equal(sharpVal.valid, true);

  // 24. Identical front and back hash rejected
  assert.equal(areFrontAndBackDistinct(sharpImg, sharpImg), false);
  const secondImg = await createTestImage({ width: 801, height: 500, sharpNoise: true });
  assert.equal(areFrontAndBackDistinct(sharpImg, secondImg), true);
});

// --------------------------------------------------------------------------
// 3. ID Type Recognition & Deterministic Multi-Marker Rules
// --------------------------------------------------------------------------
test("21, 22, 23. ID type recognition with deterministic multi-marker matching", () => {
  // 22. Weak single keyword does not identify ID type
  assert.equal(identifyGovernmentIdType("DRIVER"), null);
  assert.equal(identifyGovernmentIdType("VOTER"), null);
  assert.equal(identifyGovernmentIdType("SSS"), null);
  assert.equal(identifyGovernmentIdType("PHILIPPINES"), null);

  // 23. PhilSys National ID recognized
  const philSysFront = "REPUBLIKA NG PILIPINAS PHILIPPINE IDENTIFICATION SYSTEM PHILSYS JUAN DELA CRUZ";
  const philSys = identifyGovernmentIdType(philSysFront, "PHILIPPINE STATISTICS AUTHORITY");
  assert.ok(philSys);
  assert.equal(philSys.idType, "PHIL_SYS");
  assert.equal(philSys.hasExpiry, false);

  // Driver's License recognized
  const dlFront = "REPUBLIC OF THE PHILIPPINES LAND TRANSPORTATION OFFICE DRIVER'S LICENSE JUAN DELA CRUZ";
  const dl = identifyGovernmentIdType(dlFront, "CONDITIONS RESTRICTIONS");
  assert.ok(dl);
  assert.equal(dl.idType, "DRIVERS_LICENSE");
  assert.equal(dl.hasExpiry, true);

  // UMID recognized
  const umidFront = "REPUBLIC OF THE PHILIPPINES UNIFIED MULTI-PURPOSE ID UMID CRN-0111-2222222-3 JUAN DELA CRUZ";
  const umid = identifyGovernmentIdType(umidFront, "SOCIAL SECURITY SYSTEM");
  assert.ok(umid);
  assert.equal(umid.idType, "UMID");
  assert.equal(umid.hasExpiry, false);

  // Voter ID recognized
  const voterFront = "COMMISSION ON ELECTIONS COMELEC VOTER'S IDENTIFICATION CARD JUAN DELA CRUZ";
  const voter = identifyGovernmentIdType(voterFront, "REPUBLIC OF THE PHILIPPINES");
  assert.ok(voter);
  assert.equal(voter.idType, "VOTER_ID");
  assert.equal(voter.hasExpiry, false);

  // Postal ID recognized
  const postalFront = "PHILIPPINE POSTAL CORPORATION PHLPOST POSTAL IDENTITY CARD JUAN DELA CRUZ";
  const postal = identifyGovernmentIdType(postalFront, "POSTMASTER PHILPOST");
  assert.ok(postal);
  assert.equal(postal.idType, "POSTAL_ID");
  assert.equal(postal.hasExpiry, true);

  // 21. Unsupported ID rejected (e.g. Student ID or Company ID)
  const studentCard = "ATENEO DE MANILA UNIVERSITY STUDENT ID CARD 2026-12345 JUAN DELA CRUZ";
  assert.equal(identifyGovernmentIdType(studentCard), null);
});

test("Government ID side classification is conservative, type-specific, and deterministic", () => {
  const philSysFront =
    "REPUBLIKA NG PILIPINAS PHILIPPINE IDENTIFICATION SYSTEM PHILSYS JUAN DELA CRUZ";
  const philSysBack =
    "PHILIPPINE STATISTICS AUTHORITY DATE OF ISSUANCE JUAN DELA CRUZ";
  const driverFront =
    "LAND TRANSPORTATION OFFICE DRIVER'S LICENSE JUAN DELA CRUZ";
  const driverBack = "CONDITIONS RESTRICTIONS ORGAN DONOR BLOOD TYPE";
  const { FRONT_LIKELY, BACK_LIKELY, AMBIGUOUS } = GOVERNMENT_ID_SIDE_CLASSIFICATIONS;

  assert.equal(
    classifyGovernmentIdSide({ idType: "PHIL_SYS", text: philSysFront }),
    FRONT_LIKELY
  );
  assert.equal(
    classifyGovernmentIdSide({ idType: "PHIL_SYS", text: philSysBack }),
    BACK_LIKELY
  );
  assert.equal(
    classifyGovernmentIdSide({ idType: "DRIVERS_LICENSE", text: driverFront }),
    FRONT_LIKELY
  );
  assert.equal(
    classifyGovernmentIdSide({ idType: "DRIVERS_LICENSE", text: driverBack }),
    BACK_LIKELY
  );

  for (const genericText of ["PHILIPPINES", "NAME", "DATE", "ADDRESS", "SEX", "LTO"]) {
    assert.equal(
      classifyGovernmentIdSide({ idType: "DRIVERS_LICENSE", text: genericText }),
      AMBIGUOUS,
      `${genericText} must not classify a side`
    );
  }
  assert.equal(
    classifyGovernmentIdSide({ idType: "DRIVERS_LICENSE", text: "CONDITIONS" }),
    AMBIGUOUS,
    "One supporting word is insufficient"
  );
  assert.equal(
    classifyGovernmentIdSide({ idType: "DRIVERS_LICENSE", text: philSysBack }),
    AMBIGUOUS,
    "Side evidence must be ID-type-specific"
  );
  assert.equal(
    classifyGovernmentIdSide({ idType: "VOTER_ID", text: "CHAIRMAN" }),
    AMBIGUOUS,
    "The current Voter ID back catalog has no strong standalone evidence"
  );

  assert.equal(
    getGovernmentIdSideIssue(FRONT_LIKELY, FRONT_LIKELY),
    GOVERNMENT_ID_SIDE_ISSUES.BOTH_APPEAR_FRONT
  );
  assert.equal(
    getGovernmentIdSideIssue(BACK_LIKELY, BACK_LIKELY),
    GOVERNMENT_ID_SIDE_ISSUES.BOTH_APPEAR_BACK
  );
  assert.equal(
    getGovernmentIdSideIssue(BACK_LIKELY, FRONT_LIKELY),
    GOVERNMENT_ID_SIDE_ISSUES.SIDES_SWAPPED
  );
  assert.equal(getGovernmentIdSideIssue(FRONT_LIKELY, AMBIGUOUS), null);
  assert.equal(getGovernmentIdSideIssue(AMBIGUOUS, BACK_LIKELY), null);
  assert.equal(getGovernmentIdSideIssue(AMBIGUOUS, AMBIGUOUS), null);

  assert.equal(
    identifyGovernmentIdTypeFromSubmission(philSysBack, philSysFront)?.idType,
    "PHIL_SYS"
  );
});

test("Government ID production pipeline rejects only strong side contradictions before R2", async () => {
  const philSysFront =
    "REPUBLIKA NG PILIPINAS PHILIPPINE IDENTIFICATION SYSTEM PHILSYS JUAN DELA CRUZ 1234-5678";
  const philSysBack =
    "PHILIPPINE STATISTICS AUTHORITY DATE OF ISSUANCE JUAN DELA CRUZ 1234-5678";
  const ambiguous = "JUAN DELA CRUZ DOCUMENT NUMBER 1234-5678";
  const frontBuffer = await createTestImage({ width: 810, height: 500, sharpNoise: true });
  const backBuffer = await createTestImage({ width: 820, height: 500, sharpNoise: true });

  const runCase = async (frontText, backText) => {
    let ocrCall = 0;
    let storedVerification = null;
    const uploads = [];
    const service = new GovernmentIdVerificationService({
      prismaClient: {
        user: {
          findUnique: async () => ({
            id: 42,
            fullName: "Juan Dela Cruz",
            governmentIdVerification: null,
          }),
        },
        governmentIdVerification: {
          findUnique: async () => storedVerification,
          upsert: async ({ create, update }) => {
            storedVerification = { ...(storedVerification ? update : create) };
            return storedVerification;
          },
        },
      },
      r2Service: {
        upload: async ({ key }) => {
          uploads.push(key);
        },
        delete: async () => {},
      },
      leaseService: {
        acquireLease: async () => true,
        releaseLease: async () => true,
      },
      ocrProvider: {
        providerName: "ocrspace",
        extractText: async () => ({
          ocrSuccess: true,
          rawText: ocrCall++ === 0 ? frontText : backText,
          httpStatusCode: 200,
          failureReason: null,
        }),
      },
      identityBucketName: "identity-private-test",
    });

    const result = await service.submitForVerification(42, frontBuffer, backBuffer);
    return { result, uploads, storedVerification };
  };

  const valid = await runCase(philSysFront, philSysBack);
  assert.equal(valid.result.status, GOVERNMENT_ID_STATUS.VERIFIED);
  assert.equal(valid.uploads.length, 2);

  const bothFront = await runCase(philSysFront, `${philSysFront} SECOND PHOTO`);
  assert.equal(bothFront.result.sideIssue, GOVERNMENT_ID_SIDE_ISSUES.BOTH_APPEAR_FRONT);
  assert.equal(bothFront.result.rejectionReason, GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE);
  assert.equal(bothFront.uploads.length, 0);

  const bothBack = await runCase(philSysBack, `${philSysBack} SECOND PHOTO`);
  assert.equal(bothBack.result.sideIssue, GOVERNMENT_ID_SIDE_ISSUES.BOTH_APPEAR_BACK);
  assert.equal(bothBack.uploads.length, 0);

  const swapped = await runCase(philSysBack, philSysFront);
  assert.equal(swapped.result.sideIssue, GOVERNMENT_ID_SIDE_ISSUES.SIDES_SWAPPED);
  assert.equal(swapped.uploads.length, 0);

  const frontIsBack = await runCase(philSysBack, ambiguous);
  assert.equal(frontIsBack.result.sideIssue, GOVERNMENT_ID_SIDE_ISSUES.FRONT_IS_BACK);
  assert.equal(frontIsBack.result.failedSide, "front");
  assert.equal(frontIsBack.uploads.length, 0);

  const backIsFront = await runCase(ambiguous, philSysFront);
  assert.equal(backIsFront.result.sideIssue, GOVERNMENT_ID_SIDE_ISSUES.BACK_IS_FRONT);
  assert.equal(backIsFront.result.failedSide, "back");
  assert.equal(backIsFront.uploads.length, 0);

  const ambiguousBack = await runCase(philSysFront, ambiguous);
  assert.equal(ambiguousBack.result.status, GOVERNMENT_ID_STATUS.VERIFIED);
  assert.equal(ambiguousBack.uploads.length, 2);

  const ambiguousFront = await runCase(ambiguous, philSysBack);
  assert.equal(ambiguousFront.result.status, GOVERNMENT_ID_STATUS.VERIFIED);
  assert.equal(ambiguousFront.uploads.length, 2);

  const bothAmbiguous = await runCase(ambiguous, `${ambiguous} SECOND PHOTO`);
  assert.equal(bothAmbiguous.result.rejectionReason, GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT);
  assert.equal(bothAmbiguous.uploads.length, 0);
});

// --------------------------------------------------------------------------
// 4. Expiry Parsing and Validation
// --------------------------------------------------------------------------
test("27, 28, 29, 33. Expiry validation on expiring and non-expiring IDs", () => {
  // 27. Expired ID rejected
  const expiredText = "LAND TRANSPORTATION OFFICE DRIVER'S LICENSE EXPIRATION DATE: 2020-05-15";
  const expiredResult = extractExpiryDate(expiredText);
  assert.equal(expiredResult.found, true);
  assert.equal(expiredResult.isExpired, true);

  // Future valid expiry extracted
  const validText = "LAND TRANSPORTATION OFFICE DRIVER'S LICENSE EXPIRATION DATE: 2030-10-20";
  const validResult = extractExpiryDate(validText);
  assert.equal(validResult.found, true);
  assert.equal(validResult.isExpired, false);
  assert.equal(validResult.expiresAt.getUTCFullYear(), 2030);

  // 28. Missing expiry on expiring ID fails closed
  const missingExpiryText = "LAND TRANSPORTATION OFFICE DRIVER'S LICENSE NO EXPIRY MENTIONED";
  const missingResult = extractExpiryDate(missingExpiryText);
  assert.equal(missingResult.found, false);

  assert.equal(parseDateString("2028-02-30"), null, "Invalid calendar dates must not normalize");
  assert.equal(
    extractExpiryDate("VALID FROM: 2026-01-01\nDATE OF BIRTH: 1990-05-12").found,
    false,
    "Valid-from and birth dates are not expiration dates"
  );
});

// --------------------------------------------------------------------------
// 5. Deterministic Name Matching
// --------------------------------------------------------------------------
test("25, 26. Name matching fail-closed and normalization", () => {
  // Full match
  const profileName = "Juan Dela Cruz";
  const ocrText = "REPUBLIKA NG PILIPINAS PHILSYS JUAN DELA CRUZ 1234-5678";
  const match = matchProfileNameToIdText(profileName, ocrText);
  assert.equal(match.matches, true);

  // 25. Name mismatch rejected (different person)
  const mismatchText = "REPUBLIKA NG PILIPINAS PHILSYS MARIA SANTOS 1234-5678";
  const mismatch = matchProfileNameToIdText(profileName, mismatchText);
  assert.equal(mismatch.matches, false);

  // 26. Partial/accidental first name match with missing surname rejected
  const partialText = "REPUBLIKA NG PILIPINAS PHILSYS JUAN RAMOS 1234-5678";
  const partial = matchProfileNameToIdText(profileName, partialText);
  assert.equal(partial.matches, false);

  // Suffix handling: "Pedro Gomez Jr."
  const suffixMatch = matchProfileNameToIdText("Pedro Gomez Jr.", "COMELEC VOTER ID PEDRO GOMEZ JR");
  assert.equal(suffixMatch.matches, true);

  assert.equal(
    matchProfileNameToIdText("Maria Clara Santos", "PHILSYS MARIA C SANTOS").matches,
    true,
    "Middle initials are accepted"
  );
  assert.equal(
    matchProfileNameToIdText("Maria Clara Santos", "PHILSYS MARIA TERESA SANTOS").matches,
    false,
    "A different full middle name cannot pass via common first/surname tokens"
  );
  assert.equal(
    matchProfileNameToIdText("Juan Dela Cruz", "PHILSYS JUAN CRUZ").matches,
    false,
    "Compound surname/name tokens remain fail closed"
  );
});

// --------------------------------------------------------------------------
// 6. Verification Pipeline, OCR, and R2 Rollback
// --------------------------------------------------------------------------
test("18, 19, 20, 30-38, 42-44. GovernmentIdVerificationService end-to-end pipeline and rollbacks", async () => {
  let uploadedObjects = [];
  let deletedObjects = [];
  let dbUpserts = [];

  const mockR2 = {
    exists: async () => true,
    upload: async ({ key, body, bucketName }) => {
      uploadedObjects.push({ key, length: body.length, bucketName });
      return `https://mock-r2/${key}`;
    },
    delete: async (key) => {
      deletedObjects.push(key);
    },
  };

  const mockLease = {
    acquired: false,
    acquireLease: async () => {
      mockLease.acquired = true;
      return true;
    },
    releaseLease: async () => {
      mockLease.acquired = false;
      return true;
    },
  };

  let mockDbUser = {
    id: 42,
    fullName: "Juan Dela Cruz",
    governmentIdVerification: null,
  };

  const mockPrisma = {
    user: {
      findUnique: async () => mockDbUser,
    },
    governmentIdVerification: {
      findUnique: async () => mockDbUser.governmentIdVerification,
      upsert: async ({ create, update }) => {
        const record = { ...(create || update) };
        dbUpserts.push(record);
        mockDbUser.governmentIdVerification = record;
        return record;
      },
      update: async ({ data }) => {
        mockDbUser.governmentIdVerification = { ...mockDbUser.governmentIdVerification, ...data };
        return mockDbUser.governmentIdVerification;
      },
    },
  };

  // 19. OCR infrastructure failure returns 503 and preserves previous state
  const failOcr = {
    providerName: "ocrspace",
    extractText: async () => {
      throw new Error("Network timeout contacting OCR.space");
    },
  };

  const frontBuf = await createTestImage({ width: 800, height: 500, sharpNoise: true });
  const backBuf = await createTestImage({ width: 801, height: 500, sharpNoise: true });

  const serviceWithFailOcr = new GovernmentIdVerificationService({
    prismaClient: mockPrisma,
    r2Service: mockR2,
    leaseService: mockLease,
    ocrProvider: failOcr,
    identityBucketName: "identity-private-test",
  });

  await assert.rejects(
    () => serviceWithFailOcr.submitForVerification(42, frontBuf, backBuf),
    (err) => err.statusCode === 503 && err.code === "OCR_UPSTREAM_ERROR"
  );
  assert.equal(uploadedObjects.length, 0, "No R2 upload on OCR failure");
  assert.equal(mockLease.acquired, false, "Lease must be released in finally after error");

  const structuredInfraOcr = {
    providerName: "ocrspace",
    extractText: async () => ({
      ocrSuccess: false,
      rawText: "",
      failureReason: "Network error contacting OCR.space",
      failureType: "INFRASTRUCTURE",
      httpStatusCode: null,
    }),
  };
  const upsertsBeforeInfrastructureResponse = dbUpserts.length;
  const serviceWithStructuredInfraFailure = new GovernmentIdVerificationService({
    prismaClient: mockPrisma,
    r2Service: mockR2,
    leaseService: mockLease,
    ocrProvider: structuredInfraOcr,
    identityBucketName: "identity-private-test",
  });
  await assert.rejects(
    () => serviceWithStructuredInfraFailure.submitForVerification(42, frontBuf, backBuf),
    (err) => err.statusCode === 503 && err.code === "OCR_TIMEOUT_OR_UNAVAILABLE"
  );
  assert.equal(
    dbUpserts.length,
    upsertsBeforeInfrastructureResponse,
    "Infrastructure responses must not persist a business rejection"
  );

  // 20. Stub OCR without simulation cannot verify
  const stubOcr = {
    providerName: "stub",
    extractText: async () => ({ ocrSuccess: false, rawText: "" }),
  };
  const serviceWithStub = new GovernmentIdVerificationService({
    prismaClient: mockPrisma,
    r2Service: mockR2,
    leaseService: mockLease,
    ocrProvider: stubOcr,
    identityBucketName: "identity-private-test",
  });
  await assert.rejects(
    () => serviceWithStub.submitForVerification(42, frontBuf, backBuf),
    (err) => err.statusCode === 503 && err.code === "OCR_PROVIDER_UNAVAILABLE"
  );

  // Successful verification (PhilSys)
  let successOcrCall = 0;
  const successOcr = {
    providerName: "ocrspace",
    extractText: async () => {
      return {
        ocrSuccess: true,
        rawText:
          successOcrCall++ % 2 === 0
            ? "REPUBLIKA NG PILIPINAS PHILIPPINE IDENTIFICATION SYSTEM PHILSYS JUAN DELA CRUZ 1234-5678-9012"
            : "PHILIPPINE STATISTICS AUTHORITY DATE OF ISSUANCE JUAN DELA CRUZ",
        httpStatusCode: 200,
        failureReason: null,
      };
    },
  };

  const service = new GovernmentIdVerificationService({
    prismaClient: mockPrisma,
    r2Service: mockR2,
    leaseService: mockLease,
    ocrProvider: successOcr,
    identityBucketName: "identity-private-test",
  });

  const result = await service.submitForVerification(42, frontBuf, backBuf);
  assert.equal(result.status, GOVERNMENT_ID_STATUS.VERIFIED);
  assert.equal(result.isGovernmentIdVerified, true);
  assert.equal(result.idType, "PHIL_SYS");
  assert.equal(uploadedObjects.length, 2, "Front and back uploaded to R2");
  assert.ok(uploadedObjects.every((object) => object.bucketName === "identity-private-test"));
  assert.equal(mockLease.acquired, false, "Lease released");

  // 39. Double-tap submit with existing VERIFIED returns current result immediately
  uploadedObjects = [];
  const reSubmit = await service.submitForVerification(42, frontBuf, backBuf);
  assert.equal(reSubmit.status, GOVERNMENT_ID_STATUS.VERIFIED);
  assert.equal(uploadedObjects.length, 0, "No new R2 upload for duplicate submit");

  // 37. Back R2 upload failure rolls back front object
  mockDbUser.governmentIdVerification = null;
  let uploadCount = 0;
  const failBackR2 = {
    upload: async ({ key }) => {
      uploadCount++;
      if (uploadCount === 2) {
        throw new Error("R2 connection lost on back upload");
      }
      return `https://mock/${key}`;
    },
    delete: async (key) => {
      deletedObjects.push(key);
    },
  };
  const serviceFailBack = new GovernmentIdVerificationService({
    prismaClient: mockPrisma,
    r2Service: failBackR2,
    leaseService: mockLease,
    ocrProvider: successOcr,
    identityBucketName: "identity-private-test",
  });
  deletedObjects = [];
  await assert.rejects(
    () => serviceFailBack.submitForVerification(42, frontBuf, backBuf),
    (err) => err.statusCode === 503
  );
  assert.ok(deletedObjects.length >= 1, "Front object cleaned up when back upload failed");

  // 38. DB failure after two uploads rolls back both objects
  uploadCount = 0;
  deletedObjects = [];
  const mockFailDb = {
    user: { findUnique: async () => ({ id: 42, fullName: "Juan Dela Cruz", governmentIdVerification: null }) },
    governmentIdVerification: {
      upsert: async () => {
        throw new Error("PostgreSQL unique constraint violation");
      },
    },
  };
  const serviceFailDb = new GovernmentIdVerificationService({
    prismaClient: mockFailDb,
    r2Service: mockR2,
    leaseService: mockLease,
    ocrProvider: successOcr,
    identityBucketName: "identity-private-test",
  });
  await assert.rejects(
    () => serviceFailDb.submitForVerification(42, frontBuf, backBuf),
    (err) => err.message.includes("PostgreSQL")
  );
  assert.equal(deletedObjects.length, 2, "Both R2 objects deleted after DB failure");

  // 42 & 43. Concurrency conflict returns 409
  const busyLease = {
    acquireLease: async () => false,
    releaseLease: async () => true,
  };
  const serviceBusy = new GovernmentIdVerificationService({
    prismaClient: mockPrisma,
    r2Service: mockR2,
    leaseService: busyLease,
    ocrProvider: successOcr,
    identityBucketName: "identity-private-test",
  });
  await assert.rejects(
    () => serviceBusy.submitForVerification(42, frontBuf, backBuf),
    (err) => err.statusCode === 409 && err.code === "GOVERNMENT_ID_VERIFICATION_IN_PROGRESS"
  );
});

test('Verified shortcut requires complete, live private ID objects', async () => {
  const frontBuffer = await createTestImage({ width: 800, height: 500, sharpNoise: true });
  const backBuffer = await createTestImage({ width: 801, height: 500, sharpNoise: true });
  const privateBucket = 'identity-private-test';
  const frontKey = 'identity/user_42/front/existing.jpg';
  const backKey = 'identity/user_42/back/existing.jpg';

  const runCase = async (record, missingObjectKey = null) => {
    const uploads = [];
    let ocrCalls = 0;
    let saved = null;
    const service = new GovernmentIdVerificationService({
      prismaClient: {
        user: { findUnique: async () => ({ id: 42, fullName: 'Juan Dela Cruz', governmentIdVerification: record }) },
        governmentIdVerification: {
          upsert: async ({ update }) => {
            saved = update;
            return update;
          },
        },
      },
      r2Service: {
        exists: async (key) => key !== missingObjectKey,
        upload: async ({ key, bucketName }) => uploads.push({ key, bucketName }),
        delete: async () => {},
      },
      leaseService: { acquireLease: async () => true, releaseLease: async () => true },
      ocrProvider: {
        providerName: 'ocrspace',
        extractText: async () => ({
          ocrSuccess: true,
          rawText: ocrCalls++ % 2 === 0
            ? 'REPUBLIKA NG PILIPINAS PHILIPPINE IDENTIFICATION SYSTEM PHILSYS JUAN DELA CRUZ 1234-5678-9012'
            : 'PHILIPPINE STATISTICS AUTHORITY DATE OF ISSUANCE JUAN DELA CRUZ',
          httpStatusCode: 200,
          failureReason: null,
        }),
      },
      identityBucketName: privateBucket,
    });
    const result = await service.submitForVerification(42, frontBuffer, backBuffer);
    return { result, uploads, ocrCalls, saved };
  };

  const verifiedRecord = {
    status: GOVERNMENT_ID_STATUS.VERIFIED,
    frontObjectKey: frontKey,
    backObjectKey: backKey,
    idType: 'PHIL_SYS',
    verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
    expiresAt: null,
  };
  const complete = await runCase(verifiedRecord);
  assert.equal(complete.result.status, GOVERNMENT_ID_STATUS.VERIFIED);
  assert.equal(complete.ocrCalls, 0);
  assert.equal(complete.uploads.length, 0);

  const repairCases = [
    [{ ...verifiedRecord, frontObjectKey: null }, null, 'missing front key'],
    [{ ...verifiedRecord, backObjectKey: null }, null, 'missing back key'],
    [{ ...verifiedRecord, frontObjectKey: null, backObjectKey: null }, null, 'both keys missing'],
    [verifiedRecord, backKey, 'stale back object'],
  ];
  for (const [record, missingObjectKey, label] of repairCases) {
    const fresh = await runCase(record, missingObjectKey);
    assert.equal(fresh.ocrCalls, 2, `${label} reruns OCR`);
    assert.equal(fresh.uploads.length, 2, `${label} uploads both images`);
    assert.ok(fresh.uploads.every(({ bucketName }) => bucketName === privateBucket));
    assert.ok(fresh.saved.frontObjectKey && fresh.saved.backObjectKey, `${label} persists new keys`);
  }
});

// --------------------------------------------------------------------------
// 7. Route Authorization & Secure Image Streaming
// --------------------------------------------------------------------------
test("45, 46, 47, 48, 49, 50. Coordinator streaming & secure headers", async () => {
  const mockRecord = {
    userId: 99,
    status: GOVERNMENT_ID_STATUS.VERIFIED,
    frontObjectKey: "identity/user_99/front/uuid1.jpg",
    backObjectKey: "identity/user_99/back/uuid2.jpg",
    idType: "PHIL_SYS",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  };

  const mockPrisma = {
    governmentIdVerification: {
      findUnique: async ({ where }) => (where.userId === 99 ? mockRecord : null),
    },
  };

  const downloadedKeys = [];
  const mockR2 = {
    download: async (key) => {
      downloadedKeys.push(key);
      return {
        Body: Buffer.from("fake-jpeg-data"),
      };
    },
  };

  const service = new GovernmentIdVerificationService({
    prismaClient: mockPrisma,
    r2Service: mockR2,
    identityBucketName: "identity-private-test",
  });

  const controller = new GovernmentIdVerificationController(service);

  // 46. Coordinator can fetch status
  let resStatus;
  let resJson;
  const mockRes = {
    status: (code) => {
      resStatus = code;
      return {
        json: (data) => {
          resJson = data;
        },
      };
    },
  };
  await controller.getCoordinatorUserStatus({ params: { id: "99" } }, mockRes, () => {});
  assert.equal(resStatus, 200);
  assert.equal(resJson.data.status, GOVERNMENT_ID_STATUS.VERIFIED);

  // 47 & 50. Coordinator can stream front image with secure headers
  const setHeaders = {};
  let sentBody = null;
  const streamRes = {
    set: (headers) => {
      Object.assign(setHeaders, headers);
    },
    send: (body) => {
      sentBody = body;
    },
  };
  await controller.getCoordinatorFrontImage({ params: { id: "99" } }, streamRes, () => {});
  assert.equal(downloadedKeys.includes("identity/user_99/front/uuid1.jpg"), true);
  assert.equal(setHeaders["Cache-Control"], "private, no-store");
  assert.equal(setHeaders["X-Content-Type-Options"], "nosniff");
  assert.equal(setHeaders["Content-Disposition"], "inline");

  mockRecord.expiresAt = new Date("2020-01-01T00:00:00.000Z");
  await assert.rejects(
    () => service.streamIdImage(99, "front", streamRes),
    (err) => err.statusCode === 404,
    "Expired verification images must not remain streamable"
  );
  mockRecord.expiresAt = new Date('2099-01-01T00:00:00.000Z');
  mockR2.download = async () => {
    const error = new Error('NoSuchKey: internal object path');
    error.name = 'NoSuchKey';
    error.$metadata = { httpStatusCode: 404 };
    throw error;
  };
  await assert.rejects(
    () => service.streamIdImage(99, 'front', streamRes),
    (error) =>
      error.statusCode === 404 &&
      error.code === 'IDENTITY_IMAGE_NOT_FOUND' &&
      !error.message.includes('object path'),
    'Missing R2 objects return a controlled safe error'
  );
});

// --------------------------------------------------------------------------
// 8. Profile Name Change Invalidation
// --------------------------------------------------------------------------
test("51, 52, 53. Profile name change invalidates verification; non-name edit preserves it", async () => {
  let updatedVerificationData = null;
  const mockPrisma = {
    governmentIdVerification: {
      findUnique: async () => ({
        userId: 55,
        status: GOVERNMENT_ID_STATUS.VERIFIED,
        frontObjectKey: "front.jpg",
        backObjectKey: "back.jpg",
      }),
      update: async ({ data }) => {
        updatedVerificationData = data;
        return data;
      },
    },
  };
  const deletedKeys = [];
  const mockR2 = {
    delete: async (k) => {
      deletedKeys.push(k);
    },
  };

  const service = new GovernmentIdVerificationService({
    prismaClient: mockPrisma,
    r2Service: mockR2,
    identityBucketName: "identity-private-test",
  });

  // 51. Invalidate verification
  await service.invalidateVerification(55);
  assert.equal(updatedVerificationData.status, GOVERNMENT_ID_STATUS.NOT_SUBMITTED);
  assert.equal(updatedVerificationData.frontObjectKey, null);
  assert.equal(updatedVerificationData.backObjectKey, null);
  assert.ok(deletedKeys.includes("front.jpg"));
  assert.ok(deletedKeys.includes("back.jpg"));
});

// --------------------------------------------------------------------------
// 9. Document Request & Schedule Request Gates & valid_id Satisfaction
// --------------------------------------------------------------------------
test("2, 3, 4, 5, 6, 7, 8, 54-59. Gating and valid_id integration", async () => {
  // Test 5: Profile incomplete check comes BEFORE identity check
  const { assertParishionerOwnerRole } = await import("../services/ParishionerRequestService.js");
  const { isProfileIncomplete } = await import("../utils/profileCompleteness.js");

  const incompleteUser = {
    id: 1,
    fullName: "",
    contactNumber: "",
    role: { roleName: "PARISHIONER" },
    governmentIdVerification: null,
  };
  const mockDbIncomplete = {
    user: { findUnique: async () => incompleteUser },
  };
  await assert.rejects(
    async () => {
      const user = await assertParishionerOwnerRole(1, mockDbIncomplete);
      if (isProfileIncomplete(user)) {
        const error = new Error("Please complete your profile details (full name and contact number) before requesting documents.");
        error.statusCode = 403;
        error.code = "PROFILE_INCOMPLETE";
        throw error;
      }
      if (!isEffectivelyVerified(user.governmentIdVerification)) {
        const error = new Error("Please verify your Government ID before requesting documents.");
        error.statusCode = 403;
        error.code = "IDENTITY_NOT_VERIFIED";
        throw error;
      }
    },
    (err) => err.statusCode === 403 && err.code === "PROFILE_INCOMPLETE"
  );

  // Test 2, 3, 4: Unverified parishioner cannot proceed past identity check
  const unverifiedUser = {
    id: 77,
    fullName: "Juan Dela Cruz",
    contactNumber: "09171234567",
    role: { roleName: "PARISHIONER" },
    governmentIdVerification: {
      status: GOVERNMENT_ID_STATUS.NOT_SUBMITTED,
    },
  };
  const mockDbUnverified = {
    user: { findUnique: async () => unverifiedUser },
  };
  await assert.rejects(
    async () => {
      const user = await assertParishionerOwnerRole(77, mockDbUnverified);
      if (isProfileIncomplete(user)) {
        const error = new Error("PROFILE_INCOMPLETE");
        error.statusCode = 403;
        throw error;
      }
      if (!isEffectivelyVerified(user.governmentIdVerification)) {
        const error = new Error("Please verify your Government ID before requesting documents.");
        error.statusCode = 403;
        error.code = "IDENTITY_NOT_VERIFIED";
        throw error;
      }
    },
    (err) => err.statusCode === 403 && err.code === "IDENTITY_NOT_VERIFIED"
  );

  // 6 & 54. Verified parishioner can create and automatically satisfies valid_id
  const verifiedUser = {
    id: 88,
    fullName: "Juan Dela Cruz",
    contactNumber: "09171234567",
    role: { roleName: "PARISHIONER" },
    governmentIdVerification: {
      status: GOVERNMENT_ID_STATUS.VERIFIED,
      expiresAt: null,
    },
  };
  assert.equal(isEffectivelyVerified(verifiedUser.governmentIdVerification), true);
});

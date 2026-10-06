import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LegalPolicyServiceClass } from "../services/LegalPolicyService.js";
import { AuthService } from "../services/AuthService.js";
import { CANONICAL_TERMS_TEXT, CANONICAL_PRIVACY_TEXT } from "../config/canonicalLegalContent.js";
import { CorrectionReasonCode, CORRECTION_REASONS } from "../shared/constants.js";
import { updateRequestStatusSchema } from "../validators/requestSchemas.js";

const canonicalRows = () => [
  {
    policyType: "TERMS_OF_SERVICE", content: CANONICAL_TERMS_TEXT, revision: 1,
    effectiveAt: new Date("2026-08-01T00:00:00.000Z"), createdAt: new Date(), updatedAt: new Date(), updatedBy: null,
  },
  {
    policyType: "PRIVACY_POLICY", content: CANONICAL_PRIVACY_TEXT, revision: 1,
    effectiveAt: new Date("2026-08-01T00:00:00.000Z"), createdAt: new Date(), updatedAt: new Date(), updatedBy: null,
  },
];

const policyDb = {
  legalPolicy: { findMany: async () => canonicalRows() },
  $transaction: async (callback) => callback({
    $queryRaw: async () => [],
    legalPolicy: { findMany: async () => canonicalRows() },
    user: {},
  }),
};
const auditLogService = { logOrThrow: async () => {} };
const LegalPolicyService = new LegalPolicyServiceClass(policyDb, auditLogService);

test("legal migration embeds the exact canonical v1.0 corpus and constraints", () => {
  const migration = fs.readFileSync(new URL("../prisma/migrations/20261004120000_add_legal_policies/migration.sql", import.meta.url), "utf8");
  assert.ok(migration.includes(CANONICAL_TERMS_TEXT.replaceAll("'", "''")));
  assert.ok(migration.includes(CANONICAL_PRIVACY_TEXT.replaceAll("'", "''")));
  assert.match(migration, /legal_policies_revision_check/);
  assert.match(migration, /legal_policies_content_nonblank_check/);
  assert.match(migration, /legal_policies_content_length_check/);
});

test("Legal Policy Suite: Canonical v1.0 Public Content and Protection", async (t) => {
  await t.test("Public getCurrentPolicies returns canonical v1.0 without internal updater identity", async () => {
    const policies = await LegalPolicyService.getCurrentPolicies();
    assert.ok(policies.termsOfService);
    assert.ok(policies.privacyPolicy);

    assert.equal(policies.termsOfService.version, "v1.0");
    assert.equal(policies.termsOfService.revision, 1);
    assert.equal(policies.termsOfService.policyType, "TERMS_OF_SERVICE");
    assert.equal(policies.termsOfService.content, CANONICAL_TERMS_TEXT);
    assert.equal(policies.termsOfService.updatedById, undefined);
    assert.equal(policies.termsOfService.updatedBy, undefined);

    assert.equal(policies.privacyPolicy.version, "v1.0");
    assert.equal(policies.privacyPolicy.revision, 1);
    assert.equal(policies.privacyPolicy.policyType, "PRIVACY_POLICY");
    assert.equal(policies.privacyPolicy.content, CANONICAL_PRIVACY_TEXT);
    assert.equal(policies.privacyPolicy.updatedById, undefined);
    assert.equal(policies.privacyPolicy.updatedBy, undefined);
  });

  await t.test("Public policies return plain text safely without executing tags", async () => {
    const policies = await LegalPolicyService.getCurrentPolicies();
    // Must be returned as plain inert strings
    assert.equal(typeof policies.termsOfService.content, "string");
    assert.equal(typeof policies.privacyPolicy.content, "string");
  });

  await t.test("getManagePolicies returns safe updater metadata structure", async () => {
    const manage = await LegalPolicyService.getManagePolicies();
    assert.ok(manage.termsOfService);
    assert.ok(manage.privacyPolicy);
    assert.equal(manage.termsOfService.version, "v1.0");
    assert.equal(manage.termsOfService.revision, 1);
    assert.equal("updatedBy" in manage.termsOfService, true);
  });

  await t.test("missing table fails closed without runtime bootstrap", async () => {
    let writes = 0;
    const service = new LegalPolicyServiceClass({
      legalPolicy: {
        findMany: async () => { const error = new Error("relation does not exist"); error.code = "P2021"; throw error; },
        upsert: async () => { writes += 1; },
      },
    }, auditLogService);
    await assert.rejects(service.getCurrentPolicies(), (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "LEGAL_POLICY_CONFIGURATION_UNAVAILABLE");
      return true;
    });
    assert.equal(writes, 0);
  });

  await t.test("incomplete policy rows fail closed", async () => {
    const service = new LegalPolicyServiceClass({
      legalPolicy: { findMany: async () => canonicalRows().slice(0, 1) },
    }, auditLogService);
    await assert.rejects(service.getCurrentPolicies(), { code: "LEGAL_POLICY_CONFIGURATION_UNAVAILABLE" });
  });
});

test("Legal Policy Suite: Coordinator Publication, Concurrency & Validation", async (t) => {
  await t.test("Rejects invalid policy type with 400", async () => {
    await assert.rejects(
      async () => {
        await LegalPolicyService.updatePolicy("UNKNOWN_TYPE", { content: "test", expectedRevision: 1 }, 1);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "INVALID_POLICY_TYPE");
        return true;
      }
    );
  });

  await t.test("Rejects empty or whitespace-only content with 400", async () => {
    await assert.rejects(
      async () => {
        await LegalPolicyService.updatePolicy("TERMS_OF_SERVICE", { content: "   ", expectedRevision: 1 }, 1);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "EMPTY_POLICY_CONTENT");
        return true;
      }
    );
  });

  await t.test("Rejects content exceeding 50,000 characters with 400", async () => {
    const huge = "A".repeat(50001);
    await assert.rejects(
      async () => {
        await LegalPolicyService.updatePolicy("TERMS_OF_SERVICE", { content: huge, expectedRevision: 1 }, 1);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "POLICY_CONTENT_TOO_LARGE");
        return true;
      }
    );
  });

  await t.test("Rejects payload with unexpected fields with 400", async () => {
    await assert.rejects(
      async () => {
        await LegalPolicyService.updatePolicy("TERMS_OF_SERVICE", { content: "valid", expectedRevision: 1, extraField: "bad" }, 1);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "UNEXPECTED_FIELD");
        return true;
      }
    );
  });

  await t.test("Rejects invalid expectedRevision with 400", async () => {
    await assert.rejects(
      async () => {
        await LegalPolicyService.updatePolicy("TERMS_OF_SERVICE", { content: "valid", expectedRevision: 0 }, 1);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "INVALID_EXPECTED_REVISION");
        return true;
      }
    );
  });

  await t.test("publication locks the row and performs a revision-qualified update", async () => {
    const calls = [];
    let row = { ...canonicalRows()[0] };
    const tx = {
      $queryRaw: async () => { calls.push("lock"); return []; },
      legalPolicy: {
        findUnique: async () => ({ ...row }),
        updateMany: async ({ where, data }) => {
          calls.push(`cas:${where.revision}`);
          if (row.revision !== where.revision) return { count: 0 };
          row = { ...row, ...data, updatedAt: new Date(), updatedBy: { id: 7, fullName: "Coordinator" } };
          return { count: 1 };
        },
      },
    };
    const service = new LegalPolicyServiceClass(
      { $transaction: async (callback) => callback(tx) },
      { logOrThrow: async () => { calls.push("audit"); } },
    );
    const result = await service.updatePolicy("TERMS_OF_SERVICE", { content: "Revised content", expectedRevision: 1 }, 7);
    assert.equal(result.policy.revision, 2);
    assert.deepEqual(calls, ["lock", "cas:1", "audit"]);
  });
});

test("Legal Policy Suite: Independent User Acceptance & CAS Protection", async (t) => {
  const mockUser = {
    id: 999,
    termsAcceptedAt: new Date("2026-08-01"),
    termsVersion: "v1.0",
    privacyAcceptedAt: new Date("2026-08-01"),
    privacyVersion: "v1.0",
    isVerified: true,
  };

  const authService = new AuthService(undefined, undefined, LegalPolicyService, auditLogService);

  await t.test("toApplicationProfile computes Terms and Privacy acceptance independently", () => {
    // Both match v1.0
    const profile = authService.toApplicationProfile(mockUser, null, false, {
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
    });
    assert.equal(profile.termsAccepted, true);
    assert.equal(profile.privacyAccepted, true);

    // Terms bumped to v2.0, Privacy remains v1.0
    const staleTermsProfile = authService.toApplicationProfile(mockUser, null, false, {
      termsVersion: "v2.0",
      privacyVersion: "v1.0",
    });
    assert.equal(staleTermsProfile.termsAccepted, false);
    assert.equal(staleTermsProfile.privacyAccepted, true); // Privacy remains accepted!

    // Privacy bumped to v2.0, Terms remains v1.0
    const stalePrivacyProfile = authService.toApplicationProfile(mockUser, null, false, {
      termsVersion: "v1.0",
      privacyVersion: "v2.0",
    });
    assert.equal(stalePrivacyProfile.termsAccepted, true); // Terms remains accepted!
    assert.equal(stalePrivacyProfile.privacyAccepted, false);
  });

  await t.test("recordLegalAcceptance rejects stale version with 409 LEGAL_ACCEPTANCE_VERSION_CONFLICT", async () => {
    await assert.rejects(
      async () => {
        await authService.recordLegalAcceptance(999, {
          termsAccepted: true,
          termsVersion: "v0.9-stale",
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "LEGAL_ACCEPTANCE_VERSION_CONFLICT");
        return true;
      }
    );
  });

  await t.test("recordLegalAcceptance requires accepted: true", async () => {
    await assert.rejects(
      async () => {
        await authService.recordLegalAcceptance(999, {
          termsAccepted: false,
          termsVersion: "v1.0",
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "LEGAL_ACCEPTANCE_REQUIRED");
        return true;
      }
    );
  });
});

test("Objective 2 Backend Suite: Canonical Reasons & Status Transitions", async (t) => {
  await t.test("8 Canonical reasons are defined and match specified labels", () => {
    assert.equal(Object.keys(CorrectionReasonCode).length, 8);
    assert.equal(CorrectionReasonCode.UNCLEAR_OR_BLURRY, "UNCLEAR_OR_BLURRY");
    assert.equal(CorrectionReasonCode.WRONG_DOCUMENT, "WRONG_DOCUMENT");
    assert.equal(CorrectionReasonCode.INCOMPLETE_DOCUMENT, "INCOMPLETE_DOCUMENT");
    assert.equal(CorrectionReasonCode.CROPPED_INFORMATION, "CROPPED_INFORMATION");
    assert.equal(CorrectionReasonCode.APPLICANT_MISMATCH, "APPLICANT_MISMATCH");
    assert.equal(CorrectionReasonCode.EXPIRED_OR_INVALID, "EXPIRED_OR_INVALID");
    assert.equal(CorrectionReasonCode.INCORRECT_REQUIREMENT_FILE, "INCORRECT_REQUIREMENT_FILE");
    assert.equal(CorrectionReasonCode.OTHER, "OTHER");

    assert.equal(CORRECTION_REASONS.UNCLEAR_OR_BLURRY, "Unclear / blurry / unreadable document");
    assert.equal(CORRECTION_REASONS.WRONG_DOCUMENT, "Wrong document uploaded");
    assert.equal(CORRECTION_REASONS.INCOMPLETE_DOCUMENT, "Incomplete document / missing page or side");
    assert.equal(CORRECTION_REASONS.CROPPED_INFORMATION, "Cropped document / important information not visible");
    assert.equal(CORRECTION_REASONS.APPLICANT_MISMATCH, "Information does not match applicant/request");
    assert.equal(CORRECTION_REASONS.EXPIRED_OR_INVALID, "Expired / invalid document");
    assert.equal(CORRECTION_REASONS.INCORRECT_REQUIREMENT_FILE, "Incorrect file uploaded for this requirement");
    assert.equal(CORRECTION_REASONS.OTHER, "Other");
  });

  await t.test("NEEDS_CORRECTION transport schema accepts canonical payload and rejects bypasses", () => {
    const valid = {
      status: "NEEDS_CORRECTION",
      correctionReasonCode: "WRONG_DOCUMENT",
      correctionRequirementIds: ["valid_id"],
      correctionNote: "  Please upload the correct ID.  ",
    };
    const parsed = updateRequestStatusSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.correctionNote, "Please upload the correct ID.");
    assert.equal(updateRequestStatusSchema.safeParse({ ...valid, correctionReasonCode: "UNKNOWN" }).success, false);
    assert.equal(updateRequestStatusSchema.safeParse({ ...valid, correctionRequirementIds: ["valid_id", "valid_id"] }).success, false);
    assert.equal(updateRequestStatusSchema.safeParse({ status: "NEEDS_CORRECTION", remarks: "bypass" }).success, false);
    assert.equal(updateRequestStatusSchema.safeParse({ ...valid, correctionNote: "x".repeat(1001) }).success, false);
  });
});

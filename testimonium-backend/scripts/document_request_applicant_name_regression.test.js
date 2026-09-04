import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../config/db.js";
import { createRequestSchema } from "../validators/requestSchemas.js";
import { DocumentRequirementService } from "../services/DocumentRequirementService.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";

const service = new ParishionerRequestService();

test("Regression Test Suite: Document Request Applicant Identity & Hidden Required Fields", async (t) => {
  let testUserId = null;
  let parishId = 1;
  const createdDraftIds = [];

  // Setup: Find or prepare a user with a complete profile for transactional service tests
  const completeUser = await prisma.user.findFirst({
    where: {
      fullName: { not: "" },
      contactNumber: { not: "" },
    },
  });

  if (completeUser) {
    testUserId = completeUser.id;
  }

  const existingParish = await prisma.parish.findFirst({
    where: { id: 1 },
  });
  if (existingParish) {
    parishId = existingParish.id;
  }

  t.after(async () => {
    // Cleanup any test drafts created
    if (createdDraftIds.length > 0) {
      await prisma.requestHistory.deleteMany({
        where: { requestId: { in: createdDraftIds } },
      });
      await prisma.requestAttachment.deleteMany({
        where: { requestId: { in: createdDraftIds } },
      });
      await prisma.documentRequest.deleteMany({
        where: { id: { in: createdDraftIds } },
      });
    }
  });

  // --------------------------------------------------------------------------
  // 1. Baptismal Certificate: First + Last, no Middle -> passes applicant validation
  // --------------------------------------------------------------------------
  await t.test("1. Baptismal Certificate: First + Last, no Middle passes applicant validation", async () => {
    const payload = {
      parishId,
      documentType: "BAPTISMAL_CERTIFICATE",
      applicantFirstName: "Juan",
      applicantMiddleName: "",
      applicantLastName: "Dela Cruz",
      relationship: "Self",
      purpose: "Personal records / Identification",
    };

    // Zod Schema Level
    const parsed = createRequestSchema.safeParse(payload);
    assert.equal(parsed.success, true, "Zod schema should accept First + Last without Middle Name");

    // Service Level (if DB user is available)
    if (testUserId) {
      const draft = await service.createDraft(testUserId, payload);
      assert.ok(draft.id, "Draft should be created successfully");
      assert.equal(draft.applicantName, "Juan Dela Cruz");
      assert.equal(draft.isDraft, true);
      createdDraftIds.push(draft.id);
    }
  });

  // --------------------------------------------------------------------------
  // 2. Baptismal Certificate: First + Middle + Last -> passes applicant validation
  // --------------------------------------------------------------------------
  await t.test("2. Baptismal Certificate: First + Middle + Last passes applicant validation", async () => {
    const payload = {
      parishId,
      documentType: "BAPTISMAL_CERTIFICATE",
      applicantFirstName: "Juan",
      applicantMiddleName: "Santos",
      applicantLastName: "Dela Cruz",
      relationship: "Self",
      purpose: "Employment requirement",
    };

    // Zod Schema Level
    const parsed = createRequestSchema.safeParse(payload);
    assert.equal(parsed.success, true, "Zod schema should accept First + Middle + Last");

    // Service Level (if DB user is available)
    if (testUserId) {
      const draft = await service.createDraft(testUserId, payload);
      assert.ok(draft.id, "Draft should be created successfully");
      assert.equal(draft.applicantName, "Juan Santos Dela Cruz");
      assert.equal(draft.isDraft, true);
      createdDraftIds.push(draft.id);
    }
  });

  // --------------------------------------------------------------------------
  // 3. No "Full Name of Baptized Person" value is required
  // --------------------------------------------------------------------------
  await t.test("3. No 'Full Name of Baptized Person' value is required", async () => {
    // A. Requirements matrix metadata check
    const requirements = await DocumentRequirementService.getRequirements("BAPTISMAL_CERTIFICATE");
    const fieldIds = requirements.requiredFields.map((f) => f.id);
    const fieldLabels = requirements.requiredFields.map((f) => f.label);

    assert.equal(
      fieldIds.includes("applicantName"),
      false,
      "Metadata requiredFields must NOT contain obsolete applicantName ID"
    );
    assert.equal(
      fieldLabels.some((label) => label.toLowerCase().includes("baptized person")),
      false,
      "Metadata requiredFields must NOT contain 'Full Name of Baptized Person' label"
    );

    // B. Transactional creation without any 'Full Name of Baptized Person' input
    if (testUserId) {
      const payloadWithoutBaptizedPersonField = {
        parishId,
        documentType: "BAPTISMAL_CERTIFICATE",
        applicantFirstName: "Pedro",
        applicantLastName: "Penduko",
        relationship: "Self",
        purpose: "School Admission",
      };

      // Must succeed without throwing: Required field "Full Name of Baptized Person" is required.
      const draft = await service.createDraft(testUserId, payloadWithoutBaptizedPersonField);
      assert.ok(draft.id);
      assert.equal(draft.applicantName, "Pedro Penduko");
      createdDraftIds.push(draft.id);
    }
  });

  // --------------------------------------------------------------------------
  // 4. Missing First Name still fails
  // --------------------------------------------------------------------------
  await t.test("4. Missing First Name still fails", async () => {
    const payload = {
      parishId,
      documentType: "BAPTISMAL_CERTIFICATE",
      applicantFirstName: "",
      applicantLastName: "Dela Cruz",
      relationship: "Self",
      purpose: "Valid purpose",
    };

    // Zod Schema
    const parsed = createRequestSchema.safeParse(payload);
    assert.equal(parsed.success, false, "Schema should reject empty first name");
    const issues = parsed.error.issues;
    assert.ok(issues.some((i) => i.path.includes("applicantFirstName")));

    // Service Level
    if (testUserId) {
      await assert.rejects(
        () => service.createDraft(testUserId, payload),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_APPLICANT_NAME");
          return true;
        }
      );
    }
  });

  // --------------------------------------------------------------------------
  // 5. Missing Last Name still fails
  // --------------------------------------------------------------------------
  await t.test("5. Missing Last Name still fails", async () => {
    const payload = {
      parishId,
      documentType: "BAPTISMAL_CERTIFICATE",
      applicantFirstName: "Juan",
      applicantLastName: "",
      relationship: "Self",
      purpose: "Valid purpose",
    };

    // Zod Schema
    const parsed = createRequestSchema.safeParse(payload);
    assert.equal(parsed.success, false, "Schema should reject empty last name");
    const issues = parsed.error.issues;
    assert.ok(issues.some((i) => i.path.includes("applicantLastName")));

    // Service Level
    if (testUserId) {
      await assert.rejects(
        () => service.createDraft(testUserId, payload),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_APPLICANT_NAME");
          return true;
        }
      );
    }
  });

  // --------------------------------------------------------------------------
  // 6. Authorized Representative without Authorization Letter still fails with AUTHORIZATION_LETTER_REQUIRED
  // --------------------------------------------------------------------------
  await t.test(
    "6. Authorized Representative without Authorization Letter still fails with AUTHORIZATION_LETTER_REQUIRED",
    () => {
      assert.throws(
        () =>
          ParishionerRequestService.validateAuthorizationLetterRequirement(
            "Authorized Representative",
            []
          ),
        (err) => {
          assert.equal(err.code, "AUTHORIZATION_LETTER_REQUIRED");
          assert.equal(err.statusCode, 400);
          assert.ok(err.message.includes("authorization letter is required"));
          return true;
        }
      );

      // Also fails with only generic or other attachments
      assert.throws(
        () =>
          ParishionerRequestService.validateAuthorizationLetterRequirement(
            "Authorized Representative",
            [{ category: "valid_id", fileName: "id.jpg" }]
          ),
        (err) => {
          assert.equal(err.code, "AUTHORIZATION_LETTER_REQUIRED");
          return true;
        }
      );
    }
  );

  // --------------------------------------------------------------------------
  // 7. Authorized Representative with valid persisted Authorization Letter succeeds
  // --------------------------------------------------------------------------
  await t.test(
    "7. Authorized Representative with valid persisted Authorization Letter succeeds",
    () => {
      const validAttachments = [
        { category: "valid_id", fileName: "id.jpg" },
        { category: "authorization_letter", fileName: "auth_letter.pdf" },
      ];

      const result = ParishionerRequestService.validateAuthorizationLetterRequirement(
        "Authorized Representative",
        validAttachments
      );
      assert.equal(result, true, "Authorized Representative with authorization_letter must succeed");

      // Verify Self / Relative requests do NOT require authorization letter
      const selfResult = ParishionerRequestService.validateAuthorizationLetterRequirement(
        "Self",
        []
      );
      assert.equal(selfResult, true, "Self request must not require authorization letter");

      const relativeResult = ParishionerRequestService.validateAuthorizationLetterRequirement(
        "Parent",
        []
      );
      assert.equal(relativeResult, true, "Relative request must not require authorization letter");
    }
  );

  // --------------------------------------------------------------------------
  // 8. Existing configured upload requirements remain enforced
  // --------------------------------------------------------------------------
  await t.test("8. Existing configured upload requirements remain enforced", async () => {
    // Check Baptismal Certificate configured document requirements
    const baptismalReqs = await DocumentRequirementService.getRequirements("BAPTISMAL_CERTIFICATE");
    const validIdDoc = baptismalReqs.requiredDocuments.find((d) => d.id === "valid_id");
    assert.ok(validIdDoc, "valid_id must be configured in requiredDocuments");
    assert.equal(validIdDoc.required, true, "valid_id must be required");

    // Check Marriage Banns supporting requirements
    const bannsReqs = await DocumentRequirementService.getRequirements("MARRIAGE_BANNS");
    const requiredBannsDocIds = bannsReqs.requiredDocuments.filter((d) => d.required).map((d) => d.id);
    assert.ok(requiredBannsDocIds.includes("valid_id"), "Marriage Banns must require valid_id");
    assert.ok(requiredBannsDocIds.includes("baptismal_cert"), "Marriage Banns must require baptismal_cert");
    assert.ok(requiredBannsDocIds.includes("confirmation_cert"), "Marriage Banns must require confirmation_cert");

    // Check submitDraft enforcement of missing required attachments
    if (testUserId) {
      const draft = await service.createDraft(testUserId, {
        parishId,
        documentType: "BAPTISMAL_CERTIFICATE",
        applicantFirstName: "Ana",
        applicantLastName: "Santos",
        relationship: "Self",
        purpose: "Official Record",
      });
      createdDraftIds.push(draft.id);

      // Attempting to submit without attaching required valid_id must fail
      await assert.rejects(
        () => service.submitDraft(draft.id, testUserId),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.ok(
            err.message.includes("Cannot submit request without required attachments"),
            `Expected missing attachments error, got: ${err.message}`
          );
          return true;
        }
      );
    }
  });
});

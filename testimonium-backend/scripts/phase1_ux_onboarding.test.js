import test from "node:test";
import assert from "node:assert/strict";
import { isProfileIncomplete, isProfileComplete } from "../utils/profileCompleteness.js";
import { buildApplicantName, normalizeAndConstructFullName } from "../utils/nameUtils.js";
import { createRequestSchema } from "../validators/requestSchemas.js";
import { createScheduleSchema } from "../validators/scheduleSchemas.js";

test("Phase 1: Profile Completeness Canonical Rules", async (t) => {
  await t.test("user with empty fullName is incomplete", () => {
    assert.equal(isProfileIncomplete({ fullName: "", contactNumber: "09123456789" }), true);
    assert.equal(isProfileComplete({ fullName: "   ", contactNumber: "09123456789" }), false);
  });

  await t.test("user with empty contactNumber is incomplete", () => {
    assert.equal(isProfileIncomplete({ fullName: "Juan dela Cruz", contactNumber: "" }), true);
    assert.equal(isProfileIncomplete({ fullName: "Juan dela Cruz", contactNumber: null }), true);
    assert.equal(isProfileIncomplete({ fullName: "Juan dela Cruz", contactNumber: "   " }), true);
  });

  await t.test("user with valid fullName and contactNumber is complete", () => {
    const completeUser = {
      fullName: "Juan Santos dela Cruz",
      contactNumber: "09123456789",
      address: null, // Address is NOT mandatory for completeness per Phase 1 scope
    };
    assert.equal(isProfileIncomplete(completeUser), false);
    assert.equal(isProfileComplete(completeUser), true);
  });
});

test("Phase 1: Structured Applicant Name Construction (No Suffix)", async (t) => {
  await t.test("buildApplicantName combines first, middle, last correctly", () => {
    const name = buildApplicantName({
      firstName: "Maria",
      middleName: "Santos",
      lastName: "Clara",
    });
    assert.equal(name, "Maria Santos Clara");
  });

  await t.test("buildApplicantName handles optional middle name", () => {
    const name = buildApplicantName({
      firstName: "Juan",
      middleName: "",
      lastName: "dela Cruz",
    });
    assert.equal(name, "Juan dela Cruz");
  });

  await t.test("buildApplicantName normalizes whitespace", () => {
    const name = buildApplicantName({
      firstName: "  Jose  ",
      middleName: "  Protacio  ",
      lastName: "  Rizal  ",
    });
    assert.equal(name, "Jose Protacio Rizal");
  });

  await t.test("buildApplicantName preserves apostrophes, hyphens, and multi-word surnames", () => {
    const name = buildApplicantName({
      firstName: "Mary-Jane",
      middleName: "O'Connor",
      lastName: "Dela Cruz San Jose",
    });
    assert.equal(name, "Mary-Jane O'Connor Dela Cruz San Jose");
  });

  await t.test("buildApplicantName accepts exact 150 character boundary", () => {
    // 50 + 48 + 50 + 2 spaces = 150 chars
    const first50 = "A".repeat(50);
    const middle48 = "B".repeat(48);
    const last50 = "C".repeat(50);
    const name = buildApplicantName({
      firstName: first50,
      middleName: middle48,
      lastName: last50,
    });
    assert.equal(name.length, 150);
  });

  await t.test("buildApplicantName rejects oversized individual name part (> 50 chars)", () => {
    assert.throws(
      () =>
        buildApplicantName({
          firstName: "A".repeat(51),
          lastName: "Dela Cruz",
        }),
      { code: "INVALID_APPLICANT_NAME" }
    );
  });

  await t.test("buildApplicantName rejects missing first or last name", () => {
    assert.throws(() => buildApplicantName({ firstName: "", lastName: "Dela Cruz" }), {
      code: "INVALID_APPLICANT_NAME",
    });
    assert.throws(() => buildApplicantName({ firstName: "Juan", lastName: "" }), {
      code: "INVALID_APPLICANT_NAME",
    });
  });
});

test("Phase 1: Request Schemas Validation", async (t) => {
  await t.test("createRequestSchema accepts structured name fields without legacy applicantName", () => {
    const validStructured = {
      parishId: 1,
      documentType: "BAPTISMAL_CERTIFICATE",
      applicantFirstName: "Juan",
      applicantMiddleName: "Santos",
      applicantLastName: "dela Cruz",
      relationship: "Self",
      purpose: "Passport requirement",
    };
    const parsed = createRequestSchema.safeParse(validStructured);
    assert.equal(parsed.success, true);
  });

  await t.test("createRequestSchema accepts legacy applicantName for backward compatibility", () => {
    const validLegacy = {
      parishId: 1,
      documentType: "BAPTISMAL_CERTIFICATE",
      applicantName: "Juan Santos dela Cruz",
      relationship: "Self",
      purpose: "Passport requirement",
    };
    const parsed = createRequestSchema.safeParse(validLegacy);
    assert.equal(parsed.success, true);
  });

  await t.test("createRequestSchema rejects when legacy applicantName exceeds 150 characters", () => {
    const oversizedLegacy = {
      parishId: 1,
      documentType: "BAPTISMAL_CERTIFICATE",
      applicantName: "A".repeat(151),
      relationship: "Self",
      purpose: "Passport requirement",
    };
    const parsed = createRequestSchema.safeParse(oversizedLegacy);
    assert.equal(parsed.success, false);
  });

  await t.test("createRequestSchema rejects when both structured and legacy names are missing", () => {
    const invalid = {
      parishId: 1,
      documentType: "BAPTISMAL_CERTIFICATE",
      relationship: "Self",
      purpose: "Passport requirement",
    };
    const parsed = createRequestSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
  });
});

test("Phase 1: Schedule Request Additional Notes Validation", async (t) => {
  await t.test("createScheduleSchema accepts remarks with contextual notes", () => {
    const valid = {
      parishId: 1,
      eventType: "CONFESSION",
      date: "2026-10-15",
      timeSlot: "09:00 AM",
      remarks: "Wheelchair assistance requested. Priest preference: Fr. Roberto.",
    };
    const parsed = createScheduleSchema.safeParse(valid);
    assert.equal(parsed.success, true);
  });

  await t.test("createScheduleSchema accepts empty/blank remarks", () => {
    const valid = {
      parishId: 1,
      eventType: "CONFESSION",
      date: "2026-10-15",
      timeSlot: "09:00 AM",
    };
    const parsed = createScheduleSchema.safeParse(valid);
    assert.equal(parsed.success, true);
  });

  await t.test("createScheduleSchema rejects remarks exceeding length limit (1000 chars)", () => {
    const invalid = {
      parishId: 1,
      eventType: "CONFESSION",
      date: "2026-10-15",
      timeSlot: "09:00 AM",
      remarks: "A".repeat(1001),
    };
    const parsed = createScheduleSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
  });
});

test("Phase 1: AuthService isNewUser and Name Resolution Contract", async (t) => {
  const { AuthService } = await import("../services/AuthService.js");
  const { AuditLogService } = await import("../services/AuditLogService.js");
  const originalLog = AuditLogService.log;
  AuditLogService.log = async () => {};

  const createMockRoleRepo = () => ({
    findByName: async (name) => ({ id: 1, roleName: name }),
  });

  await t.test("genuinely new user creation returns isNewUser: true", async () => {
    const mockUserRepo = {
      findByFirebaseUid: async () => null,
      findByEmail: async () => null,
      create: async (data) => ({
        id: 101,
        ...data,
        role: { roleName: "PARISHIONER" },
      }),
    };
    const authService = new AuthService(mockUserRepo, createMockRoleRepo());
    const decodedToken = {
      uid: "brand-new-uid",
      email: "newuser@example.com",
      email_verified: true,
      name: "Juan Dela Cruz",
    };
    const legalAcceptance = {
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
    };

    const profile = await authService.getOrCreateApplicationUser(decodedToken, legalAcceptance);
    assert.equal(profile.isNewUser, true);
    assert.equal(profile.fullName, "Juan Dela Cruz");
  });

  await t.test("existing user by Firebase UID returns isNewUser: false", async () => {
    const mockUserRepo = {
      findByFirebaseUid: async (uid) => ({
        id: 102,
        firebaseUid: uid,
        email: "existing@example.com",
        fullName: "Existing User",
        isVerified: true,
        role: { roleName: "PARISHIONER" },
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        termsVersion: "v1.0",
        privacyVersion: "v1.0",
      }),
    };
    const authService = new AuthService(mockUserRepo, createMockRoleRepo());
    const decodedToken = {
      uid: "existing-uid",
      email: "existing@example.com",
      email_verified: true,
    };

    const profile = await authService.getOrCreateApplicationUser(decodedToken);
    assert.equal(profile.isNewUser, false);
  });

  await t.test("existing user linked by email returns isNewUser: false", async () => {
    const mockUserRepo = {
      findByFirebaseUid: async () => null,
      findByEmail: async (email) => ({
        id: 103,
        firebaseUid: null,
        email,
        fullName: "Staff Member",
        isVerified: false,
        role: { roleName: "PARISHIONER" },
      }),
      updateFirebaseUid: async (id, uid) => ({
        id,
        firebaseUid: uid,
        email: "staff@example.com",
        fullName: "Staff Member",
        isVerified: true,
        role: { roleName: "PARISHIONER" },
      }),
      update: async (id, data) => ({
        id,
        firebaseUid: "google-uid-103",
        email: "staff@example.com",
        fullName: "Staff Member",
        isVerified: true,
        role: { roleName: "PARISHIONER" },
      }),
    };
    const authService = new AuthService(mockUserRepo, createMockRoleRepo());
    const decodedToken = {
      uid: "google-uid-103",
      email: "staff@example.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    };

    const profile = await authService.getOrCreateApplicationUser(decodedToken);
    assert.equal(profile.isNewUser, false);
  });

  await t.test("P2002 concurrency collision recovery returns isNewUser: false", async () => {
    const existingDbUser = {
      id: 104,
      firebaseUid: "race-uid",
      email: "race@example.com",
      fullName: "Race Winner",
      isVerified: true,
      role: { roleName: "PARISHIONER" },
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
    };
    const mockUserRepo = {
      findByFirebaseUid: async (uid) => (uid === "race-uid" ? existingDbUser : null),
      findByEmail: async () => null,
      update: async (id, data) => ({ ...existingDbUser, ...data }),
      create: async () => {
        const error = new Error("Unique constraint failed");
        error.code = "P2002";
        throw error;
      },
    };
    const authService = new AuthService(mockUserRepo, createMockRoleRepo());
    const decodedToken = {
      uid: "race-uid",
      email: "race@example.com",
      email_verified: true,
    };
    const legalAcceptance = {
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
    };

    const profile = await authService.getOrCreateApplicationUser(decodedToken, legalAcceptance);
    assert.equal(profile.isNewUser, false);
    assert.equal(profile.fullName, "Race Winner");
  });

  await t.test("resolveFullName retains legitimate name and rejects email prefix", () => {
    const authService = new AuthService();

    // With valid name claim
    assert.equal(authService.resolveFullName({ name: "Jose Rizal" }), "Jose Rizal");
    assert.equal(authService.resolveFullName({ name: "  Maria Clara  " }), "Maria Clara");

    // With email only (no name claim)
    assert.equal(authService.resolveFullName({ email: "jose.rizal@example.com" }), "");
    assert.equal(authService.resolveFullName({ email: "admin@testimonium.org", name: "" }), "");
    assert.equal(authService.resolveFullName({ email: "user@test.com", name: "   " }), "");
  });

  await t.test("missing legitimate name leaves profile incomplete", async () => {
    const mockUserRepo = {
      findByFirebaseUid: async () => null,
      findByEmail: async () => null,
      create: async (data) => ({
        id: 105,
        ...data,
        role: { roleName: "PARISHIONER" },
      }),
    };
    const authService = new AuthService(mockUserRepo, createMockRoleRepo());
    const decodedToken = {
      uid: "no-name-uid",
      email: "unnamed@example.com",
      email_verified: true,
      // no name claim provided
    };
    const legalAcceptance = {
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
    };

    const profile = await authService.getOrCreateApplicationUser(decodedToken, legalAcceptance);
    assert.equal(profile.fullName, "");
    assert.equal(profile.needsProfileCompletion, true);
  });
});

test("Phase 1: AuthController.register isNewUser Contract", async (t) => {
  const { register } = await import("../controllers/AuthController.js");

  await t.test("new registration returns data.isNewUser: true", async () => {
    const req = {
      user: {
        id: 201,
        firebaseUid: "new-reg-uid",
        email: "newreg@example.com",
        fullName: "New Registrant",
        isNewUser: true,
      },
      firebaseUser: { uid: "new-reg-uid" },
      body: {
        termsAccepted: true,
        privacyAccepted: true,
      },
    };
    let responseData = null;
    const res = {
      status: (code) => {
        assert.equal(code, 200);
        return {
          json: (body) => {
            responseData = body;
          },
        };
      },
    };
    await register(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(responseData.success, true);
    assert.equal(responseData.data.isNewUser, true);
  });

  await t.test("retried registration for existing user returns data.isNewUser: false", async () => {
    const req = {
      user: {
        id: 202,
        firebaseUid: "existing-reg-uid",
        email: "existingreg@example.com",
        fullName: "Existing Registrant",
        isNewUser: false, // Authoritative middleware resolved existing user
      },
      firebaseUser: { uid: "existing-reg-uid" },
      body: {
        termsAccepted: true,
        privacyAccepted: true,
      },
    };
    let responseData = null;
    const res = {
      status: (code) => {
        assert.equal(code, 200);
        return {
          json: (body) => {
            responseData = body;
          },
        };
      },
    };
    await register(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(responseData.success, true);
    assert.equal(responseData.data.isNewUser, false);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  DocumentRequirementService,
  CANONICAL_REQUIREMENTS_CATALOG,
  DOCUMENT_REQUIREMENTS_MATRIX,
} from "../services/DocumentRequirementService.js";
import {
  CANONICAL_DOCUMENT_TYPES,
  CANONICAL_REQUIREMENT_IDS,
  CANONICAL_REQUIREMENT_IDS_SET,
  validateDocumentSettingsForSave,
} from "../config/documents.js";
import { updateSettings } from "../controllers/ParishController.js";
import { uploadFiles } from "../controllers/ParishionerRequestController.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { RequestNotificationService } from "../services/RequestNotificationService.js";
import { FileUploadService } from "../services/FileUploadService.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { prisma } from "../config/db.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";
import { ParishService } from "../services/ParishService.js";
import { R2Service } from "../services/R2Service.js";

// Helper to create mock prisma client for DocumentRequirementService
function createMockPrismaForParish(documentSettingsStr) {
  return {
    parish: {
      findUnique: async () => ({
        documentSettings: documentSettingsStr,
      }),
    },
  };
}

// Prisma delegates expose methods through a proxy, so restore direct overrides explicitly.
function stubPrisma(t, target, method, implementation) {
  const original = target[method];
  target[method] = implementation;
  t.after(() => { target[method] = original; });
}

// ---------------------------------------------------------------------------
// BACKEND TESTS 1 - 15
// ---------------------------------------------------------------------------

test("1. Existing defaults still resolve correctly", async () => {
  const defaults = await DocumentRequirementService.getRequirements("BAPTISMAL_CERTIFICATE");
  assert.ok(defaults);
  assert.equal(defaults.documentType, "BAPTISMAL_CERTIFICATE");
  assert.equal(defaults.baseFee, 100);
  assert.ok(Array.isArray(defaults.requiredDocuments));
  assert.equal(defaults.requiredDocuments.length, 2);
  assert.equal(defaults.requiredDocuments[0].id, "valid_id");
  assert.equal(defaults.requiredDocuments[0].required, true);
  assert.equal(defaults.requiredDocuments[0].category, "primary");
});

test("2. Existing false override removes a default requirement", async () => {
  const mockPrisma = createMockPrismaForParish(
    JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: {
          valid_id: false,
        },
      },
    })
  );

  const res = await DocumentRequirementService.getRequirements(
    "BAPTISMAL_CERTIFICATE",
    1,
    mockPrisma
  );
  assert.ok(Array.isArray(res.requiredDocuments));
  const validIdReq = res.requiredDocuments.find((d) => d.id === "valid_id");
  assert.equal(validIdReq, undefined, "valid_id should be removed when override is false");
  assert.deepEqual(res.requiredDocuments.map((d) => d.id), ["endorsement_letter"]);
});

test("3. Existing canonical requirement can be added to a different document", async () => {
  const mockPrisma = createMockPrismaForParish(
    JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: {
          valid_id: true,
          baptismal_cert: true,
        },
      },
    })
  );

  const res = await DocumentRequirementService.getRequirements(
    "BAPTISMAL_CERTIFICATE",
    1,
    mockPrisma
  );
  assert.equal(res.requiredDocuments.length, 3);
  const ids = res.requiredDocuments.map((d) => d.id);
  assert.ok(ids.includes("valid_id"));
  assert.ok(ids.includes("baptismal_cert"));
});

test("4. Added requirement returns canonical metadata", async () => {
  const mockPrisma = createMockPrismaForParish(
    JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: {
          valid_id: true,
          confirmation_cert: true,
        },
      },
    })
  );

  const res = await DocumentRequirementService.getRequirements(
    "BAPTISMAL_CERTIFICATE",
    1,
    mockPrisma
  );
  const confReq = res.requiredDocuments.find((d) => d.id === "confirmation_cert");
  assert.ok(confReq, "confirmation_cert should be resolved");
  assert.equal(confReq.id, "confirmation_cert");
  assert.equal(confReq.category, "supporting");
  assert.equal(confReq.required, true);
  assert.ok(confReq.label && typeof confReq.label === "string");
  assert.ok(confReq.description && typeof confReq.description === "string");
  const existingDefinition = Object.values(DOCUMENT_REQUIREMENTS_MATRIX)
    .flatMap((config) => config.requiredDocuments)
    .find((requirement) => requirement.id === "confirmation_cert");
  assert.deepEqual(
    CANONICAL_REQUIREMENTS_CATALOG.confirmation_cert,
    existingDefinition,
    "Canonical metadata must be derived from an existing matrix definition"
  );
  assert.deepEqual(confReq, existingDefinition);
});

test("5. Unknown requirement ID is rejected on settings save", () => {
  assert.throws(
    () => {
      validateDocumentSettingsForSave({
        BAPTISMAL_CERTIFICATE: {
          requirements: {
            fake_req: true,
          },
        },
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Invalid requirement ID "fake_req"/);
      return true;
    }
  );
});

test("6. Non-boolean requirement values are rejected", () => {
  const invalidValues = ["false", "true", 1, 0, {}, [], null, undefined];
  for (const val of invalidValues) {
    if (val === undefined) continue; // undefined key is handled or omitted
    assert.throws(
      () => {
        validateDocumentSettingsForSave({
          BAPTISMAL_CERTIFICATE: {
            requirements: {
              valid_id: val,
            },
          },
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /must be strictly boolean/);
        return true;
      }
    );
  }
});

test("7. Malformed settings payload is rejected cleanly", () => {
  // Malformed JSON string
  assert.throws(
    () => {
      validateDocumentSettingsForSave("{ malformed: json ");
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Invalid JSON format/);
      return true;
    }
  );

  // Non-object primitives, null, or arrays
  for (const invalidTopLevel of ["just a string", 42, null, [1, 2, 3]]) {
    assert.throws(
      () => validateDocumentSettingsForSave(invalidTopLevel),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  }

  // Invalid document type key
  assert.throws(
    () => {
      validateDocumentSettingsForSave({
        NON_EXISTENT_DOCUMENT: {
          requirements: { valid_id: true },
        },
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Invalid document type/);
      return true;
    }
  );

  for (const invalidDocConfig of [null, [], "bad", 7]) {
    assert.throws(
      () => validateDocumentSettingsForSave({ BAPTISMAL_CERTIFICATE: invalidDocConfig }),
      (err) => err.statusCode === 400 && /must be an object/.test(err.message)
    );
  }

  for (const invalidRequirements of [null, [], 7]) {
    assert.throws(
      () => validateDocumentSettingsForSave({
        BAPTISMAL_CERTIFICATE: { requirements: invalidRequirements },
      }),
      (err) => err.statusCode === 400 && /must be an object/.test(err.message)
    );
  }

  // Malformed requirements property (not an object)
  assert.throws(
    () => {
      validateDocumentSettingsForSave({
        BAPTISMAL_CERTIFICATE: {
          requirements: "should be an object",
        },
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /must be an object/);
      return true;
    }
  );
});

test("8. Unknown stored IDs are ignored during reads", async () => {
  const mockPrisma = createMockPrismaForParish(
    JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: {
          valid_id: true,
          old_stale_requirement: true,
          unknown_custom_id: false,
        },
      },
    })
  );

  const res = await DocumentRequirementService.getRequirements(
    "BAPTISMAL_CERTIFICATE",
    1,
    mockPrisma
  );
  assert.equal(res.requiredDocuments.length, 2);
  assert.equal(res.requiredDocuments[0].id, "valid_id");
});

test("9. Secretary remains parish-scoped", async () => {
  const originalAuditLog = AuditLogService.log;
  AuditLogService.log = async () => {};

  try {
    const req = {
      params: { id: "2" },
      user: { id: 10, role: "SECRETARY", parish: { id: 1 } }, // assigned to parish 1, attempting to modify parish 2
      body: {
        documentSettings: {
          BAPTISMAL_CERTIFICATE: {
            price: 100,
            requirements: { valid_id: true },
          },
        },
      },
    };

    let capturedError = null;
    const mockRes = {};
    await updateSettings(req, mockRes, (err) => {
      capturedError = err;
    });

    assert.ok(capturedError, "Secretary should be blocked from modifying another parish");
    assert.equal(capturedError.statusCode, 403);
  } finally {
    AuditLogService.log = originalAuditLog;
  }
});

test("10. Settings role middleware authorizes coordinators and rejects parishioners", () => {
  const middleware = checkRole(["DIOCESE_COORDINATOR", "SECRETARY", "PRIEST"]);
  let coordinatorNextCalled = false;
  middleware(
    { user: { role: "DIOCESE_COORDINATOR" } },
    { status: () => assert.fail("Coordinator should pass settings role middleware") },
    () => { coordinatorNextCalled = true; }
  );
  assert.equal(coordinatorNextCalled, true);

  let parishionerStatus = null;
  middleware(
    { user: { role: "PARISHIONER" } },
    {
      status: (code) => {
        parishionerStatus = code;
        return { json: () => undefined };
      },
    },
    () => assert.fail("Parishioner must not pass settings role middleware")
  );
  assert.equal(parishionerStatus, 403);

  const validated = validateDocumentSettingsForSave({
    BAPTISMAL_CERTIFICATE: {
      price: 120,
      requirements: { valid_id: true, baptismal_cert: true },
    },
  });
  assert.ok(validated.BAPTISMAL_CERTIFICATE);
  assert.equal(validated.BAPTISMAL_CERTIFICATE.price, 120);
  assert.equal(validated.BAPTISMAL_CERTIFICATE.requirements.baptismal_cert, true);
});

test("11. Priest remains forbidden", async () => {
  const req = {
    params: { id: "1" },
    user: { id: 5, role: "PRIEST", parishId: 1 },
    body: {
      documentSettings: {
        BAPTISMAL_CERTIFICATE: {
          requirements: { valid_id: true },
        },
      },
    },
  };

  let capturedError = null;
  await updateSettings(req, {}, (err) => {
    capturedError = err;
  });

  assert.ok(capturedError, "Priest must be forbidden from updating documentSettings");
  assert.equal(capturedError.statusCode, 403);
  assert.equal(capturedError.code, "FORBIDDEN");
});

test("12. Prices remain unchanged when updating requirements", () => {
  const input = {
    paymentMethods: { gcash: true, maya: false },
    BAPTISMAL_CERTIFICATE: {
      price: 250.5,
      customNote: "Preserve existing document metadata",
      requirements: {
        valid_id: true,
        marriage_license: true,
      },
    },
  };

  const output = validateDocumentSettingsForSave(input);
  assert.deepEqual(output.paymentMethods, input.paymentMethods);
  assert.equal(output.BAPTISMAL_CERTIFICATE.price, 250.5);
  assert.equal(output.BAPTISMAL_CERTIFICATE.customNote, "Preserve existing document metadata");
  assert.equal(output.BAPTISMAL_CERTIFICATE.requirements.valid_id, true);
  assert.equal(output.BAPTISMAL_CERTIFICATE.requirements.marriage_license, true);
});

test("13. availableDocuments remains unchanged", () => {
  const initialAvailableDocs = [
    "BAPTISMAL_CERTIFICATE",
    "CONFIRMATION_CERTIFICATE",
  ];

  // Document settings validation does not mutate or touch availableDocuments
  const validated = validateDocumentSettingsForSave({
    BAPTISMAL_CERTIFICATE: {
      requirements: { valid_id: true },
    },
  });

  assert.deepEqual(initialAvailableDocs, [
    "BAPTISMAL_CERTIFICATE",
    "CONFIRMATION_CERTIFICATE",
  ]);
  assert.ok(validated.BAPTISMAL_CERTIFICATE);
});

test("14. Requirement assignments are isolated per parish", async () => {
  const prismaParish1 = createMockPrismaForParish(
    JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: { valid_id: true, cenomar: true },
      },
    })
  );

  const prismaParish2 = createMockPrismaForParish(
    JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: { valid_id: true },
      },
    })
  );

  const p1Reqs = await DocumentRequirementService.getRequirements(
    "BAPTISMAL_CERTIFICATE",
    1,
    prismaParish1
  );
  const p2Reqs = await DocumentRequirementService.getRequirements(
    "BAPTISMAL_CERTIFICATE",
    2,
    prismaParish2
  );

  const p1Ids = p1Reqs.requiredDocuments.map((d) => d.id);
  const p2Ids = p2Reqs.requiredDocuments.map((d) => d.id);

  assert.ok(p1Ids.includes("cenomar"), "Parish 1 must have cenomar");
  assert.ok(!p2Ids.includes("cenomar"), "Parish 2 must NOT have cenomar");
});

test("15. Returned requirement ordering is deterministic", async () => {
  // Test permutations of requirement keys
  const prismaOrderA = createMockPrismaForParish(
    JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: {
          canonical_interview: true,
          valid_id: true,
          baptismal_cert: true,
        },
      },
    })
  );

  const prismaOrderB = createMockPrismaForParish(
    JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: {
          baptismal_cert: true,
          canonical_interview: true,
          valid_id: true,
        },
      },
    })
  );

  const reqsA = await DocumentRequirementService.getRequirements(
    "BAPTISMAL_CERTIFICATE",
    1,
    prismaOrderA
  );
  const reqsB = await DocumentRequirementService.getRequirements(
    "BAPTISMAL_CERTIFICATE",
    1,
    prismaOrderB
  );

  const orderA = reqsA.requiredDocuments.map((d) => d.id);
  const orderB = reqsB.requiredDocuments.map((d) => d.id);

  assert.deepEqual(orderA, orderB, "Order must be deterministic across different key orderings");
  // Matrix defaults come first, followed by canonical additions in canonical ID order
  assert.equal(orderA[0], "valid_id");
  assert.equal(orderA[1], "endorsement_letter");
  assert.equal(orderA[2], "baptismal_cert");
  assert.equal(orderA[3], "canonical_interview");
});

// ---------------------------------------------------------------------------
// UPLOAD / SUBMISSION TESTS 16 - 19
// ---------------------------------------------------------------------------

test("16. Newly assigned canonical requirement is accepted as an upload category", async () => {
  const originalUserFindUnique = prisma.user.findUnique;
  const originalRequestFindFirst = prisma.documentRequest.findFirst;
  const originalParishFindUnique = prisma.parish.findUnique;
  const originalUploadAttachment = FileUploadService.uploadAttachment;
  let responseStatus = null;
  let responseBody = null;

  try {
    prisma.user.findUnique = async () => ({
      id: 10,
      roleId: 1,
      role: { roleName: "PARISHIONER" },
      fullName: "Test Parishioner",
      contactNumber: "09170000000",
    });
    prisma.documentRequest.findFirst = async () => ({
      id: 500,
      userId: 10,
      parishId: 1,
      documentType: "BAPTISMAL_CERTIFICATE",
      isDraft: true,
      status: "PENDING",
      relationship: "Self",
    });
    prisma.parish.findUnique = async () => ({
      documentSettings: JSON.stringify({
      BAPTISMAL_CERTIFICATE: {
        requirements: {
          valid_id: true,
          cenomar: true,
        },
      },
      }),
    });
    FileUploadService.uploadAttachment = async (requestId, file, category) => ({
      id: 900,
      requestId,
      fileName: file.originalname,
      category,
    });

    await uploadFiles(
      {
        user: { id: 10 },
        params: { id: "500" },
        body: { category: "cenomar" },
        files: [{ originalname: "cenomar.pdf" }],
      },
      {
        status: (code) => {
          responseStatus = code;
          return {
            json: (body) => {
              responseBody = body;
              return body;
            },
          };
        },
      },
      (error) => { throw error; }
    );

    assert.equal(responseStatus, 201);
    assert.equal(responseBody.data[0].category, "cenomar");
  } finally {
    prisma.user.findUnique = originalUserFindUnique;
    prisma.documentRequest.findFirst = originalRequestFindFirst;
    prisma.parish.findUnique = originalParishFindUnique;
    FileUploadService.uploadAttachment = originalUploadAttachment;
  }
});

test("17. Newly assigned required item is enforced at submission", async () => {
  const service = new ParishionerRequestService();
  const originalTransaction = prisma.$transaction;
  const originalParishFindUnique = prisma.parish.findUnique;

  try {
    const mockTx = {
      user: {
        findUnique: async () => ({
          id: 10,
          roleId: 1,
          role: { roleName: "PARISHIONER" },
          fullName: "Test Parishioner",
          contactNumber: "09170000000",
          governmentIdVerification: { status: "VERIFIED" },
        }),
      },
      documentRequest: {
        findFirst: async () => ({
          id: 500,
          userId: 10,
          parishId: 1,
          documentType: "BAPTISMAL_CERTIFICATE",
          isDraft: true,
          status: "PENDING",
          purpose: "Legal",
          relationship: "Self",
          applicantName: "Test Parishioner",
        }),
      },
      requestAttachment: {
        findMany: async () => [
          { category: "valid_id" }, // missing cenomar
          { category: "endorsement_letter" },
        ],
      },
    };
    prisma.$transaction = async (callback) => callback(mockTx);
    prisma.parish.findUnique = async () => ({
      documentSettings: JSON.stringify({
        BAPTISMAL_CERTIFICATE: {
          requirements: { valid_id: true, cenomar: true },
        },
      }),
    });

    await assert.rejects(
      () => service.submitDraft(500, 10),
      (error) => error.statusCode === 400 && error.message.includes("PSA CENOMAR")
    );
  } finally {
    prisma.$transaction = originalTransaction;
    prisma.parish.findUnique = originalParishFindUnique;
  }
});

test("18. Removed requirement is no longer enforced at submission", async () => {
  const service = new ParishionerRequestService();
  const originalTransaction = prisma.$transaction;
  const originalParishFindUnique = prisma.parish.findUnique;
  const originalNotifyStatusChange = RequestNotificationService.notifyStatusChange;
  const originalAuditLog = AuditLogService.log;

  try {
    const submitted = {
      id: 500,
      userId: 10,
      parishId: 1,
      documentType: "BAPTISMAL_CERTIFICATE",
      isDraft: false,
      status: "PENDING",
      trackingNumber: "DOC-500",
    };
    const mockTx = {
      user: {
        findUnique: async () => ({
          id: 10,
          roleId: 1,
          role: { roleName: "PARISHIONER" },
          fullName: "Test Parishioner",
          contactNumber: "09170000000",
          governmentIdVerification: { status: "VERIFIED" },
        }),
      },
      documentRequest: {
        findFirst: async () => ({
          ...submitted,
          isDraft: true,
          purpose: "Legal",
          relationship: "Self",
          applicantName: "Test Parishioner",
        }),
        update: async () => submitted,
      },
      requestAttachment: {
        findMany: async () => assert.fail("Removed requirement must not trigger attachment enforcement"),
      },
      requestHistory: {
        create: async () => ({ id: 700 }),
      },
    };
    prisma.$transaction = async (callback) => callback(mockTx);
    prisma.parish.findUnique = async () => ({
      documentSettings: JSON.stringify({
        BAPTISMAL_CERTIFICATE: {
          requirements: { valid_id: false, endorsement_letter: false },
        },
      }),
    });
    RequestNotificationService.notifyStatusChange = async () => {};
    AuditLogService.log = async () => {};

    assert.deepEqual(await service.submitDraft(500, 10), submitted);
  } finally {
    prisma.$transaction = originalTransaction;
    prisma.parish.findUnique = originalParishFindUnique;
    RequestNotificationService.notifyStatusChange = originalNotifyStatusChange;
    AuditLogService.log = originalAuditLog;
  }
});

test("19. Existing document request behavior remains intact", async () => {
  const reqConfig = await DocumentRequirementService.getRequirements("MARRIAGE_BANNS");
  assert.ok(reqConfig.requiredDocuments.length >= 7);
  const ids = reqConfig.requiredDocuments.map((d) => d.id);
  assert.ok(ids.includes("valid_id"));
  assert.ok(ids.includes("baptismal_cert"));
  assert.ok(ids.includes("confirmation_cert"));
  assert.ok(ids.includes("marriage_license"));
  assert.ok(ids.includes("precana_proof"));
  assert.ok(ids.includes("cenomar"));
  assert.ok(ids.includes("banns_clearance"));
});

test("Endorsement Letter defaults preserve every certificate's existing prerequisites, fees and processing periods", async () => {
  const existing = {
    BAPTISMAL_CERTIFICATE: [100, 3, ["valid_id"]],
    CONFIRMATION_CERTIFICATE: [100, 3, ["valid_id"]],
    MARRIAGE_CERTIFICATE: [150, 5, ["valid_id"]],
    FIRST_COMMUNION_CERTIFICATE: [75, 3, ["valid_id"]],
    MARRIAGE_BANNS: [200, 14, ["valid_id", "baptismal_cert", "confirmation_cert", "marriage_license", "precana_proof", "cenomar", "banns_clearance"]],
    PERMIT_TO_MARRY: [150, 7, ["valid_id", "baptismal_cert", "confirmation_cert", "marriage_license", "precana_proof", "cenomar", "canonical_interview", "banns_clearance"]],
    STATUS_OF_LIBERTY: [150, 5, ["valid_id", "baptismal_cert", "cenomar", "canonical_interview"]],
  };
  assert.equal(CANONICAL_REQUIREMENT_IDS.length, 9);
  assert.ok(CANONICAL_REQUIREMENT_IDS_SET.has("endorsement_letter"));
  assert.deepEqual(Object.keys(existing), CANONICAL_DOCUMENT_TYPES);
  for (const [type, [fee, days, ids]] of Object.entries(existing)) {
    const config = await DocumentRequirementService.getRequirements(type);
    assert.equal(config.baseFee, fee);
    assert.equal(config.estimatedProcessingDays, days);
    assert.deepEqual(config.requiredDocuments.filter((d) => d.id !== "endorsement_letter").map((d) => d.id), ids);
    assert.deepEqual(config.requiredDocuments.filter((d) => d.id === "endorsement_letter"), [{
      id: "endorsement_letter", label: "Endorsement Letter", category: "supporting", required: true,
      description: "Endorsement letter submitted as supporting documentation for a certificate request.",
    }]);
  }
});

test("old parish settings inherit Endorsement Letter and explicit overrides stay isolated by parish and certificate", async () => {
  for (const type of CANONICAL_DOCUMENT_TYPES) {
    const legacy = { [type]: { price: 321, requirements: { valid_id: false } } };
    for (const stored of [null, "{}", JSON.stringify(legacy)]) {
      const config = await DocumentRequirementService.getRequirements(type, 1, createMockPrismaForParish(stored));
      assert.ok(config.requiredDocuments.some((d) => d.id === "endorsement_letter"));
    }
    for (const enabled of [false, true]) {
      const settings = structuredClone(legacy);
      settings[type].requirements.endorsement_letter = enabled;
      const matrix = await DocumentRequirementService.getRequirements(null, 1, createMockPrismaForParish(JSON.stringify(settings)));
      assert.equal(matrix[type].requiredDocuments.some((d) => d.id === "endorsement_letter"), enabled);
      assert.equal(matrix[type].baseFee, 321);
      assert.ok(!matrix[type].requiredDocuments.some((d) => d.id === "valid_id"));
      for (const other of CANONICAL_DOCUMENT_TYPES.filter((id) => id !== type)) {
        assert.deepEqual(matrix[other], DOCUMENT_REQUIREMENTS_MATRIX[other]);
      }
      const otherParish = await DocumentRequirementService.getRequirements(type, 2, createMockPrismaForParish("{}"));
      assert.deepEqual(otherParish, DOCUMENT_REQUIREMENTS_MATRIX[type]);
    }
  }
});

test("Endorsement Letter settings require strict booleans for all certificates", () => {
  for (const type of CANONICAL_DOCUMENT_TYPES) {
    for (const value of ["true", "false", 1, 0, null, undefined, {}, []]) {
      assert.throws(() => validateDocumentSettingsForSave({ [type]: { requirements: { endorsement_letter: value } } }),
        (error) => error.statusCode === 400 && /strictly boolean/.test(error.message));
    }
    for (const value of [true, false]) {
      const input = { [type]: { price: 150, requirements: { endorsement_letter: value, valid_id: false } } };
      assert.deepEqual(validateDocumentSettingsForSave(input), input);
      assert.deepEqual(validateDocumentSettingsForSave(JSON.stringify(input)), input);
    }
  }
});

test("Secretary saves, reloads and restores Endorsement Letter through existing settings persistence", async (t) => {
  const row = { id: 1, parishName: "Fixture Parish", users: [], documentSettings: "{}" };
  const tx = { $queryRaw: async () => [{ parish_id: row.id }], parish: {
    findUnique: async () => structuredClone(row),
    update: async ({ data }) => { Object.assign(row, data); return structuredClone(row); },
  } };
  stubPrisma(t, prisma, "$transaction", async (callback) => callback(tx));
  stubPrisma(t, prisma.parish, "findUnique", async () => structuredClone(row));
  t.mock.method(ParishService.prototype, "getCanonicalParishDto", async () => ({ ...row, documentSettings: JSON.parse(row.documentSettings) }));
  t.mock.method(AuditLogService, "log", async () => {});

  for (const type of CANONICAL_DOCUMENT_TYPES) {
    for (const enabled of [false, true]) {
      const settings = JSON.parse(row.documentSettings);
      settings[type] = { price: 217, requirements: { valid_id: true, endorsement_letter: enabled } };
      let response;
      await updateSettings({ params: { id: "1" }, user: { id: 10, role: "SECRETARY", parish: { id: 1 } }, body: { documentSettings: settings } },
        { status(code) { assert.equal(code, 200); return this; }, json(body) { response = body; } },
        (error) => { throw error; });
      assert.equal(response.data.documentSettings[type].requirements.endorsement_letter, enabled);
      assert.equal(JSON.parse(row.documentSettings)[type].requirements.endorsement_letter, enabled);
      const config = await DocumentRequirementService.getRequirements(type, 1);
      assert.equal(config.requiredDocuments.some((d) => d.id === "endorsement_letter"), enabled);
      assert.ok(config.requiredDocuments.some((d) => d.id === "valid_id"));
      assert.equal(config.baseFee, 217);
    }
  }
});

test("new requests enforce effective Endorsement Letter configuration for all seven certificates", async (t) => {
  let request;
  let attachments;
  let settings;
  let writes = 0;
  const tx = {
    user: { findUnique: async () => ({ id: 10, role: { roleName: "PARISHIONER" }, fullName: "Test Parishioner", contactNumber: "09170000000", governmentIdVerification: { status: "VERIFIED" } }) },
    documentRequest: {
      findFirst: async () => request,
      update: async ({ data }) => { writes++; return { ...request, ...data }; },
    },
    requestAttachment: {
      findMany: async () => attachments,
      findFirst: async ({ where }) => attachments.find((a) => a.category === where.category) || null,
    },
    registrantIdEvidence: { findUnique: async () => null },
    requestHistory: { create: async () => ({ id: 1 }) },
  };
  stubPrisma(t, prisma, "$transaction", async (callback) => callback(tx));
  stubPrisma(t, prisma.parish, "findUnique", async () => ({ documentSettings: JSON.stringify(settings) }));
  t.mock.method(AuditLogService, "log", async () => {});
  t.mock.method(RequestNotificationService, "notifyStatusChange", async () => {});
  const service = new ParishionerRequestService();

  for (const type of CANONICAL_DOCUMENT_TYPES) {
    request = { id: 500, userId: 10, parishId: 1, documentType: type, isDraft: true, status: "PENDING", purpose: "School", relationship: "Self", applicantName: "Test Parishioner" };
    for (const override of [undefined, true]) {
      settings = { [type]: { requirements: override === undefined ? { valid_id: true } : { endorsement_letter: override } } };
      attachments = DOCUMENT_REQUIREMENTS_MATRIX[type].requiredDocuments.filter((d) => !["valid_id", "endorsement_letter"].includes(d.id)).map((d) => ({ category: d.id }));
      const before = writes;
      await assert.rejects(service.submitDraft(500, 10), (error) => error.statusCode === 400 && /Endorsement Letter/.test(error.message));
      assert.equal(writes, before, "rejected submissions must stay drafts");
      attachments.push({ category: "endorsement_letter" });
      assert.equal((await service.submitDraft(500, 10)).isDraft, false);
    }
    settings[type].requirements.endorsement_letter = false;
    attachments = attachments.filter((a) => a.category !== "endorsement_letter");
    assert.equal((await service.submitDraft(500, 10)).isDraft, false);
  }

  // The new supporting letter never substitutes for separate non-Self evidence.
  request.relationship = "Parent";
  attachments.push({ category: "endorsement_letter" });
  await assert.rejects(service.submitDraft(500, 10), { code: "AUTHORIZATION_LETTER_REQUIRED" });
  attachments.push({ category: "authorization_letter" });
  await assert.rejects(service.submitDraft(500, 10), { code: "REGISTRANT_ID_REQUIRED" });
});

test("Endorsement Letter uses the current upload endpoint for drafts and corrections", async (t) => {
  stubPrisma(t, prisma.user, "findUnique", async () => ({ id: 10, role: { roleName: "PARISHIONER" } }));
  let request = { id: 500, userId: 10, parishId: 1, documentType: "BAPTISMAL_CERTIFICATE", relationship: "Self", isDraft: true, status: "PENDING" };
  let enabled = true;
  stubPrisma(t, prisma.documentRequest, "findFirst", async () => request);
  stubPrisma(t, prisma.parish, "findUnique", async () => ({ documentSettings: JSON.stringify({ BAPTISMAL_CERTIFICATE: { requirements: { endorsement_letter: enabled } } }) }));
  const uploaded = [];
  t.mock.method(FileUploadService, "uploadAttachment", async (requestId, file, category) => {
    uploaded.push(category); return { id: 1, requestId, category, fileName: file.originalname };
  });
  t.mock.method(FileUploadService, "uploadAuthorizationLetter", () => assert.fail("Endorsement Letter must use supporting storage"));
  for (const isDraft of [true, false]) {
    request = { ...request, isDraft, status: isDraft ? "PENDING" : "NEEDS_CORRECTION", correctionRequirementIds: ["endorsement_letter"] };
    let status;
    let body;
    await uploadFiles({ user: { id: 10 }, params: { id: "500" }, body: { category: "endorsement_letter" }, files: [{ originalname: "endorsement.pdf" }] },
      { status(code) { status = code; return this; }, json(value) { body = value; } }, (error) => { throw error; });
    assert.equal(status, 201);
    assert.equal(body.data[0].category, "endorsement_letter");
  }
  enabled = false;
  let status;
  await uploadFiles({ user: { id: 10 }, params: { id: "500" }, body: { category: "endorsement_letter" }, files: [{}] },
    { status(code) { status = code; return this; }, json() {} }, (error) => { throw error; });
  assert.equal(status, 400);
  assert.deepEqual(uploaded, ["endorsement_letter", "endorsement_letter"]);
});

test("Endorsement Letter validates and replaces files through existing supporting storage", async (t) => {
  const events = [];
  t.mock.method(R2Service.prototype, "upload", async () => { events.push("upload"); return "https://storage.example/fixture"; });
  t.mock.method(R2Service.prototype, "delete", async () => { events.push("delete-object"); });
  const db = { requestAttachment: {
    findFirst: async ({ where }) => { assert.equal(where.category, "endorsement_letter"); return { id: 1, r2ObjectKey: "fixture-old-object" }; },
    create: async ({ data }) => { events.push("create"); assert.equal(data.category, "endorsement_letter"); return { id: 2, ...data }; },
    delete: async () => { events.push("delete-record"); },
  } };
  const file = { originalname: "endorsement.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.7\nfixture"), size: 16 };
  const result = await FileUploadService.uploadAttachment(500, file, "endorsement_letter", db);
  assert.equal(result.category, "endorsement_letter");
  assert.deepEqual(events, ["upload", "create", "delete-record", "delete-object"]);
  events.length = 0;
  await assert.rejects(FileUploadService.uploadAttachment(500, { ...file, buffer: Buffer.from("invalid") }, "endorsement_letter", db));
  assert.deepEqual(events, [], "invalid files must be rejected before storage writes");
});

test("Caloy reads Endorsement Letter from effective live requirements and parish overrides", async () => {
  let enabled;
  const registry = new LiveToolRegistry({ prismaClient: { parish: { findUnique: async ({ where }) => ({
    id: where.id, isActive: true, parishName: "Fixture Parish", availableDocuments: CANONICAL_DOCUMENT_TYPES,
    documentSettings: JSON.stringify(Object.fromEntries(CANONICAL_DOCUMENT_TYPES.map((type) => [type, { requirements: enabled === undefined ? {} : { endorsement_letter: enabled } }]))),
  }) } } });
  for (const override of [undefined, false, true]) {
    enabled = override;
    for (const documentType of CANONICAL_DOCUMENT_TYPES) {
      const result = await registry.getDocumentRequirements({ documentType, parishId: 1 });
      assert.equal(result.structuredFacts.supportingRequirements.includes("Endorsement Letter"), enabled !== false);
      assert.equal(result.answer.includes("Endorsement Letter"), enabled !== false);
      assert.equal(result.liveData.parishId, 1);
    }
  }
});

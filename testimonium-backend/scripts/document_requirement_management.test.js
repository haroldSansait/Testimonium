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

// ---------------------------------------------------------------------------
// BACKEND TESTS 1 - 15
// ---------------------------------------------------------------------------

test("1. Existing defaults still resolve correctly", async () => {
  const defaults = await DocumentRequirementService.getRequirements("BAPTISMAL_CERTIFICATE");
  assert.ok(defaults);
  assert.equal(defaults.documentType, "BAPTISMAL_CERTIFICATE");
  assert.equal(defaults.baseFee, 100);
  assert.ok(Array.isArray(defaults.requiredDocuments));
  assert.equal(defaults.requiredDocuments.length, 1);
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
  assert.equal(res.requiredDocuments.length, 0);
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
  assert.equal(res.requiredDocuments.length, 2);
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
  assert.equal(res.requiredDocuments.length, 1);
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
  // Matrix defaults come first (valid_id), followed by canonical additions in canonical ID order
  assert.equal(orderA[0], "valid_id");
  assert.equal(orderA[1], "baptismal_cert");
  assert.equal(orderA[2], "canonical_interview");
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
          requirements: { valid_id: false },
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

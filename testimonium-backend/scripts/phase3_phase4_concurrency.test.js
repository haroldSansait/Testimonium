import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../config/db.js";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";

test("Real Concurrency Test — Database-backed Idempotency", async (t) => {
  const service = new ParishionerRequestService();

  const createdRequestIds = [];
  const createdIdempotencyKeys = [];

  // Helper to register records for safe cleanup
  const trackForCleanup = (requestId, key) => {
    if (requestId && !createdRequestIds.includes(requestId)) {
      createdRequestIds.push(requestId);
    }
    if (key && !createdIdempotencyKeys.includes(key)) {
      createdIdempotencyKeys.push(key);
    }
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Simultaneous Request Creation (Same User, Same Key, Same Payload)
    // -------------------------------------------------------------
    await t.test("1. Simultaneous same-user + same-key + same-payload race resolves to single request", async () => {
      const testUserId = 1;
      const testKey = `test-concurrent-same-${crypto.randomUUID()}`;
      createdIdempotencyKeys.push(testKey);

      const canonicalPayload = {
        parishId: 1,
        documentType: "BAPTISMAL_CERTIFICATE",
        applicantName: "Maria Clara Concurrency Verification",
        relationship: "Self",
        purpose: "Phase 3+4 Concurrency Audit",
      };

      // Launch two truly simultaneous createDraft calls against real database
      const [result1, result2] = await Promise.all([
        service.createDraft(testUserId, canonicalPayload, testKey),
        service.createDraft(testUserId, canonicalPayload, testKey),
      ]);

      assert.ok(result1, "Result 1 must be returned");
      assert.ok(result2, "Result 2 must be returned");
      assert.equal(result1.id, result2.id, `Both concurrent operations must resolve to the identical draft ID (got ${result1.id} and ${result2.id})`);
      trackForCleanup(result1.id, testKey);

      // Verify Database State: Exactly ONE DocumentRequest
      const matchingRequests = await prisma.documentRequest.findMany({
        where: { id: result1.id },
      });
      assert.equal(matchingRequests.length, 1, "Exactly one DocumentRequest row must exist");

      // Verify Database State: Exactly ONE IdempotencyKey record
      const matchingKeys = await prisma.idempotencyKey.findMany({
        where: {
          userId: testUserId,
          key: testKey,
          resourceType: "DOCUMENT_REQUEST_CREATE",
        },
      });
      assert.equal(matchingKeys.length, 1, "Exactly one IdempotencyKey row must exist");
      assert.equal(matchingKeys[0].resourceId, result1.id, "IdempotencyKey must point to the winning draft ID");
    });

    // -------------------------------------------------------------
    // Test 2: Same User + Same Key + Different Payload -> 409 Conflict
    // -------------------------------------------------------------
    await t.test("2. Same-user + same-key + different-payload produces deterministic 409 Conflict", async () => {
      const testUserId = 1;
      const testKey = `test-conflict-payload-${crypto.randomUUID()}`;
      createdIdempotencyKeys.push(testKey);

      const payloadOriginal = {
        parishId: 1,
        documentType: "BAPTISMAL_CERTIFICATE",
        applicantName: "Juan Dela Cruz Original",
        relationship: "Self",
        purpose: "Initial application",
      };

      const payloadDifferent = {
        parishId: 1,
        documentType: "BAPTISMAL_CERTIFICATE",
        applicantName: "Juan Dela Cruz Different",
        relationship: "Spouse",
        purpose: "Altered application",
      };

      // 1. Initial creation succeeds
      const initial = await service.createDraft(testUserId, payloadOriginal, testKey);
      assert.ok(initial.id);
      trackForCleanup(initial.id, testKey);

      // 2. Subsequent call with different payload must throw 409 Conflict
      await assert.rejects(
        async () => {
          await service.createDraft(testUserId, payloadDifferent, testKey);
        },
        (err) => {
          assert.equal(err.statusCode, 409, `Expected 409 Conflict, got ${err.statusCode} (${err.message})`);
          return true;
        }
      );

      // 3. Concurrent race with different payloads: one succeeds, one gets 409
      const raceKey = `test-race-diff-payload-${crypto.randomUUID()}`;
      createdIdempotencyKeys.push(raceKey);

      const settledResults = await Promise.allSettled([
        service.createDraft(testUserId, payloadOriginal, raceKey),
        service.createDraft(testUserId, payloadDifferent, raceKey),
      ]);

      const fulfilled = settledResults.filter((r) => r.status === "fulfilled");
      const rejected = settledResults.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one concurrent call with different payload must succeed");
      assert.equal(rejected.length, 1, "The competing concurrent call must be rejected");
      assert.equal(rejected[0].reason.statusCode, 409, "Rejected call must be 409 Conflict");
      trackForCleanup(fulfilled[0].value.id, raceKey);
    });

    // -------------------------------------------------------------
    // Test 3: Different Users + Same Key -> Both allowed independently
    // -------------------------------------------------------------
    await t.test("3. Different users + same key creates independent drafts concurrently", async () => {
      const user1 = 1;
      const user2 = 2;
      const sharedKey = `test-shared-user-key-${crypto.randomUUID()}`;
      createdIdempotencyKeys.push(sharedKey);

      const payload = {
        parishId: 1,
        documentType: "BAPTISMAL_CERTIFICATE",
        applicantName: "Parishioner Verification",
        relationship: "Self",
        purpose: "Multi-user idempotency test",
      };

      // Launch simultaneously for both users with the exact same key
      const [resUser1, resUser2] = await Promise.all([
        service.createDraft(user1, payload, sharedKey),
        service.createDraft(user2, payload, sharedKey),
      ]);

      assert.ok(resUser1.id, "User 1 request must succeed");
      assert.ok(resUser2.id, "User 2 request must succeed");
      assert.notEqual(resUser1.id, resUser2.id, "Both users must receive distinct request IDs");
      assert.equal(resUser1.userId, user1);
      assert.equal(resUser2.userId, user2);

      trackForCleanup(resUser1.id, sharedKey);
      trackForCleanup(resUser2.id, sharedKey);

      // Verify Database: Exactly 2 IdempotencyKey rows for this key (one per user)
      const keysInDb = await prisma.idempotencyKey.findMany({
        where: { key: sharedKey },
      });
      assert.equal(keysInDb.length, 2, "Database must contain exactly 2 idempotency records for the shared key");
    });
  } finally {
    // -------------------------------------------------------------
    // Safe Cleanup: ONLY test-created records
    // -------------------------------------------------------------
    if (createdRequestIds.length > 0) {
      await prisma.requestHistory.deleteMany({
        where: { requestId: { in: createdRequestIds } },
      });
      await prisma.documentRequest.deleteMany({
        where: { id: { in: createdRequestIds } },
      });
    }
    if (createdIdempotencyKeys.length > 0) {
      await prisma.idempotencyKey.deleteMany({
        where: { key: { in: createdIdempotencyKeys } },
      });
    }
  }
});

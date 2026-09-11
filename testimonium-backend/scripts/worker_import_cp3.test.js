import test from "node:test";
import assert from "node:assert/strict";
import { computeContentHash } from "../utils/contentHash.js";
import { KnowledgeEmbeddingWorker } from "../services/KnowledgeEmbeddingWorker.js";
import { FakeEmbeddingProvider } from "../services/ai/FakeEmbeddingProvider.js";
import { env } from "../config/env.js";

function makeJob(overrides = {}) {
  return {
    chunkId: 101,
    sourceId: 1,
    content: "Sample sacramental guide",
    chunkOrder: 0,
    contentHash: "hash-abc",
    sourceVersion: 1,
    processingToken: "token-a",
    sourceTitle: "Sacraments",
    ...overrides,
  };
}

function makeSuccessfulProvider() {
  return {
    providerName: "gemini",
    modelName: "gemini-embedding-2",
    async embedDocuments(documents) {
      return documents.map((document) => ({
        id: document.id,
        vector: new Array(768).fill(0.1),
        dimensions: 768,
        provider: "gemini",
        model: "gemini-embedding-2",
      }));
    },
  };
}

function makeWorkerHarness(options = {}) {
  const state = {
    status: "PROCESSING",
    processingToken: options.processingToken || "token-a",
    sourceVersion: 1,
    contentHash: "hash-abc",
    leaseActive: options.leaseActive ?? true,
    sourceEligible: options.sourceEligible ?? true,
  };
  const writes = [];
  const sqlCalls = [];
  const provider = options.provider || makeSuccessfulProvider();

  const prismaClient = {
    async $executeRawUnsafe(sql, ...params) {
      sqlCalls.push(sql);
      assert.match(sql, /lease_expires_at"? IS NOT NULL/i);
      assert.match(sql, /lease_expires_at"? >= CURRENT_TIMESTAMP/i);
      const activeOwner = state.status === "PROCESSING" && state.leaseActive;

      if (sql.includes("'READY'::\"EmbeddingStatus\"")) {
        const [, , , , chunkId, token, sourceVersion, contentHash] = params;
        const canWrite = activeOwner && chunkId === 101 &&
          token === state.processingToken && sourceVersion === state.sourceVersion &&
          contentHash === state.contentHash && state.sourceEligible;
        if (!canWrite) return 0;
        state.status = "READY";
        state.processingToken = null;
        writes.push("READY");
        return 1;
      }

      if (sql.includes("'STALE'::\"EmbeddingStatus\"")) {
        const [chunkId, token] = params;
        if (!activeOwner || chunkId !== 101 || token !== state.processingToken) return 0;
        state.status = "STALE";
        state.processingToken = null;
        writes.push("STALE");
        return 1;
      }

      if (sql.includes("'FAILED'::\"EmbeddingStatus\"")) {
        const [, chunkId, token] = params;
        if (!activeOwner || chunkId !== 101 || token !== state.processingToken) return 0;
        state.status = "FAILED";
        state.processingToken = null;
        writes.push("FAILED");
        return 1;
      }

      throw new Error("Unexpected worker SQL");
    },
  };

  return {
    state,
    writes,
    sqlCalls,
    worker: new KnowledgeEmbeddingWorker({ prismaClient, embeddingProvider: provider }),
  };
}

test("CP3 ContentHash: deterministic SHA-256", () => {
  const first = computeContentHash("Hello TESTIMONIUM");
  assert.equal(first, computeContentHash("Hello TESTIMONIUM"));
  assert.notEqual(first, computeContentHash("Different content"));
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("CP3 Worker Lifecycle: disabled worker stays idle", async () => {
  const originalEnabled = env.chatbot.enabled;
  env.chatbot.enabled = false;
  try {
    const fakeProvider = new FakeEmbeddingProvider(768);
    const worker = new KnowledgeEmbeddingWorker({ embeddingProvider: fakeProvider });
    worker.start();
    assert.equal(worker.timer, null);
    await worker.drain();
    assert.equal(fakeProvider.calls.length, 0);
    await worker.stop();
  } finally {
    env.chatbot.enabled = originalEnabled;
  }
});

test("CP3 Worker lease expiry discards a late READY result", async () => {
  const harness = makeWorkerHarness({ leaseActive: false });
  await harness.worker.process(makeJob());
  assert.deepEqual(harness.writes, []);
  assert.equal(harness.state.status, "PROCESSING");
});

test("CP3 Worker lease expiry prevents a late FAILED transition", async () => {
  const provider = {
    async embedDocuments() {
      const error = new Error("Secret provider failure");
      error.code = "CHATBOT_EMBEDDING_UNAVAILABLE";
      throw error;
    },
  };
  const harness = makeWorkerHarness({ leaseActive: false, provider });
  await harness.worker.process(makeJob());
  assert.deepEqual(harness.writes, []);
  assert.equal(harness.state.status, "PROCESSING");
});

test("CP3 Worker lease expiry prevents a late STALE transition", async () => {
  const harness = makeWorkerHarness({ leaseActive: false, sourceEligible: false });
  await harness.worker.process(makeJob());
  assert.deepEqual(harness.writes, []);
  assert.equal(harness.state.status, "PROCESSING");
});

test("CP3 Worker A cannot overwrite worker B after token reclaim", async () => {
  const harness = makeWorkerHarness({ processingToken: "token-b" });
  await harness.worker.process(makeJob({ processingToken: "token-a" }));
  assert.deepEqual(harness.writes, []);
  assert.equal(harness.state.status, "PROCESSING");
  assert.equal(harness.state.processingToken, "token-b");
});

test("CP3 Worker writes READY while the matching lease remains active", async () => {
  const harness = makeWorkerHarness();
  await harness.worker.process(makeJob());
  assert.deepEqual(harness.writes, ["READY"]);
  assert.equal(harness.state.status, "READY");
  assert.equal(harness.state.processingToken, null);
});

test("CP3 Worker writes STALE for source drift while the matching lease remains active", async () => {
  const harness = makeWorkerHarness({ sourceEligible: false });
  await harness.worker.process(makeJob());
  assert.deepEqual(harness.writes, ["STALE"]);
  assert.equal(harness.state.status, "STALE");
});

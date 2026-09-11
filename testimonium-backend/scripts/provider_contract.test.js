import test from "node:test";
import assert from "node:assert/strict";
import { GeminiEmbeddingAdapter } from "../services/ai/GeminiEmbeddingAdapter.js";
import { GeminiChatAdapter } from "../services/ai/GeminiChatAdapter.js";

// Helper to create a valid 768-d vector of finite numbers
function makeValidVector(val = 0.05) {
  return new Array(768).fill(val);
}

// Mock GoogleGenAI client
function makeMockClient({ embedContent, generateContent }) {
  return {
    models: {
      embedContent: embedContent || (async () => ({ embeddings: [{ values: makeValidVector() }] })),
      generateContent: generateContent || (async () => ({ text: () => JSON.stringify({ answer: "Grounded answer", citedChunkIds: [1] }) })),
    },
  };
}

// ============================================================================
// GEMINI EMBEDDING ADAPTER CONTRACT TESTS
// ============================================================================

test("GeminiEmbeddingAdapter: Installed SDK Response Shape & Invariants", async (t) => {
  await t.test("embedQuery: parses response.embeddings[0].values correctly", async () => {
    const mockVec = makeValidVector(0.123);
    const mockClient = makeMockClient({
      embedContent: async ({ model, contents, config }) => {
        return {
          embeddings: [{ values: mockVec }],
        };
      },
    });

    const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
    const result = await adapter.embedQuery("What are the baptism requirements?");

    assert.equal(result.dimensions, 768);
    assert.equal(result.vector.length, 768);
    assert.equal(result.vector[0], 0.123);
    assert.equal(result.provider, "gemini");
  });

  await t.test("embedDocuments: exactly one vector per input document", async () => {
    let callCount = 0;
    const mockClient = makeMockClient({
      embedContent: async ({ model, contents, config }) => {
        callCount++;
        return {
          embeddings: [{ values: makeValidVector(callCount * 0.1) }],
        };
      },
    });

    const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
    const docs = [
      { id: 101, title: "Doc 1", content: "Content of document 1" },
      { id: 102, title: "Doc 2", content: "Content of document 2" },
      { id: 103, title: "Doc 3", content: "Content of document 3" },
    ];

    const results = await adapter.embedDocuments(docs);
    assert.equal(results.length, 3);
    assert.equal(callCount, 3);
    assert.equal(results[0].id, 101);
    assert.equal(results[0].vector.length, 768);
    assert.equal(results[1].id, 102);
    assert.equal(results[2].id, 103);
  });

  await t.test("rejects missing or zero embeddings collection", async () => {
    for (const badResp of [{}, { embeddings: [] }, { embeddings: null }]) {
      const mockClient = makeMockClient({
        embedContent: async () => badResp,
      });

      const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
      await assert.rejects(
        () => adapter.embedQuery("Test query"),
        (err) => {
          assert.equal(err.code, "CHATBOT_INVALID_PROVIDER_RESPONSE");
          return true;
        }
      );
    }
  });

  await t.test("rejects missing or non-array values in embedding", async () => {
    for (const badResp of [
      { embeddings: [{ values: null }] },
      { embeddings: [{}] },
      { embeddings: [{ values: "not-an-array" }] },
    ]) {
      const mockClient = makeMockClient({
        embedContent: async () => badResp,
      });

      const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
      await assert.rejects(
        () => adapter.embedQuery("Test query"),
        (err) => {
          assert.equal(err.code, "CHATBOT_INVALID_PROVIDER_RESPONSE");
          return true;
        }
      );
    }
  });

  await t.test("rejects dimension mismatch (not 768)", async () => {
    const wrongDimensions = [512, 1024, 767, 769, 0];
    for (const dim of wrongDimensions) {
      const mockClient = makeMockClient({
        embedContent: async () => ({
          embeddings: [{ values: new Array(dim).fill(0.1) }],
        }),
      });

      const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
      await assert.rejects(
        () => adapter.embedQuery("Test query"),
        (err) => {
          assert.equal(err.code, "CHATBOT_INVALID_PROVIDER_RESPONSE");
          return true;
        }
      );
    }
  });

  await t.test("rejects non-finite values (NaN, Infinity, -Infinity)", async () => {
    const nonFiniteValues = [NaN, Infinity, -Infinity, "0.5"];
    for (const badVal of nonFiniteValues) {
      const vec = makeValidVector(0.1);
      vec[42] = badVal;

      const mockClient = makeMockClient({
        embedContent: async () => ({
          embeddings: [{ values: vec }],
        }),
      });

      const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
      await assert.rejects(
        () => adapter.embedQuery("Test query"),
        (err) => {
          assert.equal(err.code, "CHATBOT_INVALID_PROVIDER_RESPONSE");
          return true;
        }
      );
    }
  });
});

// ============================================================================
// TIMEOUT, ABORT & RETRY CLASSIFICATION
// ============================================================================

test("GeminiEmbeddingAdapter: Abort, Timeout & Retry Policies", async (t) => {
  await t.test("already-aborted signal makes zero provider calls", async () => {
    let callCount = 0;
    const controller = new AbortController();
    controller.abort();
    const mockClient = makeMockClient({
      embedContent: async () => {
        callCount++;
        return { embeddings: [{ values: makeValidVector() }] };
      },
    });

    const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
    await assert.rejects(
      () => adapter.embedQuery("Test query", { signal: controller.signal }),
      (err) => err.code === "CHATBOT_ABORTED"
    );
    assert.equal(callCount, 0);
  });

  await t.test("honors caller AbortSignal without retrying", async () => {
    let callCount = 0;
    const controller = new AbortController();

    const mockClient = makeMockClient({
      embedContent: async () => {
        callCount++;
        controller.abort();
        const err = new Error("This operation was aborted");
        err.name = "AbortError";
        throw err;
      },
    });

    const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
    await assert.rejects(
      () => adapter.embedQuery("Test query", { signal: controller.signal }),
      (err) => {
        assert.equal(err.code, "CHATBOT_ABORTED");
        return true;
      }
    );

    assert.equal(callCount, 1);
  });

  await t.test("permanent errors (400, 401, 403, validation) are attempted only once", async () => {
    const permanentCodes = [400, 401, 403, "INVALID_ARGUMENT", "PERMISSION_DENIED"];

    for (const status of permanentCodes) {
      let attempts = 0;
      const mockClient = makeMockClient({
        embedContent: async () => {
          attempts++;
          const err = new Error(`Permanent error with status ${status}`);
          err.status = status;
          throw err;
        },
      });

      const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient });
      await assert.rejects(
        () => adapter.embedQuery("Test query"),
        (err) => {
          assert.ok(err);
          return true;
        }
      );

      assert.equal(attempts, 1, `Permanent error ${status} must not be retried`);
    }
  });

  await t.test("transient errors (429, 503, network) retry up to max retries", async () => {
    let attempts = 0;
    const mockClient = makeMockClient({
      embedContent: async () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error("Rate limited or server error");
          err.status = 429;
          throw err;
        }
        return { embeddings: [{ values: makeValidVector() }] };
      },
    });

    const adapter = new GeminiEmbeddingAdapter({ apiKey: "test-key", client: mockClient, maxRetries: 3 });
    const result = await adapter.embedQuery("Test query");

    assert.equal(attempts, 3);
    assert.equal(result.dimensions, 768);
  });

  await t.test("caller abort during retry backoff prevents a second provider call", async () => {
    let callCount = 0;
    const controller = new AbortController();
    const mockClient = makeMockClient({
      embedContent: async () => {
        callCount++;
        const err = new Error("Temporary provider outage");
        err.status = 503;
        throw err;
      },
    });
    const adapter = new GeminiEmbeddingAdapter({
      apiKey: "test-key",
      client: mockClient,
      maxRetries: 2,
      retryBaseDelayMs: 50,
    });

    const resultPromise = adapter.embedQuery("Test query", { signal: controller.signal });
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(resultPromise, (err) => err.code === "CHATBOT_ABORTED");
    assert.equal(callCount, 1);
  });

  await t.test("adapter timeout is terminal and is not retried", async () => {
    let callCount = 0;
    const mockClient = makeMockClient({
      embedContent: async () => {
        callCount++;
        return await new Promise(() => {});
      },
    });
    const adapter = new GeminiEmbeddingAdapter({
      apiKey: "test-key",
      client: mockClient,
      timeoutMs: 10,
      maxRetries: 2,
      retryBaseDelayMs: 5,
    });

    await assert.rejects(() => adapter.embedQuery("Test query"));
    assert.equal(callCount, 1);
  });
});

// ============================================================================
// GEMINI CHAT ADAPTER CONTRACT TESTS
// ============================================================================

test("GeminiChatAdapter: Generation Contract & Citation Architecture", async (t) => {
  await t.test("already-aborted signal makes zero provider calls", async () => {
    let callCount = 0;
    const controller = new AbortController();
    controller.abort();
    const mockClient = makeMockClient({
      generateContent: async () => {
        callCount++;
        return { text: () => "Grounded answer [CITATIONS: 1]" };
      },
    });
    const adapter = new GeminiChatAdapter({ apiKey: "test-key", client: mockClient });

    await assert.rejects(
      () => adapter.generateGroundedAnswer({
        question: "Question",
        evidence: [{ id: 1, title: "Title", content: "Evidence" }],
        signal: controller.signal,
      }),
      (err) => err.code === "CHATBOT_ABORTED"
    );
    assert.equal(callCount, 0);
  });

  await t.test("returns structurally parsed answer and citedChunkIds", async () => {
    const mockClient = makeMockClient({
      generateContent: async () => ({
        text: () => "Parishioners can request a baptismal certificate through the portal. [CITATIONS: 101, 102]",
      }),
    });

    const adapter = new GeminiChatAdapter({ apiKey: "test-key", client: mockClient });
    const evidence = [
      { id: 101, title: "Guide", content: "Baptism procedure" },
      { id: 102, title: "Fees", content: "Fee schedule" },
    ];

    const result = await adapter.generateGroundedAnswer({ question: "How to request baptism cert?", evidence });
    assert.equal(result.answer, "Parishioners can request a baptismal certificate through the portal.");
    assert.deepEqual(result.citedChunkIds, [101, 102]);
    assert.equal(result.fallback, undefined);
  });

  await t.test("handles explicit [INSUFFICIENT_EVIDENCE] marker gracefully", async () => {
    const mockClient = makeMockClient({
      generateContent: async () => ({
        text: () => "[INSUFFICIENT_EVIDENCE]",
      }),
    });

    const adapter = new GeminiChatAdapter({ apiKey: "test-key", client: mockClient });
    const result = await adapter.generateGroundedAnswer({ question: "Unknown query", evidence: [{ id: 99, title: "T", content: "C" }] });

    assert.equal(result.answer, "");
    assert.deepEqual(result.citedChunkIds, []);
  });

  await t.test("NO synthetic citations: missing citedChunkIds produces empty array, never synthesizes evidence[0].id", async () => {
    const mockClient = makeMockClient({
      generateContent: async () => ({
        text: () => "An answer without citations.",
      }),
    });

    const adapter = new GeminiChatAdapter({ apiKey: "test-key", client: mockClient });
    const evidence = [{ id: 404, title: "Some evidence", content: "Content" }];

    const result = await adapter.generateGroundedAnswer({ question: "A question", evidence });
    assert.equal(result.answer, "An answer without citations.");
    assert.deepEqual(result.citedChunkIds, []);
    assert.ok(!result.citedChunkIds.includes(404));
  });

  await t.test("permanent chat generation error is not retried", async () => {
    let attempts = 0;
    const mockClient = makeMockClient({
      generateContent: async () => {
        attempts++;
        const err = new Error("Invalid model specification");
        err.status = 404;
        throw err;
      },
    });

    const adapter = new GeminiChatAdapter({ apiKey: "test-key", client: mockClient });
    await assert.rejects(
      () => adapter.generateGroundedAnswer({ question: "Question", evidence: [{ id: 1, title: "T", content: "C" }] }),
      (err) => {
        assert.ok(err);
        return true;
      }
    );

    assert.equal(attempts, 1);
  });

  await t.test("caller abort during retry backoff prevents a second generation call", async () => {
    let callCount = 0;
    const controller = new AbortController();
    const mockClient = makeMockClient({
      generateContent: async () => {
        callCount++;
        const err = new Error("Temporary provider outage");
        err.status = 503;
        throw err;
      },
    });
    const adapter = new GeminiChatAdapter({
      apiKey: "test-key",
      client: mockClient,
      maxRetries: 2,
      retryBaseDelayMs: 50,
    });

    const resultPromise = adapter.generateGroundedAnswer({
      question: "Question",
      evidence: [{ id: 1, title: "Title", content: "Evidence" }],
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(resultPromise, (err) => err.code === "CHATBOT_ABORTED");
    assert.equal(callCount, 1);
  });

  await t.test("generation timeout is terminal and is not retried", async () => {
    let callCount = 0;
    const mockClient = makeMockClient({
      generateContent: async () => {
        callCount++;
        return await new Promise(() => {});
      },
    });
    const adapter = new GeminiChatAdapter({
      apiKey: "test-key",
      client: mockClient,
      timeoutMs: 10,
      maxRetries: 2,
      retryBaseDelayMs: 5,
    });

    await assert.rejects(() => adapter.generateGroundedAnswer({
      question: "Question",
      evidence: [{ id: 1, title: "Title", content: "Evidence" }],
    }));
    assert.equal(callCount, 1);
  });
});

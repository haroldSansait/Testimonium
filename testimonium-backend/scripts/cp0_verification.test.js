import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, getMissingRequiredConfig } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("CP0: env.chatbot structure and defaults", () => {
  assert.ok(env.chatbot, "env.chatbot must exist");
  assert.equal(typeof env.chatbot.enabled, "boolean", "chatbot.enabled must be boolean");
  assert.equal(typeof env.chatbot.logRawText, "boolean", "chatbot.logRawText must be boolean");
  assert.equal(env.chatbot.embeddingDimensions, 768, "embeddingDimensions must be 768");
  assert.equal(typeof env.chatbot.generationProvider, "string");
  assert.equal(typeof env.chatbot.generationModel, "string");
  assert.equal(typeof env.chatbot.embeddingProvider, "string");
  assert.equal(typeof env.chatbot.embeddingModel, "string");
  assert.ok(env.chatbot.topK > 0);
  assert.ok(env.chatbot.maxContextChunks > 0);
  assert.ok(env.chatbot.maxContextTokens > 0);
  assert.ok(env.chatbot.maxOutputTokens > 0);
  assert.ok(env.chatbot.minSimilarity >= 0 && env.chatbot.minSimilarity <= 1);
  assert.ok(env.chatbot.rateLimits.rateLimitMax > 0);
  assert.ok(env.chatbot.rateLimits.dailyLimitMax > 0);
  assert.ok(env.chatbot.rateLimits.windowMs > 0);
  assert.ok(env.chatbot.worker.pollMs > 0);
  assert.ok(env.chatbot.worker.batchSize > 0);
  assert.ok(env.chatbot.worker.leaseSeconds > 0);
});

test("CP0: GEMINI_API_KEY is not required when chatbot is disabled", () => {
  if (!env.chatbot.enabled) {
    const missing = getMissingRequiredConfig();
    assert.ok(!missing.includes("GEMINI_API_KEY"), "GEMINI_API_KEY must not be required when CHATBOT_ENABLED=false");
  }
});

test("CP0: chatbot_eval.json fixture validation", () => {
  const fixturePath = path.resolve(__dirname, "../../tests/fixtures/chatbot_eval.json");
  assert.ok(fs.existsSync(fixturePath), "Fixture file must exist at tests/fixtures/chatbot_eval.json");

  const raw = fs.readFileSync(fixturePath, "utf-8");
  const data = JSON.parse(raw);
  assert.ok(Array.isArray(data.cases), "Fixture cases must be an array");
  assert.ok(data.cases.length >= 16, `Fixture must contain at least 16 cases, found ${data.cases.length}`);

  const categories = new Set(data.cases.map((c) => c.category));
  const expectedCategories = [
    "SYSTEM_FACT",
    "OUT_OF_SCOPE",
    "CROSS_PARISH",
    "PROMPT_INJECTION",
    "CANONICAL_TERMINOLOGY",
    "TYPO_NOISY_ENGLISH",
  ];

  for (const cat of expectedCategories) {
    assert.ok(categories.has(cat), `Fixture missing required category: ${cat}`);
  }

  // Count per category
  const counts = data.cases.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});

  assert.ok(counts.SYSTEM_FACT >= 5, `Expected >= 5 SYSTEM_FACT, got ${counts.SYSTEM_FACT}`);
  assert.ok(counts.OUT_OF_SCOPE >= 3, `Expected >= 3 OUT_OF_SCOPE, got ${counts.OUT_OF_SCOPE}`);
  assert.ok(counts.CROSS_PARISH >= 2, `Expected >= 2 CROSS_PARISH, got ${counts.CROSS_PARISH}`);
  assert.ok(counts.PROMPT_INJECTION >= 2, `Expected >= 2 PROMPT_INJECTION, got ${counts.PROMPT_INJECTION}`);
  assert.ok(counts.CANONICAL_TERMINOLOGY >= 2, `Expected >= 2 CANONICAL_TERMINOLOGY, got ${counts.CANONICAL_TERMINOLOGY}`);
  assert.ok(counts.TYPO_NOISY_ENGLISH >= 2, `Expected >= 2 TYPO_NOISY_ENGLISH, got ${counts.TYPO_NOISY_ENGLISH}`);

  for (const c of data.cases) {
    assert.ok(c.id, "Every case must have an id");
    assert.ok(c.question && c.question.trim().length > 0, `Case ${c.id} question must not be empty`);
    assert.equal(typeof c.expectedAnswerable, "boolean", `Case ${c.id} expectedAnswerable must be boolean`);
    assert.equal(typeof c.expectedFallback, "boolean", `Case ${c.id} expectedFallback must be boolean`);
  }
});

test("CP0: initial_corpus.schema.json validation", () => {
  const schemaPath = path.resolve(__dirname, "../../corpus/initial_corpus.schema.json");
  assert.ok(fs.existsSync(schemaPath), "Corpus schema must exist at corpus/initial_corpus.schema.json");

  const raw = fs.readFileSync(schemaPath, "utf-8");
  const schema = JSON.parse(raw);
  assert.equal(schema.type, "object");
  assert.ok(schema.properties.schemaVersion);
  assert.ok(schema.properties.sources);

  const samplePath = path.resolve(__dirname, "../../corpus/initial_corpus.sample.json");
  assert.ok(fs.existsSync(samplePath), "Sample corpus must exist at corpus/initial_corpus.sample.json");
  const sampleRaw = fs.readFileSync(samplePath, "utf-8");
  const sample = JSON.parse(sampleRaw);
  assert.ok(sample.sources.length >= 1);
  assert.equal(sample.sources[0].scope, "DIOCESE");
  assert.equal(sample.sources[0].parishId, null);
});

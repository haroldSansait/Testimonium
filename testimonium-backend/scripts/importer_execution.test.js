import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  validateCorpus,
  computeDuplicateKey,
  findCanonicalDuplicate,
  corpusSchema,
} from "./import_knowledge.js";

const execFileAsync = promisify(execFile);

// Helper for minimal valid corpus
function makeValidCorpus(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    description: "Test corpus",
    sources: [
      {
        title: "Baptismal Certificate Guidelines",
        sourceText: "Official diocesan procedure for issuing baptism certificates to parishioners.",
        sourceType: "SYSTEM_GUIDE",
        category: "SACRAMENTS",
        scope: "DIOCESE",
        chunks: [
          {
            content: "Step 1: Verify parishioner baptism records in the parish canonical book.",
            chunkOrder: 0,
          },
          {
            content: "Step 2: Collect payment receipt and seal document with diocesan dry stamp.",
            chunkOrder: 1,
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// IMPORTER SCHEMA VALIDATION TESTS
// ============================================================================

test("Importer Runtime Validation: Schema Strictness & Field Rules", async (t) => {
  await t.test("valid corpus passes validation", () => {
    const valid = makeValidCorpus();
    const result = validateCorpus(valid);
    assert.equal(result.schemaVersion, "1.0.0");
    assert.equal(result.sources.length, 1);
  });

  await t.test("rejects invalid schemaVersion format", () => {
    const bad = makeValidCorpus({ schemaVersion: "v2-invalid" });
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects unknown top-level field (strict mode)", () => {
    const bad = makeValidCorpus({ unknownField: "unexpected" });
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects unknown source-level field like authority or status injection", () => {
    const bad = makeValidCorpus();
    bad.sources[0].authority = "CONFIRMED"; // Attempt to bypass governance
    bad.sources[0].status = "ACTIVE";
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects invalid sourceType enum", () => {
    const bad = makeValidCorpus();
    bad.sources[0].sourceType = "WIKIPEDIA_SCRAPE";
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects invalid scope enum", () => {
    const bad = makeValidCorpus();
    bad.sources[0].scope = "NATIONAL";
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects empty or short title (< 3 characters)", () => {
    const bad = makeValidCorpus();
    bad.sources[0].title = "AB";
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects oversized title (> 200 characters)", () => {
    const bad = makeValidCorpus();
    bad.sources[0].title = "A".repeat(201);
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects empty or short sourceText (< 10 characters)", () => {
    const bad = makeValidCorpus();
    bad.sources[0].sourceText = "Too short";
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects oversized sourceText (> 20000 characters)", () => {
    const bad = makeValidCorpus();
    bad.sources[0].sourceText = "A".repeat(20001);
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects empty chunks array", () => {
    const bad = makeValidCorpus();
    bad.sources[0].chunks = [];
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects chunk with content < 10 characters", () => {
    const bad = makeValidCorpus();
    bad.sources[0].chunks[0].content = "Short";
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects oversized chunk content (> 2000 characters)", () => {
    const bad = makeValidCorpus();
    bad.sources[0].chunks[0].content = "C".repeat(2001);
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("rejects duplicate chunkOrder within the same source", () => {
    const bad = makeValidCorpus();
    bad.sources[0].chunks = [
      { content: "Chunk content 1 with sufficient length", chunkOrder: 0 },
      { content: "Chunk content 2 with sufficient length", chunkOrder: 0 }, // Duplicate order 0!
    ];
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("bad parish pairing: PARISH scope without parishId is rejected", () => {
    const bad = makeValidCorpus();
    bad.sources[0].scope = "PARISH";
    bad.sources[0].parishId = null;
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("bad parish pairing: DIOCESE scope with parishId is rejected", () => {
    const bad = makeValidCorpus();
    bad.sources[0].scope = "DIOCESE";
    bad.sources[0].parishId = 2; // Should be null or omitted
    assert.throws(() => validateCorpus(bad));
  });

  await t.test("valid PARISH scope with positive integer parishId passes", () => {
    const valid = makeValidCorpus();
    valid.sources[0].scope = "PARISH";
    valid.sources[0].parishId = 5;
    const parsed = validateCorpus(valid);
    assert.equal(parsed.sources[0].scope, "PARISH");
    assert.equal(parsed.sources[0].parishId, 5);
  });
});

// ============================================================================
// DUPLICATE IDENTITY TESTS
// ============================================================================

test("Importer Duplicate Detection: Content Hash & Tenancy Scope Independence", async (t) => {
  const commonText = "Standard baptismal guidelines shared text across entities.";

  await t.test("same content in DIOCESE vs PARISH 2 produces DIFFERENT duplicate keys", () => {
    const dioceseSource = { sourceText: commonText, scope: "DIOCESE", parishId: null };
    const parishSource = { sourceText: commonText, scope: "PARISH", parishId: 2 };

    const dioceseKey = computeDuplicateKey(dioceseSource);
    const parishKey = computeDuplicateKey(parishSource);

    assert.notEqual(dioceseKey, parishKey, "DIOCESE and PARISH 2 must NOT collapse into one record");
  });

  await t.test("same content in PARISH 2 vs PARISH 3 produces DIFFERENT duplicate keys", () => {
    const parish2 = { sourceText: commonText, scope: "PARISH", parishId: 2 };
    const parish3 = { sourceText: commonText, scope: "PARISH", parishId: 3 };

    const key2 = computeDuplicateKey(parish2);
    const key3 = computeDuplicateKey(parish3);

    assert.notEqual(key2, key3, "PARISH 2 and PARISH 3 must remain independent");
  });

  await t.test("identical content within the SAME scope and parishId produces the SAME duplicate key", () => {
    const entryA = { sourceText: "  Standard   baptismal guidelines\r\nshared text across entities.  ", scope: "PARISH", parishId: 2 };
    const entryB = { sourceText: commonText, scope: "PARISH", parishId: 2 };

    const keyA = computeDuplicateKey(entryA);
    const keyB = computeDuplicateKey(entryB);

    assert.equal(keyA, keyB, "Canonical duplicate hash must detect identical content in the same scope");
  });
});

test("Importer Duplicate Detection: database candidates use canonical text, scope, and parish identity", async (t) => {
  const existing = [
    { id: 11, title: "Old title", sourceText: "Canonical baptism procedure text", scope: "DIOCESE", parishId: null },
    { id: 12, title: "Parish copy", sourceText: "Canonical baptism procedure text", scope: "PARISH", parishId: 7 },
  ];

  await t.test("same title with different text is not a duplicate", () => {
    const duplicate = findCanonicalDuplicate(existing, {
      title: "Old title",
      sourceText: "A genuinely different diocesan procedure",
      scope: "DIOCESE",
      parishId: null,
    });
    assert.equal(duplicate, null);
  });

  await t.test("different title with canonically equal text is a duplicate", () => {
    const duplicate = findCanonicalDuplicate(existing, {
      title: "Renamed guide",
      sourceText: "  Canonical baptism procedure text\r\n",
      scope: "DIOCESE",
      parishId: null,
    });
    assert.equal(duplicate?.id, 11);
  });

  await t.test("same text in a different parish remains independent", () => {
    const duplicate = findCanonicalDuplicate(existing, {
      title: "Parish guide",
      sourceText: "Canonical baptism procedure text",
      scope: "PARISH",
      parishId: 8,
    });
    assert.equal(duplicate, null);
  });

  await t.test("same text in DIOCESE and PARISH scopes remains independent", () => {
    const duplicate = findCanonicalDuplicate(existing, {
      title: "Scoped guide",
      sourceText: "Canonical baptism procedure text",
      scope: "PARISH",
      parishId: 7,
    });
    assert.equal(duplicate?.id, 12);
    assert.notEqual(duplicate?.id, 11);
  });
});

// ============================================================================
// CLI DRY-RUN EXECUTION TEST
// ============================================================================

test("Importer CLI Execution: --dry-run flag executes safely", async () => {
  const scriptPath = path.resolve(process.cwd(), "scripts/import_knowledge.js");
  const samplePath = path.resolve(process.cwd(), "../corpus/initial_corpus.sample.json");

  const { stdout, stderr } = await execFileAsync("node", [
    scriptPath,
    "--file",
    samplePath,
    "--dry-run",
  ]);

  assert.ok(stdout.includes("DRY-RUN mode active"), "Output must confirm dry-run mode");
  assert.ok(stdout.includes("Validated Source"), "Output must confirm sources validated");
  assert.ok(stdout.includes("Errors:         0"), "Must complete with zero errors");
});

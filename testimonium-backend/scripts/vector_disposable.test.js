import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isDisposableDatabaseConfigured,
  getDisposablePrismaClient,
} from "../test-utils/disposableDbGuard.js";
import {
  KnowledgeScope,
  KnowledgeAuthority,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
  EmbeddingStatus,
} from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("CP1 Static: Enums exported by @prisma/client", () => {
  assert.ok(KnowledgeScope, "KnowledgeScope must exist");
  assert.equal(KnowledgeScope.DIOCESE, "DIOCESE");
  assert.equal(KnowledgeScope.PARISH, "PARISH");

  assert.ok(KnowledgeAuthority, "KnowledgeAuthority must exist");
  assert.equal(KnowledgeAuthority.CONFIRMED, "CONFIRMED");
  assert.equal(KnowledgeAuthority.PROVISIONAL, "PROVISIONAL");

  assert.ok(KnowledgeSourceStatus, "KnowledgeSourceStatus must exist");
  assert.equal(KnowledgeSourceStatus.DRAFT, "DRAFT");
  assert.equal(KnowledgeSourceStatus.ACTIVE, "ACTIVE");
  assert.equal(KnowledgeSourceStatus.RETIRED, "RETIRED");

  assert.ok(KnowledgeSourceType, "KnowledgeSourceType must exist");
  assert.equal(KnowledgeSourceType.SYSTEM_GUIDE, "SYSTEM_GUIDE");
  assert.equal(KnowledgeSourceType.PARISH_PROCEDURE, "PARISH_PROCEDURE");
  assert.equal(KnowledgeSourceType.DIOCESE_PROCEDURE, "DIOCESE_PROCEDURE");
  assert.equal(KnowledgeSourceType.CLERGY_INTERVIEW, "CLERGY_INTERVIEW");
  assert.equal(KnowledgeSourceType.OFFICIAL_SOURCE, "OFFICIAL_SOURCE");
  assert.equal(KnowledgeSourceType.LEGACY_FAQ, "LEGACY_FAQ");
  assert.equal(KnowledgeSourceType.ADMIN_ENTRY, "ADMIN_ENTRY");

  assert.ok(EmbeddingStatus, "EmbeddingStatus must exist");
  assert.equal(EmbeddingStatus.PENDING, "PENDING");
  assert.equal(EmbeddingStatus.PROCESSING, "PROCESSING");
  assert.equal(EmbeddingStatus.READY, "READY");
  assert.equal(EmbeddingStatus.FAILED, "FAILED");
  assert.equal(EmbeddingStatus.STALE, "STALE");
});

test("CP1 Static: Migration SQL artifact verification", () => {
  const migrationDir = path.resolve(__dirname, "../prisma/migrations/20260910120000_add_rag_chatbot");
  const migrationSqlPath = path.join(migrationDir, "migration.sql");

  assert.ok(fs.existsSync(migrationSqlPath), "Migration SQL file must exist");
  const sql = fs.readFileSync(migrationSqlPath, "utf-8");

  // 1. vector extension
  assert.ok(sql.includes("CREATE EXTENSION IF NOT EXISTS vector"), "Must enable vector extension");

  // 2. Enums
  assert.ok(sql.includes('CREATE TYPE "KnowledgeScope"'), "Must create KnowledgeScope enum");
  assert.ok(sql.includes('CREATE TYPE "KnowledgeAuthority"'), "Must create KnowledgeAuthority enum");
  assert.ok(sql.includes('CREATE TYPE "KnowledgeSourceStatus"'), "Must create KnowledgeSourceStatus enum");
  assert.ok(sql.includes('CREATE TYPE "KnowledgeSourceType"'), "Must create KnowledgeSourceType enum");
  assert.ok(sql.includes('CREATE TYPE "EmbeddingStatus"'), "Must create EmbeddingStatus enum");

  // 3. Table creations
  assert.ok(sql.includes('CREATE TABLE "knowledge_sources"'), "Must create knowledge_sources table");
  assert.ok(sql.includes('CREATE TABLE "knowledge_chunks"'), "Must create knowledge_chunks table");

  // 4. vector(768)
  assert.ok(sql.includes("vector(768)"), "Must define embedding as vector(768)");

  // 5. Worker lease fields
  assert.ok(sql.includes('"processing_token"'), "Must include processing_token column");
  assert.ok(sql.includes('"lease_expires_at"'), "Must include lease_expires_at column");
  assert.ok(sql.includes('"embedding_attempt_count"'), "Must include embedding_attempt_count column");
  assert.ok(sql.includes('"embedding_error_code"'), "Must include embedding_error_code column");

  // 6. Check constraint
  assert.ok(sql.includes("check_knowledge_source_scope_parish"), "Must have scope-parish check constraint");
  assert.ok(sql.includes('"scope" = \'DIOCESE\' AND "parish_id" IS NULL'), "DIOCESE must require null parish_id");
  assert.ok(sql.includes('"scope" = \'PARISH\' AND "parish_id" IS NOT NULL'), "PARISH must require non-null parish_id");

  // 7. Versioned chunk uniqueness
  assert.ok(
    sql.includes('"knowledge_chunks_source_id_source_version_chunk_order_key"'),
    "Must enforce unique constraint on (source_id, source_version, chunk_order)"
  );

  // 8. ChatbotLog alterations
  assert.ok(sql.includes('ALTER TABLE "chatbot_logs" ADD COLUMN "selected_parish_id"'), "Must add selected_parish_id");
  assert.ok(sql.includes('ALTER TABLE "chatbot_logs" ADD COLUMN "retrieved_chunk_ids"'), "Must add retrieved_chunk_ids");
  assert.ok(sql.includes('ALTER TABLE "chatbot_logs" ADD COLUMN "retrieval_scores"'), "Must add retrieval_scores");
  assert.ok(sql.includes('ALTER TABLE "chatbot_logs" ALTER COLUMN "question" DROP NOT NULL'), "question must be nullable");
  assert.ok(sql.includes('ALTER TABLE "chatbot_logs" ALTER COLUMN "response" DROP NOT NULL'), "response must be nullable");

  // 9. Legacy FAQ copy SQL
  assert.ok(sql.includes('FROM "faq_knowledge_base"'), "Must copy from faq_knowledge_base");
  assert.ok(sql.includes("'LEGACY_FAQ'"), "Legacy copy must set source_type to LEGACY_FAQ");
  assert.ok(sql.includes("'PROVISIONAL'"), "Legacy copy must set authority to PROVISIONAL");
  assert.ok(sql.includes("'DRAFT'"), "Legacy copy must set status to DRAFT");

  // 10. NO ANN index
  assert.ok(!sql.toLowerCase().includes("hnsw"), "Must NOT contain HNSW index");
  assert.ok(!sql.toLowerCase().includes("ivfflat"), "Must NOT contain IVFFlat index");
});

test("CP1 Disposable DB: Pgvector and Relational Schema Execution", async (t) => {
  if (!isDisposableDatabaseConfigured()) {
    console.log(
      "\n[DISPOSABLE DB GUARD: NOT RUN] " +
      "No DISPOSABLE_DATABASE_URL configured. Skipping live database execution.\n"
    );
    t.skip("REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE");
    return;
  }

  const { prisma } = getDisposablePrismaClient();

  try {
    // 1. Check pgvector extension exists
    const extResult = await prisma.$queryRawUnsafe(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
    );
    assert.ok(extResult.length > 0, "vector extension must be installed in disposable DB");

    // 2. Create a test diocese knowledge source
    const source = await prisma.knowledgeSource.create({
      data: {
        title: "Test Diocesan Sacramental Guideline",
        sourceText: "Comprehensive diocesan guidelines for sacramental certificates.",
        category: "GUIDELINES",
        sourceType: KnowledgeSourceType.SYSTEM_GUIDE,
        scope: KnowledgeScope.DIOCESE,
        authority: KnowledgeAuthority.CONFIRMED,
        status: KnowledgeSourceStatus.DRAFT,
        version: 1,
      },
    });
    assert.ok(source.id, "KnowledgeSource must be created with ID");
    assert.equal(source.scope, KnowledgeScope.DIOCESE);
    assert.equal(source.parishId, null);

    // 3. Test check constraint: DIOCESE with non-null parishId must fail
    await assert.rejects(
      async () => {
        await prisma.knowledgeSource.create({
          data: {
            title: "Invalid Diocese Source with Parish",
            sourceText: "Invalid data",
            sourceType: KnowledgeSourceType.SYSTEM_GUIDE,
            scope: KnowledgeScope.DIOCESE,
            parishId: 1,
          },
        });
      },
      /check_knowledge_source_scope_parish/i,
      "Check constraint must reject DIOCESE with non-null parish_id"
    );

    // 4. Test KnowledgeChunk creation with 768-dim vector
    const syntheticVector = Array.from({ length: 768 }, (_, i) => Math.sin(i)).map((v) => Number(v.toFixed(6)));
    const vectorStr = `[${syntheticVector.join(",")}]`;

    const chunk = await prisma.knowledgeChunk.create({
      data: {
        sourceId: source.id,
        content: "First chunk of test guide content.",
        chunkOrder: 0,
        contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        sourceVersion: 1,
        embeddingStatus: EmbeddingStatus.READY,
        embeddingProvider: "gemini",
        embeddingModel: "gemini-embedding-2",
        embeddingDimensions: 768,
      },
    });
    assert.ok(chunk.id, "Chunk must be created");

    // Update embedding via parameterized raw SQL
    await prisma.$executeRawUnsafe(
      `UPDATE knowledge_chunks SET embedding = $1::vector WHERE chunk_id = $2;`,
      vectorStr,
      chunk.id
    );

    // 5. Test exact cosine distance query
    const results = await prisma.$queryRawUnsafe(
      `SELECT chunk_id, 1 - (embedding <=> $1::vector) AS cosine_similarity 
       FROM knowledge_chunks 
       WHERE chunk_id = $2;`,
      vectorStr,
      chunk.id
    );
    assert.equal(results.length, 1);
    const sim = Number(results[0].cosine_similarity);
    assert.ok(sim > 0.999, `Self cosine similarity must be ~1.0, got ${sim}`);

    // 6. Test versioned chunk uniqueness: duplicate (sourceId, sourceVersion, chunkOrder) must fail
    await assert.rejects(
      async () => {
        await prisma.knowledgeChunk.create({
          data: {
            sourceId: source.id,
            content: "Duplicate order chunk",
            chunkOrder: 0,
            contentHash: "hash2",
            sourceVersion: 1,
          },
        });
      },
      /Unique constraint failed/i,
      "Duplicate chunkOrder in same sourceVersion must be rejected"
    );

    // Same chunkOrder in a new sourceVersion MUST be allowed
    const nextVersionChunk = await prisma.knowledgeChunk.create({
      data: {
        sourceId: source.id,
        content: "New version chunk order 0",
        chunkOrder: 0,
        contentHash: "hash3",
        sourceVersion: 2,
      },
    });
    assert.ok(nextVersionChunk.id, "Same chunkOrder allowed in different sourceVersion");

    // 7. Test ChatbotLog nullable question/response
    const log = await prisma.chatbotLog.create({
      data: {
        userId: null,
        sessionId: "test-session-uuid",
        question: null,
        response: null,
        fallback: false,
        retrievedChunkIds: [chunk.id],
        retrievalScores: [0.85],
        embeddingProvider: "gemini",
        generationProvider: "gemini",
        generationModel: "gemini-3.7-flash",
      },
    });
    assert.ok(log.id, "ChatbotLog created with null question and response");
    assert.equal(log.question, null);
    assert.equal(log.response, null);
    assert.deepEqual(log.retrievedChunkIds, [chunk.id]);

    // Cleanup test data
    await prisma.knowledgeSource.delete({ where: { id: source.id } });
    await prisma.chatbotLog.delete({ where: { id: log.id } });
  } finally {
    await prisma.$disconnect();
  }
});

-- ==============================================================================
-- CHATBOT RAG FOUNDATION MIGRATION: PGVECTOR, KNOWLEDGE BASE & LOG PRIVACY
-- ==============================================================================

-- Step 1: Enable vector extension (PostgreSQL + pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create Enums
CREATE TYPE "KnowledgeScope" AS ENUM ('DIOCESE', 'PARISH');
CREATE TYPE "KnowledgeAuthority" AS ENUM ('CONFIRMED', 'PROVISIONAL');
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "KnowledgeSourceType" AS ENUM (
    'SYSTEM_GUIDE',
    'PARISH_PROCEDURE',
    'DIOCESE_PROCEDURE',
    'CLERGY_INTERVIEW',
    'OFFICIAL_SOURCE',
    'LEGACY_FAQ',
    'ADMIN_ENTRY'
);
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'STALE');

-- Step 3: Create knowledge_sources table
CREATE TABLE "knowledge_sources" (
    "source_id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "source_text" TEXT NOT NULL,
    "category" VARCHAR(100),
    "source_type" "KnowledgeSourceType" NOT NULL,
    "source_reference" VARCHAR(500),
    "scope" "KnowledgeScope" NOT NULL DEFAULT 'DIOCESE',
    "parish_id" INTEGER,
    "authority" "KnowledgeAuthority" NOT NULL DEFAULT 'PROVISIONAL',
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "updated_by_id" INTEGER,
    "effective_from" TIMESTAMPTZ(6),
    "retired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("source_id"),
    CONSTRAINT "check_knowledge_source_scope_parish" CHECK (
        ("scope" = 'DIOCESE' AND "parish_id" IS NULL) OR
        ("scope" = 'PARISH' AND "parish_id" IS NOT NULL)
    )
);

-- Step 4: Create knowledge_chunks table
CREATE TABLE "knowledge_chunks" (
    "chunk_id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_order" INTEGER NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "source_version" INTEGER NOT NULL DEFAULT 1,
    "embedding" vector(768),
    "embedding_provider" VARCHAR(50),
    "embedding_model" VARCHAR(100),
    "embedding_dimensions" INTEGER,
    "embedding_status" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "embedded_at" TIMESTAMPTZ(6),
    "processing_token" VARCHAR(100),
    "lease_expires_at" TIMESTAMPTZ(6),
    "embedding_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "embedding_error_code" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("chunk_id")
);

-- Step 5: Versioned chunk uniqueness constraint
CREATE UNIQUE INDEX "knowledge_chunks_source_id_source_version_chunk_order_key" 
ON "knowledge_chunks"("source_id", "source_version", "chunk_order");

-- Step 6: Create B-Tree Indexes on knowledge_sources & knowledge_chunks
CREATE INDEX "knowledge_sources_scope_status_authority_idx" ON "knowledge_sources"("scope", "status", "authority");
CREATE INDEX "knowledge_sources_parish_id_idx" ON "knowledge_sources"("parish_id");
CREATE INDEX "knowledge_sources_category_idx" ON "knowledge_sources"("category");
CREATE INDEX "knowledge_sources_source_type_idx" ON "knowledge_sources"("source_type");

CREATE INDEX "knowledge_chunks_source_id_idx" ON "knowledge_chunks"("source_id");
CREATE INDEX "knowledge_chunks_embedding_status_idx" ON "knowledge_chunks"("embedding_status");
CREATE INDEX "knowledge_chunks_source_id_source_version_idx" ON "knowledge_chunks"("source_id", "source_version");
CREATE INDEX "knowledge_chunks_source_id_embedding_status_idx" ON "knowledge_chunks"("source_id", "embedding_status");

-- Step 7: Foreign Keys for Knowledge Base
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_parish_id_fkey" 
FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_approved_by_id_fkey" 
FOREIGN KEY ("approved_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_updated_by_id_fkey" 
FOREIGN KEY ("updated_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_fkey" 
FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("source_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Extend chatbot_logs
ALTER TABLE "chatbot_logs" ADD COLUMN "selected_parish_id" INTEGER;
ALTER TABLE "chatbot_logs" ADD COLUMN "retrieved_chunk_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "chatbot_logs" ADD COLUMN "retrieval_scores" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[];
ALTER TABLE "chatbot_logs" ADD COLUMN "fallback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chatbot_logs" ADD COLUMN "fallback_reason" VARCHAR(100);
ALTER TABLE "chatbot_logs" ADD COLUMN "category" VARCHAR(100);
ALTER TABLE "chatbot_logs" ADD COLUMN "embedding_provider" VARCHAR(50);
ALTER TABLE "chatbot_logs" ADD COLUMN "generation_provider" VARCHAR(50);
ALTER TABLE "chatbot_logs" ADD COLUMN "generation_model" VARCHAR(100);
ALTER TABLE "chatbot_logs" ADD COLUMN "latency_ms" INTEGER;
ALTER TABLE "chatbot_logs" ADD COLUMN "error_category" VARCHAR(100);

-- Step 9: Relax question and response NOT NULL in chatbot_logs for privacy (CHATBOT_LOG_RAW_TEXT=false default)
ALTER TABLE "chatbot_logs" ALTER COLUMN "question" DROP NOT NULL;
ALTER TABLE "chatbot_logs" ALTER COLUMN "response" DROP NOT NULL;

-- Step 10: Copy legacy FAQ rows into KnowledgeSource (preserving PROVISIONAL and DRAFT)
INSERT INTO "knowledge_sources" (
    "title",
    "source_text",
    "category",
    "source_type",
    "scope",
    "authority",
    "status",
    "version",
    "created_at",
    "updated_at"
)
SELECT
    SUBSTRING("question" FROM 1 FOR 200),
    "answer",
    "category",
    'LEGACY_FAQ'::"KnowledgeSourceType",
    'DIOCESE'::"KnowledgeScope",
    'PROVISIONAL'::"KnowledgeAuthority",
    'DRAFT'::"KnowledgeSourceStatus",
    1,
    "created_at",
    "updated_at"
FROM "faq_knowledge_base"
WHERE NOT EXISTS (
    SELECT 1 FROM "knowledge_sources" ks 
    WHERE ks."source_type" = 'LEGACY_FAQ'::"KnowledgeSourceType"
);

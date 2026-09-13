import { randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { getEmbeddingProvider } from "./ai/providerFactory.js";
import { computeContentHash } from "../utils/contentHash.js";

export class KnowledgeEmbeddingWorker {
  constructor({
    prismaClient = defaultPrisma,
    embeddingProvider = null,
  } = {}) {
    this.prisma = prismaClient;
    this.getProvider = embeddingProvider ? () => embeddingProvider : getEmbeddingProvider;
    this.timer = null;
    this.activeDrain = null;
    this.isStopping = false;
  }

  start() {
    if (this.timer) {
      return;
    }

    if (!env.chatbot?.enabled) {
      logger.info("[KnowledgeEmbeddingWorker] Chatbot disabled; worker idle without background provider polling.");
      return;
    }

    const pollMs = env.chatbot?.worker?.pollMs || 15000;
    this.timer = setInterval(() => void this.drain(), pollMs);
    this.timer.unref();
    void this.drain();
  }

  async stop() {
    this.isStopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.activeDrain) {
      await this.activeDrain;
    }
  }

  drain() {
    if (this.activeDrain) {
      return this.activeDrain;
    }

    this.activeDrain = (async () => {
      if (!env.chatbot?.enabled) {
        return;
      }

      const batchSize = env.chatbot?.worker?.batchSize || 5;

      for (let i = 0; i < batchSize; i++) {
        if (this.isStopping) break;

        const job = await this.claimOne();
        if (!job) break;

        await this.process(job);
      }
    })()
      .catch((err) => {
        logger.error({ err }, "[KnowledgeEmbeddingWorker] Worker cycle failed");
      })
      .finally(() => {
        this.activeDrain = null;
      });

    return this.activeDrain;
  }

  /**
   * Atomic chunk claim using SELECT ... FOR UPDATE SKIP LOCKED.
   */
  async claimOne() {
    const token = randomUUID();
    const leaseSeconds = env.chatbot?.worker?.leaseSeconds || 60;

    const rows = await this.prisma.$queryRaw`
      WITH candidate AS (
        SELECT 
          kc.chunk_id,
          kc.source_id,
          ks.title AS "source_title",
          ks.version AS "source_version",
          ks.authority AS "source_authority",
          ks.status AS "source_status"
        FROM knowledge_chunks kc
        JOIN knowledge_sources ks ON kc.source_id = ks.source_id
        WHERE ks.authority = 'CONFIRMED'::"KnowledgeAuthority"
          AND ks.status IN ('DRAFT'::"KnowledgeSourceStatus", 'ACTIVE'::"KnowledgeSourceStatus")
          AND kc.source_version = ks.version
          AND (
            kc.embedding_status = 'PENDING'::"EmbeddingStatus"
            OR (kc.embedding_status = 'PROCESSING'::"EmbeddingStatus" AND kc.lease_expires_at < CURRENT_TIMESTAMP)
          )
        ORDER BY kc.chunk_id ASC
        LIMIT 1
        FOR UPDATE OF kc SKIP LOCKED
      )
      UPDATE knowledge_chunks kc
      SET 
        "embedding_status" = 'PROCESSING'::"EmbeddingStatus",
        "processing_token" = ${token},
        "lease_expires_at" = CURRENT_TIMESTAMP + (${leaseSeconds} * INTERVAL '1 second'),
        "embedding_attempt_count" = kc.embedding_attempt_count + 1,
        "updated_at" = CURRENT_TIMESTAMP
      FROM candidate c
      WHERE kc.chunk_id = c.chunk_id
      RETURNING 
        kc.chunk_id AS "chunkId",
        kc.source_id AS "sourceId",
        kc.content AS "content",
        kc.chunk_order AS "chunkOrder",
        kc.content_hash AS "contentHash",
        kc.source_version AS "sourceVersion",
        kc.processing_token AS "processingToken",
        c.source_title AS "sourceTitle",
        c.source_version AS "currentSourceVersion",
        c.source_authority AS "sourceAuthority",
        c.source_status AS "sourceStatus";
    `;

    return rows[0] || null;
  }

  /**
   * Embed and commit a claimed chunk.
   */
  async process(job) {
    const provider = this.getProvider();
    const expectedDim = env.chatbot?.embeddingDimensions || 768;

    try {
      // 1. Generate document embedding
      const traceId = randomUUID();
      const embedResults = await provider.embedDocuments(
        [
          {
            id: job.chunkId,
            title: job.sourceTitle,
            content: job.content,
          },
        ],
        { traceId }
      );

      const embeddingResult = embedResults[0];
      if (!embeddingResult || !embeddingResult.vector) {
        const err = new Error("Provider returned empty embedding");
        err.code = "EMPTY_EMBEDDING";
        throw err;
      }

      const vector = embeddingResult.vector;

      // 2. Validate vector length & finite values
      if (!Array.isArray(vector) || vector.length !== expectedDim) {
        const err = new Error(`Vector dimension mismatch: expected ${expectedDim}, got ${vector?.length}`);
        err.code = "DIMENSION_MISMATCH";
        throw err;
      }

      for (let i = 0; i < vector.length; i++) {
        if (!Number.isFinite(vector[i])) {
          const err = new Error(`Non-finite value at index ${i}`);
          err.code = "NON_FINITE_VECTOR";
          throw err;
        }
      }

      const vectorStr = `[${vector.map((v) => Number(v.toFixed(6))).join(",")}]`;

      // 3. Atomic conditional update for READY state
      const rowsAffected = await this.prisma.$executeRawUnsafe(
        `UPDATE knowledge_chunks kc
         SET
           "embedding" = $1::vector,
           "embedding_provider" = $2,
           "embedding_model" = $3,
           "embedding_dimensions" = $4,
           "embedding_status" = 'READY'::"EmbeddingStatus",
           "embedded_at" = CURRENT_TIMESTAMP,
           "processing_token" = NULL,
           "lease_expires_at" = NULL,
           "embedding_error_code" = NULL,
           "updated_at" = CURRENT_TIMESTAMP
         FROM knowledge_sources ks
         WHERE kc.chunk_id = $5
           AND kc.source_id = ks.source_id
           AND kc.embedding_status = 'PROCESSING'::"EmbeddingStatus"
           AND kc.processing_token = $6
           AND kc.source_version = $7
           AND kc.content_hash = $8
           AND kc.lease_expires_at IS NOT NULL
           AND kc.lease_expires_at >= CURRENT_TIMESTAMP
           AND ks.version = $7
           AND ks.authority = 'CONFIRMED'::"KnowledgeAuthority"
           AND ks.status IN ('DRAFT'::"KnowledgeSourceStatus", 'ACTIVE'::"KnowledgeSourceStatus");`,
        vectorStr,
        embeddingResult.provider || provider.providerName || "unknown",
        embeddingResult.model || provider.modelName || "unknown",
        expectedDim,
        job.chunkId,
        job.processingToken,
        job.sourceVersion,
        job.contentHash
      );

      if (rowsAffected === 0) {
        // Atomic condition failed: claim expired, token stolen, or source version/content drifted
        logger.warn(
          { chunkId: job.chunkId, sourceId: job.sourceId },
          "[KnowledgeEmbeddingWorker] READY finalization condition not met; checking if chunk should be marked STALE"
        );

        // Attempt conditional STALE update only if chunk is still owned by this token
        await this.prisma.$executeRawUnsafe(
          `UPDATE knowledge_chunks
           SET
             "embedding_status" = 'STALE'::"EmbeddingStatus",
             "processing_token" = NULL,
             "lease_expires_at" = NULL,
             "updated_at" = CURRENT_TIMESTAMP
           WHERE "chunk_id" = $1
             AND "processing_token" = $2
             AND "embedding_status" = 'PROCESSING'::"EmbeddingStatus"
             AND "lease_expires_at" IS NOT NULL
             AND "lease_expires_at" >= CURRENT_TIMESTAMP;`,
          job.chunkId,
          job.processingToken
        );
      }
    } catch (err) {
      const safeCode = (err && err.code) ? String(err.code).slice(0, 100) : "PROVIDER_FAILURE";

      logger.error(
        { chunkId: job.chunkId, sourceId: job.sourceId, errorCategory: safeCode },
        "[KnowledgeEmbeddingWorker] Embedding generation failed for chunk"
      );

      // Atomic conditional update for FAILED state
      await this.prisma.$executeRawUnsafe(
        `UPDATE knowledge_chunks
         SET
           "embedding_status" = 'FAILED'::"EmbeddingStatus",
           "processing_token" = NULL,
           "lease_expires_at" = NULL,
           "embedding_error_code" = $1,
           "updated_at" = CURRENT_TIMESTAMP
         WHERE "chunk_id" = $2
           AND "processing_token" = $3
           AND "embedding_status" = 'PROCESSING'::"EmbeddingStatus"
           AND "lease_expires_at" IS NOT NULL
           AND "lease_expires_at" >= CURRENT_TIMESTAMP;`,
        safeCode,
        job.chunkId,
        job.processingToken
      ).catch(() => {
        // Ignore failure update errors
      });
    }
  }
}

export const knowledgeEmbeddingWorker = new KnowledgeEmbeddingWorker();

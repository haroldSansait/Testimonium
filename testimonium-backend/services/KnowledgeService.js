import { prisma as defaultPrisma } from "../config/db.js";
import { computeContentHash } from "../utils/contentHash.js";
import { env } from "../config/env.js";
import { KnowledgeRepository } from "../repositories/KnowledgeRepository.js";

export class KnowledgeService {
  constructor(prismaClient = defaultPrisma, knowledgeRepository = null) {
    this.prisma = prismaClient;
    this.repository = knowledgeRepository || new KnowledgeRepository(prismaClient);
  }

  /**
   * Validates scope and parish relationship.
   */
  async _validateScopeAndParish(tx, scope, parishId) {
    if (scope === "DIOCESE") {
      if (parishId !== null && parishId !== undefined) {
        const err = new Error("DIOCESE scope cannot have a parishId");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      return null;
    }

    if (scope === "PARISH") {
      if (!parishId || Number(parishId) <= 0) {
        const err = new Error("PARISH scope requires a valid positive parishId");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }

      const parish = await tx.parish.findUnique({
        where: { id: Number(parishId) },
      });

      if (!parish || !parish.isActive) {
        const err = new Error("Selected parish does not exist or is inactive");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }

      return Number(parishId);
    }

    const err = new Error(`Invalid scope: ${scope}`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  /**
   * Validates sourceReference URL if provided as URL.
   */
  _validateSourceReference(ref) {
    if (!ref) return null;
    const clean = String(ref).trim();
    if (clean.toLowerCase().startsWith("http://")) {
      const err = new Error("Insecure HTTP sourceReference is not allowed; must use HTTPS");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    return clean;
  }

  /**
   * List sources with pagination & filters.
   */
  async listSources({ scope, status, authority, parishId, category, search, page = 1, limit = 20 }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    return await this.repository.findSources({
      scope,
      status,
      authority,
      parishId,
      category,
      search: search ? String(search).trim() : undefined,
      page: safePage,
      limit: safeLimit,
    });
  }

  /**
   * Get single source detail with all chunks (minimized DTO: no worker tokens or raw vectors).
   */
  async getSourceById(id) {
    const source = await this.prisma.knowledgeSource.findUnique({
      where: { id: Number(id) },
      include: {
        parish: {
          select: { id: true, parishName: true },
        },
        approvedBy: {
          select: { id: true, fullName: true, email: true },
        },
        updatedBy: {
          select: { id: true, fullName: true, email: true },
        },
        chunks: {
          select: {
            id: true,
            sourceId: true,
            content: true,
            chunkOrder: true,
            contentHash: true,
            sourceVersion: true,
            embeddingStatus: true,
            embeddingProvider: true,
            embeddingModel: true,
            embeddingDimensions: true,
            embeddedAt: true,
            embeddingErrorCode: true,
            createdAt: true,
            updatedAt: true,
            // OMIT processingToken, leaseExpiresAt, vector
          },
          orderBy: [{ sourceVersion: "desc" }, { chunkOrder: "asc" }],
        },
      },
    });

    if (!source) {
      const err = new Error("Knowledge source not found");
      err.statusCode = 404;
      err.code = "KNOWLEDGE_SOURCE_NOT_FOUND";
      throw err;
    }

    return source;
  }

  /**
   * CREATE a new KnowledgeSource + version 1 PENDING chunks.
   * Initial state: DRAFT + PROVISIONAL.
   */
  async createSource({
    title,
    sourceText,
    category,
    sourceType,
    sourceReference,
    scope,
    parishId,
    chunks,
    userId,
  }) {
    return await this.prisma.$transaction(async (tx) => {
      const effectiveParishId = await this._validateScopeAndParish(tx, scope, parishId);
      const cleanRef = this._validateSourceReference(sourceReference);

      if (!Array.isArray(chunks) || chunks.length === 0) {
        const err = new Error("At least one chunk is required");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }

      const preparedChunks = chunks.map((c, idx) => ({
        content: String(c.content).trim(),
        chunkOrder: Number.isInteger(c.chunkOrder) ? c.chunkOrder : idx,
        contentHash: computeContentHash(String(c.content).trim()),
        sourceVersion: 1,
        embeddingStatus: "PENDING",
      }));

      const source = await tx.knowledgeSource.create({
        data: {
          title: String(title).trim(),
          sourceText: String(sourceText).trim(),
          category: category ? String(category).trim() : null,
          sourceType,
          sourceReference: cleanRef,
          scope,
          parishId: effectiveParishId,
          authority: "PROVISIONAL",
          status: "DRAFT",
          version: 1,
          updatedById: userId || null,
          chunks: {
            create: preparedChunks,
          },
        },
        include: {
          chunks: {
            select: {
              id: true,
              chunkOrder: true,
              sourceVersion: true,
              embeddingStatus: true,
            },
          },
          parish: true,
        },
      });

      return source;
    });
  }

  /**
   * EDIT an existing KnowledgeSource atomically.
   * Atomically locks the source row, increments version, resets to DRAFT + PROVISIONAL,
   * stales previous version chunks, and creates new current-version chunks.
   */
  async updateSource(id, {
    expectedVersion,
    title,
    sourceText,
    category,
    sourceType,
    sourceReference,
    scope,
    parishId,
    chunks,
    userId,
  }) {
    if (expectedVersion === undefined || expectedVersion === null || !Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) <= 0) {
      const err = new Error("expectedVersion is required and must be a positive integer");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    return await this.prisma.$transaction(async (tx) => {
      // Row lock and atomic version verification
      const lockedRows = await tx.$queryRaw`
        SELECT source_id, version, authority, status, scope, parish_id, source_text, title, category, source_type, source_reference
        FROM knowledge_sources
        WHERE source_id = ${Number(id)}
        FOR UPDATE;
      `;

      if (!lockedRows || lockedRows.length === 0) {
        const err = new Error("Knowledge source not found");
        err.statusCode = 404;
        err.code = "KNOWLEDGE_SOURCE_NOT_FOUND";
        throw err;
      }

      const current = lockedRows[0];
      if (Number(current.version) !== Number(expectedVersion)) {
        const err = new Error(
          `Conflict: Source version is ${current.version}, but expected ${expectedVersion}. Please refresh and retry.`
        );
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      const nextVersion = Number(current.version) + 1;
      const targetScope = scope || current.scope;
      const targetParishId = parishId !== undefined ? parishId : current.parish_id;
      const effectiveParishId = await this._validateScopeAndParish(tx, targetScope, targetParishId);
      const cleanRef = this._validateSourceReference(
        sourceReference !== undefined ? sourceReference : current.source_reference
      );

      // Stale all previous current-version chunks
      await tx.knowledgeChunk.updateMany({
        where: {
          sourceId: Number(id),
          sourceVersion: Number(current.version),
        },
        data: {
          embeddingStatus: "STALE",
          processingToken: null,
          leaseExpiresAt: null,
        },
      });

      // Prepare new chunks for nextVersion
      let newChunksData = [];
      if (Array.isArray(chunks) && chunks.length > 0) {
        newChunksData = chunks.map((c, idx) => ({
          sourceId: Number(id),
          content: String(c.content).trim(),
          chunkOrder: Number.isInteger(c.chunkOrder) ? c.chunkOrder : idx,
          contentHash: computeContentHash(String(c.content).trim()),
          sourceVersion: nextVersion,
          embeddingStatus: "PENDING",
        }));
      } else {
        // Metadata-only edit: clone previous chunks into nextVersion as PENDING
        const prevChunks = await tx.knowledgeChunk.findMany({
          where: {
            sourceId: Number(id),
            sourceVersion: Number(current.version),
          },
          orderBy: { chunkOrder: "asc" },
        });

        newChunksData = prevChunks.map((c) => ({
          sourceId: Number(id),
          content: c.content,
          chunkOrder: c.chunkOrder,
          contentHash: c.contentHash,
          sourceVersion: nextVersion,
          embeddingStatus: "PENDING",
        }));
      }

      // Atomic conditional update
      const updateResult = await tx.knowledgeSource.updateMany({
        where: {
          id: Number(id),
          version: Number(expectedVersion),
        },
        data: {
          title: title !== undefined ? String(title).trim() : current.title,
          sourceText: sourceText !== undefined ? String(sourceText).trim() : current.source_text,
          category: category !== undefined ? (category ? String(category).trim() : null) : current.category,
          sourceType: sourceType || current.source_type,
          sourceReference: cleanRef,
          scope: targetScope,
          parishId: effectiveParishId,
          authority: "PROVISIONAL", // Reset to PROVISIONAL on edit
          status: "DRAFT",          // Reset to DRAFT on edit
          version: nextVersion,
          approvedById: null,       // Cleared until re-confirmed
          approvedAt: null,
          updatedById: userId || null,
        },
      });

      if (updateResult.count === 0) {
        const err = new Error("Conflict: Source version has changed. Please refresh and retry.");
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      // Create new version chunks
      if (newChunksData.length > 0) {
        await tx.knowledgeChunk.createMany({
          data: newChunksData,
        });
      }

      return await tx.knowledgeSource.findUnique({
        where: { id: Number(id) },
        include: {
          chunks: {
            where: { sourceVersion: nextVersion },
            select: {
              id: true,
              chunkOrder: true,
              sourceVersion: true,
              embeddingStatus: true,
            },
            orderBy: { chunkOrder: "asc" },
          },
          parish: true,
        },
      });
    });
  }

  /**
   * CONFIRM a KnowledgeSource.
   * Requires: exact expectedVersion, status DRAFT, authority PROVISIONAL.
   * Atomically sets authority CONFIRMED, records approvedById and approvedAt.
   * Status remains DRAFT.
   */
  async confirmSource(id, { expectedVersion, userId }) {
    if (expectedVersion === undefined || expectedVersion === null || !Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) <= 0) {
      const err = new Error("expectedVersion is required and must be a positive integer");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    return await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT source_id, version, authority, status
        FROM knowledge_sources
        WHERE source_id = ${Number(id)}
        FOR UPDATE;
      `;

      if (!lockedRows || lockedRows.length === 0) {
        const err = new Error("Knowledge source not found");
        err.statusCode = 404;
        err.code = "KNOWLEDGE_SOURCE_NOT_FOUND";
        throw err;
      }

      const current = lockedRows[0];
      if (Number(current.version) !== Number(expectedVersion)) {
        const err = new Error("Conflict: Source version has changed. Please refresh and retry.");
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      if (current.status !== "DRAFT") {
        const err = new Error(`Only DRAFT sources can be confirmed (current: ${current.status})`);
        err.statusCode = 400;
        err.code = "INVALID_STATE_TRANSITION";
        throw err;
      }

      if (current.authority !== "PROVISIONAL") {
        const err = new Error(`Source is already ${current.authority}; must be PROVISIONAL to confirm`);
        err.statusCode = 400;
        err.code = "INVALID_STATE_TRANSITION";
        throw err;
      }

      const updateResult = await tx.knowledgeSource.updateMany({
        where: {
          id: Number(id),
          version: Number(expectedVersion),
          status: "DRAFT",
          authority: "PROVISIONAL",
        },
        data: {
          authority: "CONFIRMED",
          approvedById: userId || null,
          approvedAt: new Date(),
          updatedById: userId || null,
        },
      });

      if (updateResult.count === 0) {
        const err = new Error("Conflict: Source state has changed concurrently.");
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      return await tx.knowledgeSource.findUnique({
        where: { id: Number(id) },
        include: {
          chunks: {
            where: { sourceVersion: Number(current.version) },
            select: {
              id: true,
              chunkOrder: true,
              sourceVersion: true,
              embeddingStatus: true,
            },
            orderBy: { chunkOrder: "asc" },
          },
        },
      });
    });
  }

  /**
   * PUBLISH a KnowledgeSource.
   * Requires:
   * - exact expectedVersion
   * - status DRAFT
   * - authority CONFIRMED
   * - strengthened publication validation for every current-version chunk:
   *   READY, non-null embedding, matching configured provider/model/dimensions, matching contentHash.
   * Atomically transitions status to ACTIVE.
   */
  async publishSource(id, { expectedVersion, userId }) {
    if (expectedVersion === undefined || expectedVersion === null || !Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) <= 0) {
      const err = new Error("expectedVersion is required and must be a positive integer");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const configuredProvider = env.chatbot.embeddingProvider;
    const configuredModel = env.chatbot.embeddingModel;
    const configuredDimensions = env.chatbot.embeddingDimensions;

    return await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT source_id, version, authority, status, effective_from
        FROM knowledge_sources
        WHERE source_id = ${Number(id)}
        FOR UPDATE;
      `;

      if (!lockedRows || lockedRows.length === 0) {
        const err = new Error("Knowledge source not found");
        err.statusCode = 404;
        err.code = "KNOWLEDGE_SOURCE_NOT_FOUND";
        throw err;
      }

      const current = lockedRows[0];
      if (Number(current.version) !== Number(expectedVersion)) {
        const err = new Error("Conflict: Source version has changed. Please refresh and retry.");
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      if (current.authority !== "CONFIRMED") {
        const err = new Error("Source must be CONFIRMED before publication");
        err.statusCode = 400;
        err.code = "SOURCE_NOT_CONFIRMED";
        throw err;
      }

      if (current.status !== "DRAFT") {
        const err = new Error(`Only DRAFT sources can be published (current: ${current.status})`);
        err.statusCode = 400;
        err.code = "INVALID_STATE_TRANSITION";
        throw err;
      }

      // Check current-version chunks via raw SQL to safely inspect vector non-null constraint
      const chunkRows = await tx.$queryRaw`
        SELECT 
          chunk_id,
          source_version,
          embedding_status,
          embedding_provider,
          embedding_model,
          embedding_dimensions,
          content_hash,
          content,
          (embedding IS NOT NULL) AS "has_embedding"
        FROM knowledge_chunks
        WHERE source_id = ${Number(id)} AND source_version = ${Number(current.version)};
      `;

      if (!chunkRows || chunkRows.length === 0) {
        const err = new Error("Cannot publish source with zero chunks");
        err.statusCode = 400;
        err.code = "NO_CHUNKS";
        throw err;
      }

      // Strengthened publication checks: EVERY current-version chunk must be verified
      for (const chunk of chunkRows) {
        if (chunk.embedding_status !== "READY") {
          const err = new Error(
            `Cannot publish: chunk #${chunk.chunk_id} has status "${chunk.embedding_status}" (must be READY)`
          );
          err.statusCode = 400;
          err.code = "CHUNKS_NOT_READY";
          throw err;
        }

        if (!chunk.has_embedding) {
          const err = new Error(`Cannot publish: chunk #${chunk.chunk_id} has null embedding`);
          err.statusCode = 400;
          err.code = "INVALID_EMBEDDING_PROFILE";
          throw err;
        }

        if (chunk.embedding_provider !== configuredProvider) {
          const err = new Error(
            `Cannot publish: chunk #${chunk.chunk_id} provider "${chunk.embedding_provider}" does not match configured "${configuredProvider}"`
          );
          err.statusCode = 400;
          err.code = "INVALID_EMBEDDING_PROFILE";
          throw err;
        }

        if (chunk.embedding_model !== configuredModel) {
          const err = new Error(
            `Cannot publish: chunk #${chunk.chunk_id} model "${chunk.embedding_model}" does not match configured "${configuredModel}"`
          );
          err.statusCode = 400;
          err.code = "INVALID_EMBEDDING_PROFILE";
          throw err;
        }

        if (Number(chunk.embedding_dimensions) !== configuredDimensions) {
          const err = new Error(
            `Cannot publish: chunk #${chunk.chunk_id} dimensions ${chunk.embedding_dimensions} != ${configuredDimensions}`
          );
          err.statusCode = 400;
          err.code = "INVALID_EMBEDDING_PROFILE";
          throw err;
        }

        const expectedHash = computeContentHash(chunk.content);
        if (chunk.content_hash !== expectedHash) {
          const err = new Error(`Cannot publish: chunk #${chunk.chunk_id} contentHash mismatch`);
          err.statusCode = 400;
          err.code = "INVALID_EMBEDDING_PROFILE";
          throw err;
        }
      }

      // Atomic conditional publication update
      const updateResult = await tx.knowledgeSource.updateMany({
        where: {
          id: Number(id),
          version: Number(expectedVersion),
          status: "DRAFT",
          authority: "CONFIRMED",
        },
        data: {
          status: "ACTIVE",
          effectiveFrom: current.effective_from || new Date(),
          updatedById: userId || null,
        },
      });

      if (updateResult.count === 0) {
        const err = new Error("Conflict: Source state has changed concurrently.");
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      return await tx.knowledgeSource.findUnique({
        where: { id: Number(id) },
        include: {
          chunks: {
            where: { sourceVersion: Number(current.version) },
            select: {
              id: true,
              chunkOrder: true,
              sourceVersion: true,
              embeddingStatus: true,
            },
            orderBy: { chunkOrder: "asc" },
          },
        },
      });
    });
  }

  /**
   * RETIRE a KnowledgeSource.
   * Requires exact expectedVersion.
   */
  async retireSource(id, { expectedVersion, userId }) {
    if (expectedVersion === undefined || expectedVersion === null || !Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) <= 0) {
      const err = new Error("expectedVersion is required and must be a positive integer");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    return await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT source_id, version
        FROM knowledge_sources
        WHERE source_id = ${Number(id)}
        FOR UPDATE;
      `;

      if (!lockedRows || lockedRows.length === 0) {
        const err = new Error("Knowledge source not found");
        err.statusCode = 404;
        err.code = "KNOWLEDGE_SOURCE_NOT_FOUND";
        throw err;
      }

      const current = lockedRows[0];
      if (Number(current.version) !== Number(expectedVersion)) {
        const err = new Error("Conflict: Source version has changed. Please refresh and retry.");
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      const updateResult = await tx.knowledgeSource.updateMany({
        where: {
          id: Number(id),
          version: Number(expectedVersion),
        },
        data: {
          status: "RETIRED",
          retiredAt: new Date(),
          updatedById: userId || null,
        },
      });

      if (updateResult.count === 0) {
        const err = new Error("Conflict: Source version has changed. Please refresh and retry.");
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      return await tx.knowledgeSource.findUnique({
        where: { id: Number(id) },
      });
    });
  }

  /**
   * RETRY EMBEDDING for current-version FAILED chunks.
   * Requires exact expectedVersion.
   */
  async retryFailedEmbeddings(id, { expectedVersion, userId }) {
    if (expectedVersion === undefined || expectedVersion === null || !Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) <= 0) {
      const err = new Error("expectedVersion is required and must be a positive integer");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    return await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT source_id, version
        FROM knowledge_sources
        WHERE source_id = ${Number(id)}
        FOR UPDATE;
      `;

      if (!lockedRows || lockedRows.length === 0) {
        const err = new Error("Knowledge source not found");
        err.statusCode = 404;
        err.code = "KNOWLEDGE_SOURCE_NOT_FOUND";
        throw err;
      }

      const current = lockedRows[0];
      if (Number(current.version) !== Number(expectedVersion)) {
        const err = new Error("Conflict: Source version has changed. Please refresh and retry.");
        err.statusCode = 409;
        err.code = "KNOWLEDGE_CONCURRENCY_CONFLICT";
        throw err;
      }

      const updateResult = await tx.knowledgeChunk.updateMany({
        where: {
          sourceId: Number(id),
          sourceVersion: Number(current.version),
          embeddingStatus: "FAILED",
        },
        data: {
          embeddingStatus: "PENDING",
          processingToken: null,
          leaseExpiresAt: null,
          embeddingErrorCode: null,
        },
      });

      return {
        sourceId: Number(id),
        retriedCount: updateResult.count,
      };
    });
  }
}

export const knowledgeService = new KnowledgeService();

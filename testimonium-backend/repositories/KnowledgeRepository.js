import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

export class KnowledgeRepository {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  /**
   * Validates and serializes a 768-dimensional float array into a PostgreSQL pgvector literal.
   * Format: '[0.123,0.456,...]'
   */
  serializeVector(vector) {
    if (!Array.isArray(vector)) {
      throw new Error(`Invalid vector: expected array, got ${typeof vector}`);
    }
    const expectedDim = env.chatbot?.embeddingDimensions || 768;
    if (vector.length !== expectedDim) {
      throw new Error(`Vector length mismatch: expected ${expectedDim}, got ${vector.length}`);
    }
    for (let i = 0; i < vector.length; i++) {
      if (!Number.isFinite(vector[i])) {
        throw new Error(`Vector contains non-finite value at index ${i}: ${vector[i]}`);
      }
    }
    return `[${vector.map((v) => Number(v.toFixed(6))).join(",")}]`;
  }

  /**
   * Exact vector similarity retrieval with strict database-level tenancy filtering.
   *
   * @param {object} params
   * @param {number[]} params.queryVector
   * @param {number|null} [params.selectedParishId]
   * @param {number} [params.limit]
   * @param {string} [params.embeddingModel]
   * @returns {Promise<Array<object>>}
   */
  async findSimilarChunks({
    queryVector,
    selectedParishId = null,
    limit = env.chatbot?.topK || 8,
    embeddingModel = env.chatbot?.embeddingModel || "gemini-embedding-2",
  }) {
    const vectorStr = this.serializeVector(queryVector);

    let results;

    if (selectedParishId !== null && Number.isInteger(selectedParishId) && selectedParishId > 0) {
      // Selected Parish: Diocese + Selected Parish only
      results = await this.prisma.$queryRawUnsafe(
        `SELECT 
          kc.chunk_id AS "chunkId",
          kc.source_id AS "sourceId",
          kc.content AS "content",
          kc.chunk_order AS "chunkOrder",
          kc.source_version AS "sourceVersion",
          ks.title AS "title",
          ks.category AS "category",
          ks.source_type AS "sourceType",
          ks.source_reference AS "sourceReference",
          ks.scope AS "scope",
          ks.parish_id AS "parishId",
          ks.authority AS "authority",
          ks.status AS "status",
          (1 - (kc.embedding <=> $1::vector)) AS "semanticScore"
        FROM knowledge_chunks kc
        JOIN knowledge_sources ks ON kc.source_id = ks.source_id
        WHERE ks.status = 'ACTIVE'::"KnowledgeSourceStatus"
          AND ks.authority = 'CONFIRMED'::"KnowledgeAuthority"
          AND kc.embedding_status = 'READY'::"EmbeddingStatus"
          AND kc.source_version = ks.version
          AND kc.embedding_model = $2
          AND (
            ks.scope = 'DIOCESE'::"KnowledgeScope"
            OR (ks.scope = 'PARISH'::"KnowledgeScope" AND ks.parish_id = $3)
          )
        ORDER BY kc.embedding <=> $1::vector ASC
        LIMIT $4;`,
        vectorStr,
        embeddingModel,
        selectedParishId,
        limit
      );
    } else {
      // No parish selected: Diocese scope only
      results = await this.prisma.$queryRawUnsafe(
        `SELECT 
          kc.chunk_id AS "chunkId",
          kc.source_id AS "sourceId",
          kc.content AS "content",
          kc.chunk_order AS "chunkOrder",
          kc.source_version AS "sourceVersion",
          ks.title AS "title",
          ks.category AS "category",
          ks.source_type AS "sourceType",
          ks.source_reference AS "sourceReference",
          ks.scope AS "scope",
          ks.parish_id AS "parishId",
          ks.authority AS "authority",
          ks.status AS "status",
          (1 - (kc.embedding <=> $1::vector)) AS "semanticScore"
        FROM knowledge_chunks kc
        JOIN knowledge_sources ks ON kc.source_id = ks.source_id
        WHERE ks.status = 'ACTIVE'::"KnowledgeSourceStatus"
          AND ks.authority = 'CONFIRMED'::"KnowledgeAuthority"
          AND kc.embedding_status = 'READY'::"EmbeddingStatus"
          AND kc.source_version = ks.version
          AND kc.embedding_model = $2
          AND ks.scope = 'DIOCESE'::"KnowledgeScope"
        ORDER BY kc.embedding <=> $1::vector ASC
        LIMIT $3;`,
        vectorStr,
        embeddingModel,
        limit
      );
    }

    return results.map((row) => ({
      chunkId: Number(row.chunkId),
      sourceId: Number(row.sourceId),
      content: String(row.content),
      chunkOrder: Number(row.chunkOrder),
      sourceVersion: Number(row.sourceVersion),
      title: String(row.title),
      category: row.category ? String(row.category) : null,
      sourceType: String(row.sourceType),
      sourceReference: row.sourceReference ? String(row.sourceReference) : null,
      scope: String(row.scope),
      parishId: row.parishId !== null ? Number(row.parishId) : null,
      authority: String(row.authority),
      status: String(row.status),
      semanticScore: Number(row.semanticScore),
      rankingScore: Number(row.semanticScore),
    }));
  }

  /**
   * Find source by ID with its chunks.
   */
  async findSourceById(sourceId) {
    return this.prisma.knowledgeSource.findUnique({
      where: { id: Number(sourceId) },
      include: {
        chunks: {
          orderBy: { chunkOrder: "asc" },
        },
        parish: {
          select: { id: true, parishName: true },
        },
        approvedBy: {
          select: { id: true, fullName: true },
        },
        updatedBy: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  /**
   * List sources with pagination and filters.
   */
  async findSources({ scope, status, authority, parishId, category, search, page = 1, limit = 20 }) {
    const where = {};
    if (scope) where.scope = scope;
    if (status) where.status = status;
    if (authority) where.authority = authority;
    if (parishId) where.parishId = Number(parishId);
    if (category) where.category = category;
    if (search && String(search).trim()) {
      const query = String(search).trim();
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { sourceReference: { contains: query, mode: "insensitive" } },
        { parish: { is: { parishName: { contains: query, mode: "insensitive" } } } },
      ];
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [total, items] = await Promise.all([
      this.prisma.knowledgeSource.count({ where }),
      this.prisma.knowledgeSource.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        include: {
          parish: {
            select: { id: true, parishName: true },
          },
          chunks: {
            select: {
              id: true,
              chunkOrder: true,
              sourceVersion: true,
              embeddingStatus: true,
              embeddingProvider: true,
              embeddingModel: true,
              embeddedAt: true,
              embeddingErrorCode: true,
            },
            orderBy: { chunkOrder: "asc" },
          },
        },
      }),
    ]);

    return {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      data: items,
    };
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledgeSourceSchema, updateKnowledgeSourceSchema, versionedActionSchema } from '../validators/knowledgeSchemas.js';
import { KnowledgeService } from '../services/KnowledgeService.js';
import { env } from '../config/env.js';

test('CP4 Knowledge Base Suite', async (t) => {
  await t.test('1. Validation: create schema requires title, sourceText, scope, valid chunks, rejects unknown fields', () => {
    // Valid DIOCESE
    const valid = createKnowledgeSourceSchema.safeParse({
      title: 'Valid Baptism Guide',
      sourceText: 'Full source text here',
      category: 'SACRAMENTS',
      sourceType: 'SYSTEM_GUIDE',
      scope: 'DIOCESE',
      chunks: [
        { content: 'Chunk 1 content' },
        { content: 'Chunk 2 content' }
      ]
    });
    assert.equal(valid.success, true);

    // DIOCESE with parishId must fail
    const badDiocese = createKnowledgeSourceSchema.safeParse({
      title: 'Bad Diocese',
      sourceText: 'Text',
      scope: 'DIOCESE',
      parishId: 1,
      chunks: [{ content: 'Content' }]
    });
    assert.equal(badDiocese.success, false);

    // PARISH without parishId must fail
    const badParish = createKnowledgeSourceSchema.safeParse({
      title: 'Bad Parish',
      sourceText: 'Text',
      scope: 'PARISH',
      chunks: [{ content: 'Content' }]
    });
    assert.equal(badParish.success, false);

    // Unknown fields must be rejected (strict schema)
    const unknownField = createKnowledgeSourceSchema.safeParse({
      title: 'Valid Title',
      sourceText: 'Text',
      scope: 'DIOCESE',
      chunks: [{ content: 'Content' }],
      unauthorizedAdminFlag: true
    });
    assert.equal(unknownField.success, false);

    // Empty chunks list must fail
    const emptyChunks = createKnowledgeSourceSchema.safeParse({
      title: 'No chunks',
      sourceText: 'Text',
      scope: 'DIOCESE',
      chunks: []
    });
    assert.equal(emptyChunks.success, false);
  });

  await t.test('2. Validation: sourceReference validation', () => {
    // Plain text is allowed
    const plainRef = createKnowledgeSourceSchema.safeParse({
      title: 'Doc Ref Guide',
      sourceText: 'Complete text of guide with sufficient length',
      sourceType: 'SYSTEM_GUIDE',
      scope: 'DIOCESE',
      sourceReference: 'Parish Handbook 2026 p. 45',
      chunks: [{ content: 'Content chunk with sufficient length' }]
    });
    assert.equal(plainRef.success, true);

    // HTTPS URL is allowed
    const httpsRef = createKnowledgeSourceSchema.safeParse({
      title: 'Doc Ref Guide',
      sourceText: 'Complete text of guide with sufficient length',
      sourceType: 'SYSTEM_GUIDE',
      scope: 'DIOCESE',
      sourceReference: 'https://dioceseofbacolod.org/guides/baptism',
      chunks: [{ content: 'Content chunk with sufficient length' }]
    });
    assert.equal(httpsRef.success, true);

    // Insecure HTTP URL or javascript: must be rejected
    const httpRef = createKnowledgeSourceSchema.safeParse({
      title: 'Doc Ref Guide',
      sourceText: 'Complete text of guide with sufficient length',
      sourceType: 'SYSTEM_GUIDE',
      scope: 'DIOCESE',
      sourceReference: 'http://insecure.example.com',
      chunks: [{ content: 'Content chunk with sufficient length' }]
    });
    assert.equal(httpRef.success, false);

    const jsRef = createKnowledgeSourceSchema.safeParse({
      title: 'Doc Ref Guide',
      sourceText: 'Complete text of guide with sufficient length',
      sourceType: 'SYSTEM_GUIDE',
      scope: 'DIOCESE',
      sourceReference: 'javascript:alert(1)',
      chunks: [{ content: 'Content chunk with sufficient length' }]
    });
    assert.equal(jsRef.success, false);
  });

  await t.test('3. Validation: update schema requires expectedVersion and strictly validates', () => {
    const updateValid = updateKnowledgeSourceSchema.safeParse({
      expectedVersion: 1,
      title: 'Updated Title',
      chunks: [{ content: 'New chunk with at least 10 chars' }]
    });
    assert.equal(updateValid.success, true);

    const missingVersion = updateKnowledgeSourceSchema.safeParse({
      title: 'Updated Title'
    });
    assert.equal(missingVersion.success, false);

    const actionValid = versionedActionSchema.safeParse({
      expectedVersion: 2
    });
    assert.equal(actionValid.success, true);
  });

  await t.test('4. Service Governance Lifecycle: Create -> Confirm -> Ready -> Publish -> Retire', async () => {
    // Mock DB state
    let sourceState = null;
    let chunksState = [];

    const mockPrisma = {
      $transaction: async (fn) => {
        return await fn(mockTx);
      },
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 1) return { id: 1, name: 'San Sebastian Cathedral', isActive: true };
          return null;
        }
      },
      knowledgeSource: {
        findUnique: async ({ where, include }) => {
          if (!sourceState || sourceState.id !== where.id) return null;
          const res = { ...sourceState };
          if (include?.chunks) {
            res.chunks = chunksState.filter(c => c.sourceId === where.id && c.sourceVersion === sourceState.version);
          }
          return res;
        },
        findMany: async () => [sourceState].filter(Boolean),
        count: async () => sourceState ? 1 : 0
      }
    };

    const mockTx = {
      $queryRaw: async (strings) => {
        const sql = Array.isArray(strings) ? strings.join('?') : String(strings);
        if (sql.includes('FROM knowledge_sources')) {
          if (!sourceState) return [];
          return [{
            source_id: sourceState.id,
            version: sourceState.version,
            authority: sourceState.authority,
            status: sourceState.status,
            scope: sourceState.scope,
            parish_id: sourceState.parishId,
            source_text: sourceState.sourceText,
            title: sourceState.title,
            category: sourceState.category,
            source_type: sourceState.sourceType,
            source_reference: sourceState.sourceReference,
            effective_from: sourceState.effectiveFrom,
          }];
        }
        if (sql.includes('FROM knowledge_chunks')) {
          return chunksState
            .filter((chunk) => chunk.sourceId === sourceState.id && chunk.sourceVersion === sourceState.version)
            .map((chunk) => ({
              chunk_id: chunk.id,
              source_version: chunk.sourceVersion,
              embedding_status: chunk.embeddingStatus,
              embedding_provider: chunk.embeddingProvider,
              embedding_model: chunk.embeddingModel,
              embedding_dimensions: chunk.embeddingDimensions,
              content_hash: chunk.contentHash,
              content: chunk.content,
              has_embedding: chunk.embedding !== null && chunk.embedding !== undefined,
            }));
        }
        throw new Error(`Unexpected raw query: ${sql}`);
      },
      parish: mockPrisma.parish,
      knowledgeSource: {
        create: async ({ data, include }) => {
          const { chunks, ...sourceFields } = data;
          sourceState = {
            id: 101,
            ...sourceFields,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          if (chunks?.create) {
            for (let i = 0; i < chunks.create.length; i++) {
              chunksState.push({
                id: 1000 + chunksState.length + 1,
                sourceId: sourceState.id,
                ...chunks.create[i],
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }
          const res = { ...sourceState };
          if (include?.chunks) {
            res.chunks = chunksState.filter(c => c.sourceId === sourceState.id);
          }
          return res;
        },
        update: async ({ where, data, include }) => {
          assert.equal(where.id, sourceState.id);
          const { chunks, ...sourceFields } = data;
          sourceState = { ...sourceState, ...sourceFields, updatedAt: new Date() };
          if (chunks?.create) {
            for (let i = 0; i < chunks.create.length; i++) {
              chunksState.push({
                id: 1000 + chunksState.length + 1,
                sourceId: sourceState.id,
                ...chunks.create[i],
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }
          const res = { ...sourceState };
          if (include?.chunks) {
            res.chunks = chunksState.filter(c => c.sourceId === sourceState.id);
          }
          return res;
        },
        updateMany: async ({ where, data }) => {
          if (!sourceState || sourceState.id !== where.id) return { count: 0 };
          if (where.version !== undefined && sourceState.version !== where.version) return { count: 0 };
          if (where.status !== undefined && sourceState.status !== where.status) return { count: 0 };
          if (where.authority !== undefined && sourceState.authority !== where.authority) return { count: 0 };
          sourceState = { ...sourceState, ...data, updatedAt: new Date() };
          return { count: 1 };
        },
        findUnique: async ({ where, include }) => {
          if (!sourceState || sourceState.id !== where.id) return null;
          const res = { ...sourceState };
          if (include?.chunks) {
            const chunkWhere = include.chunks.where || {};
            res.chunks = chunksState.filter(c =>
              c.sourceId === where.id &&
              (chunkWhere.sourceVersion === undefined || c.sourceVersion === chunkWhere.sourceVersion)
            );
          }
          return res;
        }
      },
      knowledgeChunk: {
        createMany: async ({ data }) => {
          for (const chunk of data) {
            chunksState.push({
              id: 1000 + chunksState.length + 1,
              ...chunk,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return { count: data.length };
        },
        updateMany: async ({ where, data }) => {
          let count = 0;
          for (const c of chunksState) {
            if (c.sourceId === where.sourceId) {
              if (where.sourceVersion && c.sourceVersion !== where.sourceVersion) continue;
              if (where.embeddingStatus?.in && !where.embeddingStatus.in.includes(c.embeddingStatus)) continue;
              Object.assign(c, data);
              count++;
            }
          }
          return { count };
        },
        findMany: async ({ where }) => {
          return chunksState.filter(c => {
            if (where.sourceId && c.sourceId !== where.sourceId) return false;
            if (where.sourceVersion && c.sourceVersion !== where.sourceVersion) return false;
            return true;
          });
        }
      }
    };

    const service = new KnowledgeService(mockPrisma);

    // Step 1: CREATE
    const created = await service.createSource({
      title: 'Baptism Protocol',
      sourceText: 'Complete text for baptismal procedures in parish',
      category: 'SACRAMENTS',
      sourceType: 'SYSTEM_GUIDE',
      scope: 'DIOCESE',
      chunks: [
        { content: 'Chunk 1 on baptism guidelines' },
        { content: 'Chunk 2 on baptism schedules' }
      ],
      userId: 1
    });

    assert.equal(created.status, 'DRAFT');
    assert.equal(created.authority, 'PROVISIONAL');
    assert.equal(created.version, 1);
    assert.equal(created.chunks.length, 2);
    assert.equal(created.chunks[0].embeddingStatus, 'PENDING');

    // Step 2: Concurrency check on edit
    await assert.rejects(
      () => service.updateSource(101, {
        expectedVersion: 999, // Mismatch!
        title: 'Changed title',
        userId: 1
      }),
      (err) => {
        assert.equal(err.code, 'KNOWLEDGE_CONCURRENCY_CONFLICT');
        return true;
      }
    );

    // Step 3: CONFIRM
    const confirmed = await service.confirmSource(101, {
      expectedVersion: 1,
      userId: 42
    });
    assert.equal(confirmed.authority, 'CONFIRMED');
    assert.equal(confirmed.status, 'DRAFT'); // MUST remain DRAFT, never auto-activate
    assert.equal(confirmed.approvedById, 42);

    // Step 4: PUBLISH before embedding ready must fail
    await assert.rejects(
      () => service.publishSource(101, {
        expectedVersion: 1,
        userId: 42
      }),
      (err) => {
        assert.equal(err.code, 'CHUNKS_NOT_READY');
        return true;
      }
    );

    // Simulate worker embedding chunks to READY
    for (const c of chunksState) {
      if (c.sourceVersion === 1) {
        c.embeddingStatus = 'READY';
        c.embedding = [0.1];
        c.embeddingProvider = env.chatbot.embeddingProvider;
        c.embeddingModel = env.chatbot.embeddingModel;
        c.embeddingDimensions = env.chatbot.embeddingDimensions;
      }
    }

    // Step 5: PUBLISH now succeeds
    const published = await service.publishSource(101, {
      expectedVersion: 1,
      userId: 42
    });
    assert.equal(published.status, 'ACTIVE');
    assert.equal(published.authority, 'CONFIRMED');

    // Step 6: EDIT on ACTIVE source resets it to DRAFT + PROVISIONAL, bumps version, invalidates old chunks
    const updated = await service.updateSource(101, {
      expectedVersion: 1,
      title: 'Baptism Protocol v2',
      chunks: [
        { content: 'New single chunk for version 2' }
      ],
      userId: 42
    });

    assert.equal(updated.version, 2);
    assert.equal(updated.status, 'DRAFT');
    assert.equal(updated.authority, 'PROVISIONAL');
    assert.equal(updated.approvedById, null);

    // Verify old chunks are marked STALE
    const v1Chunks = chunksState.filter(c => c.sourceVersion === 1);
    assert.equal(v1Chunks.every(c => c.embeddingStatus === 'STALE'), true);

    // Verify new chunk is PENDING version 2
    const v2Chunks = chunksState.filter(c => c.sourceVersion === 2);
    assert.equal(v2Chunks.length, 1);
    assert.equal(v2Chunks[0].embeddingStatus, 'PENDING');
    assert.equal(v2Chunks[0].chunkOrder, 0);

    // Step 7: RETIRE
    const retired = await service.retireSource(101, {
      expectedVersion: 2,
      userId: 42
    });
    assert.equal(retired.status, 'RETIRED');
    assert.ok(retired.retiredAt);
  });

  await t.test('5. Role Authorization: DIOCESE_COORDINATOR allowed, others denied', async () => {
    const { checkRole } = await import('../middlewares/roleMiddleware.js');
    const guard = checkRole(['DIOCESE_COORDINATOR']);

    let nextCalled = false;
    const req = { user: { role: 'DIOCESE_COORDINATOR' } };
    const res = {
      status: (code) => ({ json: (data) => ({ code, data }) })
    };
    guard(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true, 'Coordinator must be allowed');

    const deniedRoles = ['PARISH_SECRETARY', 'PRIEST', 'PARISHIONER'];
    for (const role of deniedRoles) {
      let denied = false;
      let statusCode = 0;
      const resMock = {
        status: (code) => {
          statusCode = code;
          return {
            json: () => { denied = true; }
          };
        }
      };
      guard({ user: { role } }, resMock, () => { assert.fail(`Role ${role} should not call next`); });
      assert.equal(denied, true);
      assert.equal(statusCode, 403);
    }
  });
});

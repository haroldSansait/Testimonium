import test from "node:test";
import assert from "node:assert/strict";
import { listKnowledgeSchema } from "../validators/knowledgeSchemas.js";
import { KnowledgeController } from "../controllers/KnowledgeController.js";
import { KnowledgeRepository } from "../repositories/KnowledgeRepository.js";
import { KnowledgeService } from "../services/KnowledgeService.js";

test("Knowledge admin list query is strict and bounded", () => {
  assert.deepEqual(listKnowledgeSchema.parse({}), { page: 1, limit: 20 });
  assert.equal(listKnowledgeSchema.safeParse({ unknown: "value" }).success, false);
  assert.equal(listKnowledgeSchema.safeParse({ page: "0" }).success, false);
  assert.equal(listKnowledgeSchema.safeParse({ limit: "101" }).success, false);
  assert.equal(listKnowledgeSchema.parse({ page: "3", limit: "25", search: "baptism" }).page, 3);
});

test("KnowledgeController forwards validated list filters, search, and pagination", async () => {
  let captured;
  const expected = { total: 0, page: 2, limit: 15, totalPages: 0, data: [] };
  const controller = new KnowledgeController({
    async listSources(params) {
      captured = params;
      return expected;
    },
  });
  let response;
  await controller.list(
    { query: { scope: "PARISH", status: "DRAFT", authority: "PROVISIONAL", parishId: "9", category: "SACRAMENTS", search: "font", page: "2", limit: "15" } },
    { status(code) { assert.equal(code, 200); return { json(body) { response = body; } }; } },
    (error) => { throw error; },
  );
  assert.deepEqual(captured, {
    scope: "PARISH", status: "DRAFT", authority: "PROVISIONAL", parishId: 9,
    category: "SACRAMENTS", search: "font", page: 2, limit: 15,
  });
  assert.deepEqual(response, { success: true, data: expected });
});

test("KnowledgeRepository applies safe server search and database pagination", async () => {
  let countArgs;
  let findManyArgs;
  const repository = new KnowledgeRepository({
    knowledgeSource: {
      async count(args) { countArgs = args; return 41; },
      async findMany(args) { findManyArgs = args; return [{ id: 21 }]; },
    },
  });
  const result = await repository.findSources({
    status: "ACTIVE", search: "Saint Joseph", page: 3, limit: 20,
  });
  assert.deepEqual(countArgs.where, findManyArgs.where);
  assert.equal(findManyArgs.skip, 40);
  assert.equal(findManyArgs.take, 20);
  assert.equal(findManyArgs.where.status, "ACTIVE");
  assert.equal(findManyArgs.where.OR.length, 4);
  assert.deepEqual(findManyArgs.where.OR[0], { title: { contains: "Saint Joseph", mode: "insensitive" } });
  assert.equal(findManyArgs.where.OR[3].parish.is.parishName.contains, "Saint Joseph");
  assert.deepEqual(result, { total: 41, page: 3, limit: 20, totalPages: 3, data: [{ id: 21 }] });
});

test("KnowledgeService forwards normalized list inputs to its repository", async () => {
  let captured;
  const repository = { async findSources(params) { captured = params; return { data: [] }; } };
  const service = new KnowledgeService({}, repository);
  await service.listSources({ search: "  baptism  ", page: -5, limit: 999 });
  assert.equal(captured.search, "baptism");
  assert.equal(captured.page, 1);
  assert.equal(captured.limit, 100);
});

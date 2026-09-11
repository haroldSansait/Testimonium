import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiSource = fs.readFileSync(new URL("../src/api/knowledgeApi.ts", import.meta.url), "utf8");
const pageSource = fs.readFileSync(new URL("../src/pages/KnowledgeBasePage.tsx", import.meta.url), "utf8");

test("Knowledge admin API requires expectedVersion for every governance action", () => {
  for (const action of ["confirm", "publish", "retire", "retryEmbedding"]) {
    assert.match(apiSource, new RegExp(`async ${action}\\(id: number, expectedVersion: number\\)`));
  }
  assert.doesNotMatch(apiSource, /expectedVersion\?: number/);
});

test("Knowledge admin list sends server filters, search, and pagination", () => {
  assert.match(apiSource, /interface KnowledgeListParams[\s\S]*page\?: number;[\s\S]*limit\?: number;[\s\S]*search\?: string;/);
  assert.match(pageSource, /const params: KnowledgeListParams = \{ page, limit: pageSize \}/);
  assert.match(pageSource, /params\.search = search\.trim\(\)/);
  assert.match(pageSource, /setSources\(res\.data \|\| \[\]\)/);
  assert.match(pageSource, /Page \{page\} of \{Math\.max\(totalPages, 1\)\}/);
  assert.doesNotMatch(pageSource, /filteredSources/);
});

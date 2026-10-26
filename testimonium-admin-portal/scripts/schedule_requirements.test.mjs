import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/schedule-requests/ScheduleAttachments.tsx', import.meta.url), 'utf8');
function render(query) {
  let queryFn; let queryKey;
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023,
  } });
  runInNewContext(outputText, { module, exports: module.exports, require(name) {
    if (name === '@/api/api') return { get: async (endpoint) => ({ data: { data: [{ endpoint }] } }) };
    if (name === '@/hooks/useCachedQuery') return { useCachedQuery: (key, fn) => { queryKey = key; queryFn = fn; return query; } };
    if (name === '@/components/document-requests/SecureBlobViewer') return { SecureBlobViewer: (props) => React.createElement('a', { href: props.endpoint, download: props.fileName }, 'Secure preview') };
    return require(name);
  } });
  const html = renderToStaticMarkup(React.createElement(module.exports.ScheduleAttachments, { scheduleId: '42' }));
  return { html, queryFn, queryKey };
}

test('Secretary attachment section renders names and existing secure viewer with schedule-scoped endpoints', async () => {
  const { html, queryKey, queryFn } = render({ data: [{ id: 7, requirementLabel: 'CENOMAR', fileName: 'private.pdf', fileType: 'application/pdf' }] });
  assert.match(html, /CENOMAR/); assert.match(html, /private.pdf/);
  assert.match(html, /\/schedule-requests\/42\/attachments\/7\/file/);
  assert.equal(JSON.stringify(queryKey), JSON.stringify(['schedules', '42', 'attachments']));
  assert.equal((await queryFn())[0].endpoint, '/schedule-requests/42/attachments');
});

test('Secretary attachment section handles loading, retry and legacy bookings without attachments', () => {
  assert.match(render({ loading: true }).html, /Loading documents/);
  assert.match(render({ error: 'Unavailable' }).html, /Retry/);
  assert.equal(render({ data: [], loading: false }).html, '');
});

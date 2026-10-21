import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual existing timer hook in a controlled effects runtime.
function harness(intervalMs, enabled = true) {
  const timers = new Map(), listeners = new Map(), cleanups = [];
  let calls = 0;
  const document = { visibilityState: 'visible', addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/hooks/useAutoRefresh.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, document,
    setInterval: (fn, ms) => { const key = {}; timers.set(key, { fn, ms }); return key; }, clearInterval: key => timers.delete(key),
    require: () => ({ useRef: current => ({ current }), useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } }),
  });
  module.exports.useAutoRefresh(() => { calls++; }, { intervalMs, enabled });
  return { timers, document, calls: () => calls, emit: () => listeners.get('visibilitychange')?.(), cleanup: () => cleanups.forEach(fn => fn()) };
}

for (const interval of [5000, 30_000, 60_000]) test(`existing ${interval}ms polling remains visibility-aware and cleans up`, () => {
  const h = harness(interval);
  assert.equal(h.timers.size, 1);
  let timer = [...h.timers.values()][0];
  assert.equal(timer.ms, interval);
  timer.fn(); assert.equal(h.calls(), 1);
  h.document.visibilityState = 'hidden'; h.emit();
  assert.equal(h.timers.size, 0);
  timer.fn(); assert.equal(h.calls(), 1);
  h.document.visibilityState = 'visible'; h.emit();
  assert.equal(h.calls(), 2);
  assert.equal(h.timers.size, 1);
  h.cleanup(); assert.equal(h.timers.size, 0);
});

test('existing disabled refresh safeguards create no timer or visibility fetch', () => {
  const h = harness(60_000, false);
  assert.equal(h.timers.size, 0);
  h.emit(); assert.equal(h.calls(), 0);
  h.cleanup();
});

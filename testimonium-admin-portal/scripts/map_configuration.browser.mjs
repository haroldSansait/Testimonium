// Local Chrome verification of the real page/provider/router/services with
// isolated persistence fixtures. This never uses Firebase or a live database.
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Satisfy Prisma construction with an unusable local URL; every persistence
// method called by this fixture is replaced before the server accepts traffic.
process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1:1/fixture';
process.env.SUPABASE_DATABASE_URL = process.env.DATABASE_URL;
const { createParishMapFixture } = await import('../../testimonium-backend/scripts/fixtures/parishMapFixture.js');

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = createParishMapFixture(mock);
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { MapConfigurationPage } from '@/pages/MapConfigurationPage';
import api from '@/api/api';
import L from 'leaflet';
import '@/index.css';
api.defaults.baseURL = '/';
window.flyCalls = [];
window.keyOwnerStacks = [];
const logError = console.error;
console.error = (...args) => {
  if (/same key|unique.*key/i.test(String(args[0]))) window.keyOwnerStacks.push(React.captureOwnerStack?.());
  logError(...args);
};
const flyTo = L.Map.prototype.flyTo;
L.Map.prototype.flyTo = function(...args) {
  window.fixtureMap = this;
  window.flyCalls.push(args.slice(0, 2));
  return flyTo.apply(this, args);
};
window.field = (label) => {
  const el = [...document.querySelectorAll('label')].find(el => el.textContent.trim() === label);
  return el?.parentElement.querySelector('input,textarea') || el?.parentElement.parentElement.querySelector('input');
};
window.setField = (label, value) => {
  const el = window.field(label);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
window.clickText = (text) => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === text)?.click();
window.selectParish = (name) => [...document.querySelectorAll('h4')].find(el => el.textContent === name).closest('button').click();
window.nudgeMarker = () => { window.fixtureMap.eachLayer(layer => {
  if (layer instanceof L.Marker && layer.getLatLng().lat < 10.415) {
    layer.setLatLng([10.415, 123.265]); layer.fire('dragend');
  }
}); };
createRoot(document.getElementById('root')).render(React.createElement(TooltipProvider, null, React.createElement(MapConfigurationPage)));
`;

let browser; let socket; let vite;
const profile = await mkdtemp(path.join(tmpdir(), 'testimonium-map-chrome-'));
const messages = [];
const pending = new Map();
let sequence = 0;
try {
  vite = await createServer({ root, configFile: false, plugins: [react(), {
    name: 'isolated-map-fixture',
    resolveId(id) { if (id === '/__map_fixture.tsx') return '\0map-fixture.tsx'; },
    load(id) { if (id === '\0map-fixture.tsx') return entry; },
    configureServer(server) {
      server.middlewares.use(fixture.app);
      server.middlewares.use(async (req, res, next) => {
        if (req.url.split('?')[0] !== '/__map_fixture') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml('/__map_fixture', '<html><body><div id="root"></div><script type="module" src="/__map_fixture.tsx"></script></body></html>'));
      });
    },
  }], resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 } });
  await vite.listen();
  const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1600,1000', 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
  browser.on('error', (error) => messages.push({ type: 'browser-error', text: error.message }));
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(100); }
  }
  assert.ok(port, 'Chrome must expose a local debugging port');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await once(socket, 'open');
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const handler = pending.get(message.id); pending.delete(message.id);
      if (message.error) handler?.reject(new Error(message.error.message)); else handler?.resolve(message.result);
    } else if (message.method === 'Runtime.consoleAPICalled') {
      messages.push({ type: message.params.type, text: message.params.args.map((arg) => arg.value ?? arg.description).join(' '), stack: message.params.stackTrace });
    } else if (message.method === 'Runtime.exceptionThrown') {
      messages.push({ type: 'exception', text: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
    throw new Error(`Timed out waiting for ${expression}. Browser state: ${await evaluate('JSON.stringify({ url: location.href, body: document.body.innerText.slice(0, 1500) })')}. Browser errors: ${JSON.stringify(messages.filter((m) => m.type === 'error' || m.type === 'exception'))}`);
  };
  await send('Runtime.enable'); await send('Page.enable');
  const url = `http://127.0.0.1:${vite.httpServer.address().port}/__map_fixture`;
  await send('Page.navigate', { url });
  await waitFor("window.fixtureMap && document.querySelector('textarea') && document.querySelectorAll('h4').length === 2");
  assert.equal(await evaluate("field('Directory Description').value"), 'Original description 1');
  const initialFlyCount = await evaluate('flyCalls.length');
  await evaluate("setField('Directory Description', 'Browser persisted description')");
  await evaluate("setField('Contact Number', '09987654321')");
  await evaluate("setField('Public Email', 'browser@example.test')");
  await evaluate("document.querySelector('[aria-label=\"Select Emerald pin color\"]').click()");
  await evaluate("[...document.querySelectorAll('label')].find(el => el.textContent === 'Show Pin Label').parentElement.parentElement.querySelector('button').click()");
  await delay(200);
  assert.equal(await evaluate('flyCalls.length'), initialFlyCount, 'Unrelated fields must not move map');
  await evaluate("setField('Map Zoom Level', '16')");
  await waitFor(`flyCalls.length > ${initialFlyCount}`);
  await evaluate('nudgeMarker()');
  await waitFor("field('Latitude').value === '10.415000'");
  await delay(150);
  const duplicateKeys = () => messages.filter((message) => /same key|unique.*key/i.test(message.text));
  if (process.argv.includes('--expect-key-warning')) {
    assert.ok(duplicateKeys().length, 'Expected reported duplicate-key warning to reproduce');
    const ownerStacks = await evaluate('keyOwnerStacks');
    assert.ok(ownerStacks.some((stack) => stack?.includes('ParishMarker')), 'Warning must be localized to the marker component');
    console.log(JSON.stringify({ result: 'REPRODUCED', ownerStacks, warnings: duplicateKeys().map(({ text }) => text) }, null, 2));
  } else {
    assert.deepEqual(duplicateKeys(), [], 'Marker animation children must have unique keys');
    await evaluate("clickText('Save All')");
    await waitFor("!window.hasUnsavedMapChanges && document.body.textContent.includes('saved successfully')");
    assert.equal(fixture.rows[0].directoryDescription, 'Browser persisted description');
    assert.equal(fixture.rows[0].contactNumber, '09987654321');
    assert.equal(fixture.rows[0].email, 'browser@example.test');
    assert.equal(fixture.rows[0].pinColor, '#10b981');
    assert.equal(fixture.rows[0].mapZoom, 16);
    assert.equal(fixture.rows[0].showLabel, false);
    assert.equal(fixture.rows[0].latitude, 10.415);
    assert.equal(fixture.rows[0].longitude, 123.265);
    await evaluate("selectParish('Map Fixture 2')");
    await waitFor("field('Directory Description').value === 'Original description 2'");
    await evaluate("selectParish('Map Fixture 1')");
    await waitFor("field('Directory Description').value === 'Browser persisted description'");
    await send('Page.reload');
    await waitFor("window.fixtureMap && document.querySelector('textarea')?.value === 'Browser persisted description'");
    const reloaded = await evaluate("({ description: field('Directory Description').value, contact: field('Contact Number').value, email: field('Public Email').value, latitude: field('Latitude').value, longitude: field('Longitude').value, zoom: field('Map Zoom Level').value })");
    assert.equal(reloaded.contact, '09987654321'); assert.equal(reloaded.email, 'browser@example.test');
    assert.equal(reloaded.latitude, '10.415000'); assert.equal(reloaded.longitude, '123.265000'); assert.equal(reloaded.zoom, '16');
    const marker = '[aria-label^="Map Fixture 1 church marker"]';
    assert.equal(await evaluate(`document.querySelector('${marker} svg path').getAttribute('fill')`), '#10b981');
    assert.equal(await evaluate(`[...document.querySelector('${marker}').querySelectorAll('div')].some(el => el.children.length === 0 && el.textContent === 'Map Fixture 1')`), false);
    await evaluate("clickText('All Vicariates')");
    await waitFor("document.querySelector('[role=option]')");
    await evaluate("[...document.querySelectorAll('[role=option]')].find(el => el.textContent.trim() === 'Vicariate of St. Vincent Ferrer').click()");
    await waitFor("document.querySelectorAll('h4').length === 0");
    await evaluate("clickText('Vicariate of St. Vincent Ferrer')");
    await evaluate("[...document.querySelectorAll('[role=option]')].find(el => el.textContent.trim() === 'All Vicariates').click()");
    await waitFor("document.querySelectorAll('h4').length === 2");
    const locateCount = await evaluate('flyCalls.length');
    await evaluate("clickText('Locate Selected')");
    await waitFor(`flyCalls.length > ${locateCount}`);
    const resetCount = await evaluate('flyCalls.length');
    await evaluate("clickText('Reset View')");
    await waitFor(`flyCalls.length > ${resetCount}`);
    fixture.failDirectories.add('1');
    await evaluate("setField('Directory Description', 'Retained after partial failure')");
    await evaluate("document.querySelector('[aria-label=\"Select Sky pin color\"]').click()");
    await evaluate("clickText('Save All')");
    await waitFor("document.body.textContent.includes('Partially saved')");
    assert.equal(await evaluate("field('Directory Description').value"), 'Retained after partial failure');
    assert.equal(fixture.rows[0].directoryDescription, 'Browser persisted description');
    assert.equal(fixture.rows[0].pinColor, '#0ea5e9');
    const batchesBeforeRetry = fixture.requests.filter((req) => req.path === '/map-config/batch').length;
    fixture.failDirectories.clear();
    await evaluate("clickText('Save All')");
    await waitFor('!window.hasUnsavedMapChanges');
    assert.equal(fixture.rows[0].directoryDescription, 'Retained after partial failure');
    assert.equal(fixture.requests.filter((req) => req.path === '/map-config/batch').length, batchesBeforeRetry);
    assert.deepEqual(duplicateKeys(), []);
    assert.deepEqual(messages.filter((message) => message.type === 'exception'), []);
    console.log(JSON.stringify({ result: 'PASS', scope: 'Chrome with real page/provider/router/services and isolated persistence fixtures',
      reloaded, verified: ['pinColor', 'showLabel', 'combined save', 'switch parish', 'refresh', 'All Vicariates', 'no unrelated flyTo', 'selection/zoom/coordinates/locate/reset flyTo', 'partial failure and retry', 'no duplicate-key warnings'] }, null, 2));
  }
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) { browser.kill(); await once(browser, 'exit').catch(() => {}); }
  await vite?.close(); fixture.restore(); mock.restoreAll();
  // Only remove the fresh directory created by this script under the OS temp root.
  assert.equal(path.dirname(profile), path.resolve(tmpdir()));
  assert.ok(path.basename(profile).startsWith('testimonium-map-chrome-'));
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

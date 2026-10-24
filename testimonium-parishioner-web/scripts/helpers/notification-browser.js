import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'vite';

export const chromePath = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(path => path && existsSync(path));

// CDP uses Node's built-in WebSocket; no browser automation dependency is needed.
export async function notificationBrowser() {
  const tempRoot = resolve(tmpdir());
  const profile = mkdtempSync(join(tempRoot, 'testimonium-notification-'));
  const root = resolve(import.meta.dirname, '../..');
  let chrome, socket, server;
  const close = async () => {
    if (chrome && chrome.exitCode === null) {
      const exited = once(chrome, 'exit');
      // Gracefully close this isolated profile and its child processes first.
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ id: 0, method: 'Browser.close' }));
      else chrome.kill();
      const forceExit = setTimeout(() => chrome.kill(), 5000);
      try { await exited; } finally { clearTimeout(forceExit); }
    }
    socket?.close();
    await server?.close();
    if (dirname(resolve(profile)) !== tempRoot || !basename(profile).startsWith('testimonium-notification-')) {
      throw new Error('Refusing to remove a browser profile outside the test temporary directory');
    }
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'error',
      server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
      plugins: [{ name: 'controlled-notification-boundaries', enforce: 'pre',
        resolveId(source) {
          if (/\/contexts\/AuthContext$/.test(source) || source === './AuthContext') return resolve(root, 'scripts/fixtures/notification-auth.tsx');
          if (/\/providers\/factory$/.test(source)) return resolve(root, 'scripts/fixtures/notification-service.js');
        },
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/dashboard/')) return next();
            const html = await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/notification-app.tsx"></script></body></html>');
            res.setHeader('Content-Type', 'text/html'); res.end(html);
          });
        },
      }],
    });
    await server.listen();
    const address = server.httpServer.address();
    const origin = `http://127.0.0.1:${address.port}`;
    chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', '--remote-allow-origins=*',
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-features=Translate', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true });
    let stderr = '';
    const endpoint = await new Promise((resolveEndpoint, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Chrome CDP startup timed out: ${stderr.slice(-1000)}`)), 60000);
      chrome.once('error', error => { clearTimeout(timeout); reject(error); });
      chrome.once('exit', code => { clearTimeout(timeout); reject(new Error(`Chrome exited during startup (${code}): ${stderr.slice(-1000)}`)); });
      chrome.stderr.on('data', data => {
        stderr += data;
        const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolveEndpoint(match[1]); }
      });
    });
    const url = new URL(endpoint);
    const targets = await fetch(`http://${url.host}/json/list`).then(response => response.json());
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await once(socket, 'open');
    let sequence = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
      if (!message.id) return;
      const request = pending.get(message.id); pending.delete(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolveCommand, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 60000);
      pending.set(id, { resolve: resolveCommand, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (expression, timeout = 15000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          if (await evaluate(expression)) return;
        } catch (error) {
          // Reload replaces the execution context between polling attempts.
          if (!/Inspected target navigated or closed|Execution context was destroyed|Cannot find context|uniqueContextId not found/.test(error.message)) throw error;
        }
        await new Promise(done => setTimeout(done, 40));
      }
      throw new Error(`Browser condition timed out: ${expression}\n${JSON.stringify(errors)}\n${await evaluate('document.body.innerText.slice(0, 3000)')}`);
    };
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${origin}/dashboard/home` });
    await waitFor('window.fixture?.notifications && window.fixture.calls >= 1');
    return { close, send, evaluate, waitFor, errors, origin };
  } catch (error) { await close(); throw error; }
}

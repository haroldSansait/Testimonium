// Run from the repository root: node testimonium-backend/scripts/generate_gmail_refresh_token.js
// Google desktop OAuth: https://developers.google.com/identity/protocols/oauth2/native-app
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { open, readFile, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';

const run = promisify(execFile);
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
// Covered by the repository's existing **/.env.* Git-ignore rule.
const tokenPath = fileURLToPath(new URL('../.env.gmail-oauth.local', import.meta.url));
const scope = 'https://www.googleapis.com/auth/gmail.send';
class SafeError extends Error {}

async function restrictWindowsAccess() {
    if (process.platform !== 'win32') return;
    const { stdout } = await run('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true });
    const sid = stdout.match(/S-1-\d+(?:-\d+)+/)?.[0];
    if (!sid) throw new SafeError('Could not determine the current Windows user for file permissions.');
    // The file is still empty here. Remove inherited access before writing any token.
    await run('icacls.exe', [tokenPath, '/inheritance:r', '/grant:r', `*${sid}:F`], { windowsHide: true });
}

async function openBrowser(url) {
    const options = { windowsHide: true, timeout: 10_000 };
    if (process.platform === 'win32') {
        await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            'Start-Process -FilePath $env:TESTIMONIUM_GMAIL_OAUTH_URL'], {
            ...options, env: { ...process.env, TESTIMONIUM_GMAIL_OAUTH_URL: url },
        });
    } else {
        await run(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], options);
    }
}

async function main() {
    // Parse the local backend file directly; never log its contents or change it.
    const { GMAIL_CLIENT_ID: clientId, GMAIL_CLIENT_SECRET: clientSecret } = dotenv.parse(await readFile(envPath));
    if (!clientId?.trim() || !clientSecret?.trim()) {
        throw new SafeError('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in testimonium-backend/.env first.');
    }

    // Exclusive creation prevents overwriting an existing refresh token, including on reruns.
    const file = await open(tokenPath, 'wx', 0o600).catch((error) => {
        if (error.code === 'EEXIST') {
            throw new SafeError('The token output file already exists. Copy it to your private .env, then remove it before rerunning.');
        }
        throw new SafeError('Could not create the local token output file.');
    });
    let saved = false;
    let server;
    let timer;
    try {
        await restrictWindowsAccess();
        const state = randomBytes(32).toString('base64url');
        const verifier = randomBytes(32).toString('base64url');
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        let finish;
        const callback = new Promise((resolve) => { finish = resolve; });
        let handled = false;
        let authorizationUrl;
        server = createServer((request, response) => {
            response.setHeader('Cache-Control', 'no-store');
            response.setHeader('Referrer-Policy', 'no-referrer');
            response.setHeader('Content-Type', 'text/plain; charset=utf-8');
            let url;
            try {
                url = new URL(request.url, 'http://127.0.0.1');
            } catch {
                response.writeHead(400).end('Invalid request.');
                return;
            }
            if (request.method === 'GET' && url.pathname === '/authorize' && !handled) {
                response.writeHead(302, { Location: authorizationUrl });
                response.end();
                return;
            }
            if (request.method !== 'GET' || url.pathname !== '/oauth2callback') {
                response.writeHead(404).end('Not found.');
                return;
            }
            if (handled || url.searchParams.get('state') !== state) {
                response.writeHead(400).end('Invalid or already used authorization callback.');
                return;
            }
            handled = true;
            const code = url.searchParams.get('code');
            const failed = url.searchParams.has('error') || !code;
            response.end(failed ? 'Authorization was not completed. Return to your terminal.'
                : 'Authorization received. Return to your terminal for the result. You can close this tab.');
            finish(failed ? null : code);
        });
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const origin = `http://127.0.0.1:${server.address().port}`;
        const redirectUri = `${origin}/oauth2callback`;
        authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authorizationUrl.search = new URLSearchParams({
            client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope,
            access_type: 'offline', prompt: 'consent', state,
            code_challenge: challenge, code_challenge_method: 'S256',
        }).toString();
        timer = setTimeout(() => finish(null), 10 * 60 * 1000);
        console.log('Sign in with the existing TESTIMONIUM Gmail sender account and approve Gmail send access.');
        console.log(`Opening your browser. If needed, open this local link: ${origin}/authorize`);
        try {
            await openBrowser(`${origin}/authorize`);
        } catch {
            console.log('Automatic browser launch failed. Open the local link above in your browser.');
        }
        const code = await callback;
        clearTimeout(timer);
        if (!code) throw new SafeError('Authorization was denied, incomplete, or timed out. Run the helper again.');

        // Never log the request, provider response, authorization code, or tokens.
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId, client_secret: clientSecret, code,
                code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code',
            }),
            signal: AbortSignal.timeout(30_000),
            redirect: 'error',
        });
        if (!response.ok) throw new SafeError(`Google token exchange failed (HTTP ${response.status}). No tokens were saved.`);
        const tokens = await response.json();
        if (typeof tokens.refresh_token !== 'string' || !/^[A-Za-z0-9._~+/-]+$/.test(tokens.refresh_token)) {
            throw new SafeError('Google did not return a usable refresh token. Run again and approve consent.');
        }
        if (tokens.scope && !tokens.scope.split(' ').includes(scope)) {
            throw new SafeError('Gmail send access was not granted. No tokens were saved.');
        }
        await file.writeFile(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`, 'utf8');
        await file.sync();
        saved = true;
        console.log('Saved refresh token to testimonium-backend/.env.gmail-oauth.local (Git-ignored, current-user access only).');
        console.log('Open that file privately and copy its GMAIL_REFRESH_TOKEN line into testimonium-backend/.env.');
        console.log('Replace an existing GMAIL_REFRESH_TOKEN line if present, then delete the temporary token file.');
    } finally {
        clearTimeout(timer);
        if (server?.listening) {
            server.close();
            server.closeAllConnections();
        }
        await file.close();
        if (!saved) await unlink(tokenPath);
    }
}

main().catch((error) => {
    // Raw errors can contain provider data. Only explicitly safe messages are printed.
    console.error(error instanceof SafeError ? error.message
        : 'Authorization failed. Check the local .env, file permissions, and connection, then retry. No secret details were logged.');
    process.exitCode = 1;
});

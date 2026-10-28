import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const srcDir = path.join(webRoot, 'src');

describe('Android v1.0.0 Release, Download Page, and R2 APK Delivery Integration', () => {
  test('Cloudflare Pages Function exists at functions/download/android.js and targets confirmed release', async () => {
    const fnPath = path.join(webRoot, 'functions/download/android.js');
    assert.ok(fs.existsSync(fnPath), 'functions/download/android.js must exist');
    const content = fs.readFileSync(fnPath, 'utf-8');

    assert.match(content, /TESTIMONIUM-v1\.0\.0-build5\.apk/, 'Must reference exact APK filename');
    assert.match(content, /APK_BUCKET/, 'Must use context.env.APK_BUCKET binding');
    assert.match(content, /application\/vnd\.android\.package-archive/, 'Must use official APK MIME type');
    assert.match(content, /attachment;\s*filename=/, 'Must set attachment Content-Disposition');
  });

  test('Cloudflare Pages Function logic handles GET, HEAD, 404, 405, 503, and Range streaming', async () => {
    const { onRequest } = await import(`file://${path.join(webRoot, 'functions/download/android.js').replace(/\\/g, '/')}`);

    // 1. Method Not Allowed (e.g. POST)
    const postRes = await onRequest({
      request: new Request('https://testimonium.site/download/android', { method: 'POST' }),
      env: { APK_BUCKET: {} }
    });
    assert.equal(postRes.status, 405);
    assert.equal(postRes.headers.get('Allow'), 'GET, HEAD');

    // 2. Storage Binding Unavailable (503)
    const noBindingRes = await onRequest({
      request: new Request('https://testimonium.site/download/android', { method: 'GET' }),
      env: {}
    });
    assert.equal(noBindingRes.status, 503);
    const noBindingJson = await noBindingRes.json();
    assert.equal(noBindingJson.error, 'STORAGE_BINDING_UNAVAILABLE');

    // Mock R2 object
    const mockFileBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK zip header
    const createMockStream = () => new ReadableStream({
      start(controller) {
        controller.enqueue(mockFileBytes);
        controller.close();
      }
    });

    const mockR2Bucket = {
      async head(key) {
        if (key !== 'TESTIMONIUM-v1.0.0-build5.apk') return null;
        return {
          key,
          size: 295000000,
          etag: 'mock-etag-12345',
          httpEtag: '"mock-etag-12345"',
          uploaded: new Date('2026-10-28T00:00:00Z'),
          writeHttpMetadata: () => {}
        };
      },
      async get(key, options) {
        if (key !== 'TESTIMONIUM-v1.0.0-build5.apk') return null;
        const rangeHeader = options?.range?.get ? options.range.get('range') : null;
        if (rangeHeader) {
          return {
            key,
            size: 295000000,
            etag: 'mock-etag-12345',
            httpEtag: '"mock-etag-12345"',
            uploaded: new Date('2026-10-28T00:00:00Z'),
            range: { offset: 0, length: 4 },
            body: createMockStream(),
            writeHttpMetadata: () => {}
          };
        }
        return {
          key,
          size: 295000000,
          etag: 'mock-etag-12345',
          httpEtag: '"mock-etag-12345"',
          uploaded: new Date('2026-10-28T00:00:00Z'),
          body: createMockStream(),
          writeHttpMetadata: () => {}
        };
      }
    };

    // 3. Object Not Found (404)
    const notFoundBucket = {
      async head() { return null; },
      async get() { return null; }
    };
    const notFoundRes = await onRequest({
      request: new Request('https://testimonium.site/download/android', { method: 'GET' }),
      env: { APK_BUCKET: notFoundBucket }
    });
    assert.equal(notFoundRes.status, 404);
    const notFoundJson = await notFoundRes.json();
    assert.equal(notFoundJson.error, 'RELEASE_NOT_FOUND');

    // 4. Successful GET download (200 with stream)
    const getRes = await onRequest({
      request: new Request('https://testimonium.site/download/android', { method: 'GET' }),
      env: { APK_BUCKET: mockR2Bucket }
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get('Content-Type'), 'application/vnd.android.package-archive');
    assert.equal(getRes.headers.get('Content-Disposition'), 'attachment; filename="TESTIMONIUM-v1.0.0-build5.apk"');
    assert.equal(getRes.headers.get('Content-Length'), '295000000');
    assert.equal(getRes.headers.get('ETag'), '"mock-etag-12345"');
    assert.ok(getRes.body, 'GET response must contain stream body');

    // 5. Successful Range GET download (206 with Content-Range)
    const rangeRes = await onRequest({
      request: new Request('https://testimonium.site/download/android', {
        method: 'GET',
        headers: { range: 'bytes=0-3' }
      }),
      env: { APK_BUCKET: mockR2Bucket }
    });
    assert.equal(rangeRes.status, 206);
    assert.equal(rangeRes.headers.get('Content-Range'), 'bytes 0-3/295000000');
    assert.equal(rangeRes.headers.get('Content-Length'), '4');

    // 6. Successful HEAD request (200 without body)
    const headRes = await onRequest({
      request: new Request('https://testimonium.site/download/android', { method: 'HEAD' }),
      env: { APK_BUCKET: mockR2Bucket }
    });
    assert.equal(headRes.status, 200);
    assert.equal(headRes.headers.get('Content-Type'), 'application/vnd.android.package-archive');
    assert.equal(headRes.headers.get('Content-Disposition'), 'attachment; filename="TESTIMONIUM-v1.0.0-build5.apk"');
    assert.equal(headRes.headers.get('Content-Length'), '295000000');
    assert.equal(headRes.body, null, 'HEAD response must have null body');
  });

  test('Cloudflare Pages _routes.json scopes Functions specifically to /download/android', () => {
    const publicRoutes = path.join(webRoot, 'public/_routes.json');
    const distRoutes = path.join(webRoot, 'dist/_routes.json');
    assert.ok(fs.existsSync(publicRoutes), 'public/_routes.json must exist');
    assert.ok(fs.existsSync(distRoutes), 'dist/_routes.json must exist in build output');

    const config = JSON.parse(fs.readFileSync(publicRoutes, 'utf-8'));
    assert.deepEqual(config.include, ['/download/android']);
    assert.deepEqual(config.exclude, []);
  });

  test('React Router registers /download as a public route in App.tsx', () => {
    const appPath = path.join(srcDir, 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');

    assert.match(content, /import DownloadPage from '\.\/pages\/public\/DownloadPage'/, 'App.tsx must import DownloadPage');
    assert.match(content, /<Route path="\/download" element=\{<PublicRoute element=\{<DownloadPage \/>\} \/>\} \/>/, '/download must be registered with PublicRoute');
  });

  test('DownloadQRCode encodes exactly https://testimonium.site/download/android', () => {
    const qrPath = path.join(srcDir, 'components/common/DownloadQRCode.tsx');
    assert.ok(fs.existsSync(qrPath), 'DownloadQRCode.tsx must exist');
    const content = fs.readFileSync(qrPath, 'utf-8');

    assert.match(content, /https:\/\/testimonium\.site\/download\/android/, 'Must encode direct APK download endpoint URL');
    assert.match(content, /qrcode\.react/, 'Must import from qrcode.react');
    assert.match(content, /QRCodeSVG/, 'Must render local SVG QR code');
  });

  test('DownloadPage.tsx contains required release specs, real download link, and install guide', () => {
    const pagePath = path.join(srcDir, 'pages/public/DownloadPage.tsx');
    assert.ok(fs.existsSync(pagePath), 'DownloadPage.tsx must exist');
    const content = fs.readFileSync(pagePath, 'utf-8');

    // Required Heading and description
    assert.match(content, /Download TESTIMONIUM for Android/, 'Must have primary heading');
    assert.match(content, /Official TESTIMONIUM Android application/, 'Must contain official description');

    // Real download link to /download/android
    assert.match(content, /href=\{APK_DOWNLOAD_URL\}|href="\/download\/android"/, 'Must link to /download/android');
    assert.match(content, /download=\{APK_FILENAME\}|download="TESTIMONIUM-v1\.0\.0-build5\.apk"/, 'Must trigger browser download of official APK');

    // Release details
    assert.match(content, /1\.0\.0/, 'Must mention version 1.0.0');
    assert.match(content, /Build 5|APP_BUILD = '5'/, 'Must mention build 5');
    assert.match(content, /com\.testimonium\.app/, 'Must mention package name');
    assert.match(content, /Android 8\.0/, 'Must mention Android 8.0 compatibility');

    // Installation guide
    assert.match(content, /Allow from this source/, 'Must instruct user to allow from this source');
    assert.doesNotMatch(content, /disable Play Protect/i, 'Must NOT instruct users to disable Play Protect');

    // QR Code in DownloadPage
    assert.match(content, /<DownloadQRCode/, 'DownloadPage must retain scannable QR code');
    assert.doesNotMatch(content, /Scan to Download on Phone/, 'DownloadPage must not contain redundant heading');
    assert.doesNotMatch(content, /Back to Home/, 'DownloadPage must not contain Back to Home button');
  });

  test('LandingPage.tsx features simplified Android download section with only Heading, Description, and Button', () => {
    const landingPath = path.join(srcDir, 'pages/public/LandingPage.tsx');
    const content = fs.readFileSync(landingPath, 'utf-8');

    // The 3 required elements
    assert.match(content, /Get TESTIMONIUM for Android/, 'Landing page must feature heading');
    assert.match(content, /Access diocesan sacramental registries, request baptismal and marriage certificates/, 'Landing page must feature description');
    assert.match(content, /navigate\('\/download'\)/, 'Landing page CTA button must navigate to /download');

    // Removed elements
    assert.doesNotMatch(content, /DownloadQRCode/, 'Landing page must NOT contain QR code');
    assert.doesNotMatch(content, /Android Platform • v1\.0\.0/, 'Landing page must NOT contain platform badge');
    assert.doesNotMatch(content, /Real-time status tracking/, 'Landing page must NOT contain feature badges');
  });

  test('PublicLayout.tsx includes Download App link in footer', () => {
    const layoutPath = path.join(srcDir, 'layouts/PublicLayout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf-8');

    assert.match(content, /to="\/download"/, 'Public footer must link to /download');
  });
});

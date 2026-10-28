/**
 * Cloudflare Pages Function: Public Android APK Download Endpoint
 * Route: /download/android
 *
 * Streams the official TESTIMONIUM Android release APK directly from Cloudflare R2
 * using the configured APK_BUCKET binding without buffering into memory.
 */

const APK_FILENAME = 'TESTIMONIUM-v1.0.0-build5.apk';
const APK_OBJECT_KEY = 'TESTIMONIUM-v1.0.0-build5.apk';
const APK_CONTENT_TYPE = 'application/vnd.android.package-archive';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'GET, HEAD',
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }

  const bucket = env?.APK_BUCKET;
  if (!bucket) {
    return new Response(
      JSON.stringify({
        error: 'STORAGE_BINDING_UNAVAILABLE',
        message: 'The APK_BUCKET storage binding is not configured on this Cloudflare Pages deployment.'
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const isHead = method === 'HEAD';

  try {
    const object = isHead
      ? await bucket.head(APK_OBJECT_KEY)
      : await bucket.get(APK_OBJECT_KEY, {
          range: request.headers
        });

    if (!object) {
      return new Response(
        JSON.stringify({
          error: 'RELEASE_NOT_FOUND',
          message: `The release object '${APK_OBJECT_KEY}' was not found in the storage bucket.`
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const headers = new Headers();

    if (typeof object.writeHttpMetadata === 'function') {
      object.writeHttpMetadata(headers);
    }

    headers.set('Content-Type', APK_CONTENT_TYPE);
    headers.set('Content-Disposition', `attachment; filename="${APK_FILENAME}"`);
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('Accept-Ranges', 'bytes');

    if (object.httpEtag) {
      headers.set('ETag', object.httpEtag);
    } else if (object.etag) {
      headers.set('ETag', `"${object.etag}"`);
    }

    if (object.uploaded) {
      headers.set('Last-Modified', object.uploaded.toUTCString());
    }

    let status = 200;
    if (object.range) {
      status = 206;
      const start = object.range.offset ?? 0;
      const end = object.range.length ? start + object.range.length - 1 : object.size - 1;
      headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
      headers.set('Content-Length', (object.range.length ?? object.size).toString());
    } else {
      headers.set('Content-Length', object.size.toString());
    }

    return new Response(isHead ? null : object.body, {
      status,
      headers
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'DOWNLOAD_FAILED',
        message: err instanceof Error ? err.message : 'Failed to retrieve release from storage.'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}

export const onRequestGet = onRequest;
export const onRequestHead = onRequest;

# Cloudflare R2 and OCR Pipeline

**Last reconciled:** 20 August 2026

TESTIMONIUM uses Cloudflare R2 through the S3-compatible AWS SDK. Browsers upload to the Express API; the API validates the file and writes to R2. R2 credentials are never exposed to either portal.

## Configuration

Set the following in `testimonium-backend/.env`:

```ini
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=testimonium-documents
R2_PUBLIC_URL=https://assets.example.org
```

The backend builds its S3 endpoint as `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, uses region `auto`, and returns URLs as `<R2_PUBLIC_URL>/<object-key>`. Therefore `R2_PUBLIC_URL` must be a configured public R2.dev endpoint or custom domain with the correct bucket origin.

## Current object-key layout

| Key pattern | Producer | Stored reference |
| --- | --- | --- |
| `documents/req_<requestId>/supporting/<timestamp>_<name>` | Supporting-file upload | `request_attachments.r2_object_key` |
| `documents/req_<requestId>/receipts/<timestamp>_<name>` | Receipt upload | `receipt_uploads.r2_object_key`, `document_requests.payment_proof_object_key` |
| `parishes/parish_<parishId>/cover/<uuid>_<name>` | Parish image service | `parishes.cover_image` public URL |
| `parishes/parish_<parishId>/logo/<uuid>_<name>` | Parish image service | `parishes.logo_image` public URL |
| Parish QR image path | Parish service | `parishes.payment_qr_image` public URL |

Object names are sanitized. Parish cover/logo writes use a UUID to prevent collisions and stale CDN cache. Replacing an attachment deletes the prior object after the new upload; a failed parish database update attempts to delete the new R2 object.

## Upload controls

| Flow | Accepted types | Limit | Field |
| --- | --- | --- | --- |
| Supporting documents | PDF, PNG, JPEG, WebP | 5 MB per file, five files | `files` |
| Payment receipt | JPEG, PNG | 5 MB, one file | `receipt` |
| Parish cover/logo | JPEG, PNG, WebP; magic-byte checked | 5 MB | `image` |
| Payment QR | Image upload | 2 MB | `qrImage` |

Receipt uploads reject HEIC/HEIF deliberately because the current OCR pipeline only accepts JPEG/PNG. The original receipt is preserved unchanged as evidence.

## Receipt OCR flow

1. The API validates request ownership and an eligible payment state.
2. It creates/reuses a pending payment transaction, uploads the original receipt to R2, records a SHA-256 image hash, and creates an `ocr_results` row with `PENDING` status.
3. The request moves to `PAYMENT_UNDER_REVIEW`; a history record and notifications are written.
4. Background processing downloads the R2 object, makes an in-memory OCR-optimized copy using Sharp, checks the process-local cache, calls the configured provider, and stores parsed metadata/confidences.
5. A matching hash against a verified receipt on another request is flagged for review. OCR does not automatically verify payment.

Set `OCR_PROVIDER=ocrspace` plus `OCR_SPACE_API_KEY` for OCR.Space, or use `stub` for development. `OCR_ENABLED=false` disables processing. OCR settings include timeout, max payload size, compression width/quality, retry count/delay, and cache TTL/max entries.

## CORS and access model

The shipped application does not perform direct browser-to-R2 uploads, so bucket CORS is not required for the upload path. CORS is not needed for a normal public image element. Configure it only if a portal fetches objects with JavaScript or uses them in a canvas; restrict those origins to the production portals and local development origins.

The backend calls `PutObject`, `GetObject`, and `DeleteObject`. Give its R2 token only object read/write permission on the application bucket. Use a separate token per environment and rotate it through deployment secrets.

Signed URL generation is intentionally not implemented in `R2Service`. If confidential documents cannot be public, introduce authenticated download/proxy or signed-URL support before making those assets accessible.

## Diagnostics

- **403 from R2:** verify account ID, token scope, bucket name, and the S3 endpoint—not the public URL.
- **Public URL returns 404:** verify `R2_PUBLIC_URL` maps to the bucket and that the stored key has no duplicated prefix.
- **Browser CORS error on an image:** configure R2/custom-domain response CORS for the portal origin.
- **OCR failure:** inspect backend structured logs and `ocr_results`; verify original receipt type/size and the OCR provider key. The stored receipt remains available for staff review.

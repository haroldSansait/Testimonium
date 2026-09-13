# Cloudflare R2 and OCR Pipeline

**Last reconciled:** 13 September 2026
**Source of truth:** `testimonium-backend/services/R2Service.js`, `ReceiptVerificationService.js`, `FileUploadService.js`, `ParishCouncilService.js`, `ParishService.js`, `utils/fileValidator.js`, and route controllers.

TESTIMONIUM uses Cloudflare R2 through the S3-compatible AWS SDK. Browsers and mobile apps upload files directly to the Express API; the API validates the file format, magic bytes, and size, then streams or writes the file to R2. Storage credentials and access keys are never exposed to web or mobile clients.

## Configuration

Set the following in `testimonium-backend/.env`:

```ini
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=testimonium-documents
R2_PUBLIC_URL=https://assets.example.org
```

The backend constructs its S3 endpoint as `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, uses region `auto`, and resolves public URLs as `<R2_PUBLIC_URL>/<object-key>`. `R2_PUBLIC_URL` must point to a configured Cloudflare custom domain or public R2.dev endpoint mapped to the bucket.

## Object-key layout

| Key pattern | Producer | Stored database reference |
| --- | --- | --- |
| `documents/req_<requestId>/supporting/<timestamp>_<name>` | Supporting-file upload | `request_attachments.r2_object_key` (category: `supporting`) |
| `documents/req_<requestId>/authorization_letter/<timestamp>_<name>` | Authorization letter upload | `request_attachments.r2_object_key` (category: `authorization_letter`) |
| `documents/req_<requestId>/receipts/<timestamp>_<name>` | Receipt upload | `receipt_uploads.r2_object_key`, `document_requests.payment_proof_object_key` |
| `parishes/parish_<parishId>/cover/<uuid>_<name>` | Parish image service | `parishes.cover_image` |
| `parishes/parish_<parishId>/logo/<uuid>_<name>` | Parish image service | `parishes.logo_image` |
| `parishes/parish_<parishId>/qr/<uuid>_<name>` | Parish payment QR service | `parishes.payment_qr_image` |
| `councils/parish_<parishId>/officers/<uuid>.<ext>` | Council officer photo service | `parish_council_members.photo_object_key`, `parish_council_members.photo_url` |

Object filenames are sanitized to prevent directory traversal or malformed characters. Parish cover, logo, QR, and council officer photo writes utilize UUID prefixes to prevent cache collisions across updates. When replacing attachments or photos, prior objects are pruned from R2 only after successful database commit.

## Upload controls and client handling

All uploads pass through `FileValidator` which performs strict binary magic-byte inspection (not relying on client MIME extensions alone):

| Flow | Accepted MIME types | Size limit | Multipart field | Client notes |
| --- | --- | --- | --- | --- |
| Supporting documents | PDF, PNG, JPEG, WebP | 5 MB per file, max 5 files | `files` | Document picker on web/mobile; multi-file validation. |
| Authorization letters | PDF, JPEG, PNG (magic-byte verified) | 5 MB, 1 file | `files` / `authorizationLetter` | Enforced by `FileValidator.validateAuthorizationLetter`; WebP is explicitly rejected. |
| Payment receipt | JPEG, PNG | 5 MB, 1 file | `receipt` | Rate-limited. Allocates atomic `attempt_version`; HEIC/HEIF rejected by backend (mobile converts HEIC to JPEG locally before upload). |
| Parish cover/logo | JPEG, PNG, WebP (magic-byte checked) | 5 MB | `image` | Admin portal coordinator actions. |
| Parish payment QR | JPEG, PNG, WebP (magic-byte checked) | 2 MB | `qrImage` | Admin portal staff settings. |
| Council officer photo | JPEG, PNG, WebP (magic-byte checked) | 2 MB | `photo` | Admin portal PPC/PFC member photo upload/replace. Public DTO exposes `photoUrl` only; `photoObjectKey` is strictly staff/internal. |

Receipt uploads intentionally reject HEIC/HEIF at the API boundary because the backend image optimization and OCR pipeline only accept standard JPEG and PNG inputs. The parishioner mobile app detects iOS HEIC images and converts them client-side into valid JPEG buffers prior to transmission.

## Secure file access and downloads

Confidential document attachments stored in R2 are not accessible through public URLs:
- Direct client access to private bucket objects is disabled.
- The backend provides authenticated streaming download endpoints:
  - `GET /api/v1/requests/:id/attachments/:attachmentId/download` for document request owners.
  - `GET /api/v1/document-requests/:id/attachments/:attachmentId/download` for authorized staff and coordinators.
- The Express server streams the object directly from R2 using `GetObjectCommand` with appropriate `Content-Disposition`, `Content-Type`, and security headers, preventing bucket credential or signed URL leakage.

## Receipt OCR and fraud-prevention pipeline

1. **Ownership and State Validation:** API validates request ownership and ensures the document request is in an eligible payment state (`PAYMENT_PENDING` or `PAYMENT_NEEDS_CORRECTION`).
2. **Persistence and Attempt Versioning:** The original receipt is uploaded to R2 at a unique timestamped key. In PostgreSQL, `ReceiptVerificationService` queries the latest `attemptVersion`, marks prior attempts as `is_superseded = true`, allocates `attemptVersion + 1`, and inserts a new `receipt_uploads` record alongside an initial `ocr_results` record in `PENDING` status.
3. **Workflow Transition:** The request state transitions to `PAYMENT_UNDER_REVIEW`, appending a new entry to `request_history` and dispatching in-app notifications.
4. **Asynchronous Enrichment:** A background task downloads the receipt object from R2, creates an in-memory OCR-optimized copy using Sharp, checks the in-memory cache, and dispatches the payload to the OCR provider (OCR.Space or configured engine).
5. **Deduplication and Fraud Flags:** If the computed SHA-256 hash matches a verified receipt on another request, the system flags the transaction with `is_duplicate = true` and links `duplicate_request_id` for staff inspection.
6. **Staff Authority:** OCR results (extracted amounts, reference numbers, and confidence scores) serve purely as decision-support evidence. Staff approval via the Admin Portal remains strictly required to transition a request to `PAYMENT_VERIFIED`.

## Provider configuration

- Set `OCR_PROVIDER=ocrspace` and provide `OCR_SPACE_API_KEY` for production OCR processing.
- Set `OCR_PROVIDER=stub` for local development.
- Set `OCR_ENABLED=false` to bypass OCR processing without breaking the upload flow.

## Access model and security

- Direct client-to-R2 uploads are prohibited; all traffic flows through the backend Express middleware.
- R2 API tokens granted to the backend require only `Object Read & Write` permissions scoped to the designated bucket.
- Signed URLs are intentionally not generated by `R2Service`. Private attachments are streamed via authenticated backend proxy endpoints.

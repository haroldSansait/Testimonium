# Cloudflare R2 and OCR Pipeline

**Last reconciled:** 3 October 2026
**Source of truth:** `testimonium-backend/services/R2Service.js`, `ReceiptVerificationService.js`, `GovernmentIdVerificationService.js`, `config/governmentIdVerification.js`, `FileUploadService.js`, `ParishCouncilService.js`, `ParishService.js`, `utils/fileValidator.js`, `utils/governmentIdImageValidator.js`, `utils/governmentIdOcrParser.js`, `utils/governmentIdNameMatcher.js`, and route controllers.

TESTIMONIUM uses Cloudflare R2 through the S3-compatible AWS SDK. Browsers and mobile apps upload files directly to the Express API; the API validates the file format, magic bytes, and size, then streams or writes the file to R2. Storage credentials and access keys are never exposed to web or mobile clients.

## Configuration

Set the following in `testimonium-backend/.env`:

```ini
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=testimonium-documents
R2_IDENTITY_BUCKET_NAME=testimonium-private-identity
R2_PUBLIC_URL=https://assets.example.org
```

The backend constructs its S3 endpoint as `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, uses region `auto`, and resolves public URLs as `<R2_PUBLIC_URL>/<object-key>`. `R2_PUBLIC_URL` must point to a configured Cloudflare custom domain or public R2.dev endpoint mapped only to `R2_BUCKET_NAME`. `R2_IDENTITY_BUCKET_NAME` must be a distinct bucket with neither an R2.dev public endpoint nor a public custom domain.

## Object-key layout

| Key pattern | Producer | Stored database reference |
| --- | --- | --- |
| `documents/req_<requestId>/supporting/<timestamp>_<name>` | Supporting-file upload | `request_attachments.r2_object_key` (category matches canonical requirement ID, e.g. `valid_id`, `baptismal_cert`, `confirmation_cert`, `marriage_license`, `precana_proof`, `cenomar`, `banns_clearance`, `canonical_interview`, or general `supporting`) |
| `documents/req_<requestId>/authorization_letter/<timestamp>_<name>` | Authorization letter upload | `request_attachments.r2_object_key` (category: `authorization_letter`) |
| `documents/req_<requestId>/receipts/<timestamp>_<name>` | Receipt upload | `receipt_uploads.r2_object_key`, `document_requests.payment_proof_object_key` |
| `parishes/parish_<parishId>/cover/<uuid>_<name>` | Parish image service | `parishes.cover_image` |
| `parishes/parish_<parishId>/logo/<uuid>_<name>` | Parish image service | `parishes.logo_image` |
| `parishes/parish_<parishId>/qr/<uuid>_<name>` | Parish payment QR service | `parishes.payment_qr_image` |
| `councils/parish_<parishId>/officers/<uuid>.<ext>` | Council officer photo service | `parish_council_members.photo_object_key`, `parish_council_members.photo_url` |
| `identity/user_<userId>/<front-or-back>/<uuid>.jpg` | Government ID verification service, in dedicated private identity bucket | `government_id_verifications.front_object_key`, `government_id_verifications.back_object_key` |

Object filenames are sanitized to prevent directory traversal or malformed characters. Parish cover, logo, QR, and council officer photo writes utilize UUID prefixes to prevent cache collisions across updates. When replacing attachments or photos, prior objects are pruned from R2 only after successful database commit.

## Upload controls and client handling

All uploads pass through `FileValidator` or `governmentIdImageValidator` which perform strict binary magic-byte inspection (not relying on client MIME extensions alone):

| Flow | Accepted MIME types | Size limit | Multipart field | Client notes |
| --- | --- | --- | --- | --- |
| Supporting documents | PDF, PNG, JPEG, WebP | 5 MB per file, max 5 files | `files` | Document picker on web/mobile; multi-file validation. Categorized by canonical requirement IDs. |
| Authorization letters | PDF, JPEG, PNG (magic-byte verified) | 5 MB, 1 file | `files` / `authorizationLetter` | Enforced by `FileValidator.validateAuthorizationLetter`; WebP is explicitly rejected. |
| Payment receipt | JPEG, PNG | 5 MB, 1 file | `receipt` | Rate-limited. Allocates atomic `attempt_version`; HEIC/HEIF rejected by backend (mobile converts HEIC to JPEG locally before upload). |
| Government ID (front & back) | JPEG, PNG, WebP (magic-byte checked) | 5 MB per file, 2 files | `front`, `back` | Rate-limited (default 6 attempts / 10m, configurable via `GOVERNMENT_ID_RATE_LIMIT_MAX`). Requires Laplacian variance sharpness >= 15 and distinct SHA-256 hashes. Stored only in private identity bucket. Normalized to JPEG. |
| Parish cover/logo | JPEG, PNG, WebP (magic-byte checked) | 5 MB | `image` | Admin portal coordinator actions. |
| Parish payment QR | JPEG, PNG, WebP (magic-byte checked) | 2 MB | `qrImage` | Admin portal staff settings. |
| Council officer photo | JPEG, PNG, WebP (magic-byte checked) | 2 MB | `photo` | Admin portal PPC/PFC member photo upload/replace. Public DTO exposes `photoUrl` only; `photoObjectKey` is strictly staff/internal. |

Receipt uploads intentionally reject HEIC/HEIF at the API boundary because the backend image optimization and OCR pipeline only accept standard JPEG and PNG inputs. The parishioner mobile app detects iOS HEIC images and converts them client-side into valid JPEG buffers prior to transmission.

## Secure file access and downloads

Government ID images are always written to `R2_IDENTITY_BUCKET_NAME`. The service fails closed if that bucket is missing or equals the public asset bucket:
- Only Diocese Coordinators can retrieve these images, through authenticated `private, no-store` backend streaming routes:
  - `GET /api/v1/users/:id/identity/front-image`
  - `GET /api/v1/users/:id/identity/back-image`
- If an image object is missing from storage, the streaming endpoint returns `404 IDENTITY_IMAGE_NOT_FOUND`. If the R2 storage client encounters network or authentication failures, it returns `503 IDENTITY_STORAGE_UNAVAILABLE`.
- Direct URLs, public bucket links, and object keys are never exposed to clients.
- If a user materially changes their legal profile name, existing verified images are pruned and verification state is invalidated.

Confidential document attachments stored in R2 are not accessible through public URLs:
- Direct client access to private bucket objects is disabled.
- The backend provides authenticated streaming download endpoints:
  - `GET /api/v1/requests/:id/attachments/:attachmentId/download` for document request owners.
  - `GET /api/v1/document-requests/:id/attachments/:attachmentId/download` for authorized staff and coordinators (including parish-assigned Priests for parish-scoped read-only document review).
- The Express server streams the object directly from R2 using `GetObjectCommand` with appropriate `Content-Disposition`, `Content-Type`, and security headers, preventing bucket credential or signed URL leakage.

## Receipt OCR and fraud-prevention pipeline

1. **Ownership and State Validation:** API validates request ownership and ensures the document request is in an eligible payment state (`PAYMENT_PENDING` or `PAYMENT_NEEDS_CORRECTION`).
2. **Persistence and Attempt Versioning:** The original receipt is uploaded to R2 at a unique timestamped key. In PostgreSQL, `ReceiptVerificationService` queries the latest `attemptVersion`, marks prior attempts as `is_superseded = true`, allocates `attemptVersion + 1`, and inserts a new `receipt_uploads` record alongside an initial `ocr_results` record in `PENDING` status.
3. **Workflow Transition:** The request state transitions to `PAYMENT_UNDER_REVIEW`, appending a new entry to `request_history` and dispatching in-app notifications.
4. **Asynchronous Enrichment:** A background task downloads the receipt object from R2, creates an in-memory OCR-optimized copy using Sharp, checks the in-memory cache, and dispatches the payload to the OCR provider (OCR.Space or configured engine).
5. **Deduplication and Fraud Flags:** If the computed SHA-256 hash matches a verified receipt on another request, the system flags the transaction with `is_duplicate = true` and links `duplicate_request_id` for staff inspection.
6. **Staff Authority:** OCR results (extracted amounts, reference numbers, and confidence scores) serve purely as decision-support evidence. Staff approval via the Admin Portal remains strictly required to transition a request to `PAYMENT_VERIFIED`.

## Government ID OCR verification pipeline

Unlike receipt OCR (which is asynchronous and decision-support only), Government ID verification is an authoritative, synchronous pipeline executed during `POST /api/v1/identity-verification/submit`:

1. **Concurrency Control:** Acquires a distributed database lease via `SystemLeaseService` (`GOVERNMENT_ID_VERIFICATION:<userId>`, 120s TTL) to prevent race conditions from duplicate clicks or parallel submissions. Single-flight attempt tracking on clients prevents race conditions from overlapping responses.
2. **Image Integrity & Sharpness:**
   - Evaluates SHA-256 binary hashes of front and back images to guarantee they are distinct files (`FRONT_BACK_INCOMPLETE` on identical images).
   - Validates minimum dimensions (1000x600 px) and computes Laplacian variance via Sharp to reject blurry images below threshold (`sharpnessThreshold` default 15; rejection code `IMAGE_BLURRY`).
3. **Concurrent OCR Processing:** Compresses both images in memory and submits them concurrently to OCR.Space. A real OCR provider is strictly enforced (the stub provider cannot verify Government IDs).
4. **Card Type Identification & Side Orientation Diagnostics:**
   - Matches front and back OCR text tokens against hierarchical multi-marker patterns with strength levels (`STRONG`, `SUPPORTING`, `SHARED`) for supported Philippine IDs (`PHIL_SYS`, `DRIVERS_LICENSE`, `UMID`, `VOTER_ID`, `POSTAL_ID`). Unsupported documents (Passports, student IDs, company IDs) are rejected with `UNSUPPORTED_OR_INVALID_DOCUMENT`.
   - Executes side classification (`classifyGovernmentIdSide` and `getGovernmentIdSideIssue`) to identify misoriented uploads: `FRONT_IS_BACK`, `BACK_IS_FRONT`, `BOTH_APPEAR_FRONT`, `BOTH_APPEAR_BACK`, or `SIDES_SWAPPED`. Clients translate these into targeted retake instructions (`front`, `back`, or `both`).
5. **Name Matching:** Executes fuzzy token-order matching and Levenshtein distance calculations (`matchProfileNameToIdText`) comparing the applicant's legal profile name against OCR-extracted card text tokens. Discrepancies return `NAME_MISMATCH`.
6. **Expiration Check:** For expiring cards (Driver's License, Postal ID), extracts date tokens and verifies against the current date. Expired cards return `ID_EXPIRED`.
7. **Storage & Auto-Fulfillment:** On verification success, front and back images are normalized via Sharp (`normalizeForR2Storage` to standardized high-quality JPEG) and stored in `R2_IDENTITY_BUCKET_NAME`. The user's verification record is marked `VERIFIED`. Best-effort cleanup deletes prior R2 objects if replacing an existing verification. An effective verified Government ID automatically satisfies the `valid_id` requirement across all subsequent document requests.
8. **Automated Invalidation:** If a user materially modifies their legal `fullName` in their profile, `UserService` and `AuthController` automatically invalidate the verification record and purge old images under lease lock.

## Provider configuration

- Set `OCR_PROVIDER=ocrspace` and provide `OCR_SPACE_API_KEY` for production OCR processing.
- Set `OCR_PROVIDER=stub` for local development (note: stub is permitted for receipts but explicitly blocked for Government ID verification).
- Set `OCR_ENABLED=false` to bypass OCR processing without breaking the upload flow.

## Access model and security

- Direct client-to-R2 uploads are prohibited; all traffic flows through the backend Express middleware.
- R2 API tokens granted to the backend require only `Object Read & Write` permissions scoped to designated buckets.
- Public assets bucket (`R2_BUCKET_NAME`) and private identity bucket (`R2_IDENTITY_BUCKET_NAME`) must be separate buckets.
- `R2Service` exposes `exists(key, { bucketName })` using lightweight `HeadObjectCommand` checks for existence validation without payload download overhead.
- Signed URLs are intentionally not generated by `R2Service`. Private attachments and identity cards are streamed via authenticated backend proxy endpoints.

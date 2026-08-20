# TESTIMONIUM Parishioner Mobile — Uploads, Payments & Media

## 1. Existing storage model

TESTIMONIUM uploads flow through the Express API to Cloudflare R2.

```text
Mobile
-> Express multipart endpoint
-> backend validation
-> R2
-> database object key/reference
```

R2 credentials never belong in the mobile app.

## 2. Current upload limits

### Supporting documents
- PDF
- PNG
- JPEG
- WebP
- max 5 MB each
- up to five files
- field: `files`

### Payment receipt
- JPEG
- PNG
- max 5 MB
- one file
- field: `receipt`

### Important iOS issue
HEIC/HEIF is deliberately rejected for receipts by the current backend/OCR pipeline.

Mobile implementation must explicitly handle iPhone photo/camera output that may be HEIC/HEIF.

## 3. Media acquisition architecture

Create a media service abstraction rather than embedding picker logic into every screen.

Conceptual APIs:

```ts
pickSupportingFiles()
captureReceipt()
pickReceiptFromLibrary()
normalizeReceiptForUpload()
getFileMetadata()
```

Use the packages already compatible with the existing Expo scaffold when possible.

## 4. File metadata model

Normalize selected media into a common client object:

```ts
type UploadCandidate = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  source: 'camera' | 'library' | 'files';
  transformed?: boolean;
};
```

Do not treat client MIME/name as security validation. Backend verifies final upload.

## 5. Receipt HEIC strategy

Preferred behavior:
1. inspect selected/captured format;
2. if JPEG/PNG and <=5 MB, upload without unnecessary transformation;
3. if HEIC/HEIF, convert locally to JPEG using an Expo-compatible image processing path;
4. show a transparent message only if conversion fails or quality must be reduced;
5. ensure converted result <=5 MB;
6. upload resulting JPEG.

Document this behavior because the backend will preserve the uploaded JPEG as the evidence object; it is no longer byte-identical to the original HEIC source.

Do not silently use lossy compression at extreme quality.

## 6. Oversized receipt

If supported type >5 MB:
- attempt moderate resize/compression only if product approves;
- preserve legibility of reference number, amount, date, provider;
- show preview before upload;
- fail with clear message if still too large.

Do not crop automatically.

## 7. Supporting PDFs

For PDFs:
- use document picker;
- do not attempt image compression;
- validate size;
- show filename/type/size.

If preview is not available natively, do not block upload solely because preview cannot render.

## 8. Temporary file cleanup

If app generates converted/compressed copies:
- keep only while needed;
- clean after successful upload/cancel where feasible;
- do not write receipt to public photo gallery automatically.

## 9. Multipart upload

Centralize multipart construction.

Do not:
- base64 large files into JSON;
- embed credentials;
- change backend field names.

Support cancellation where possible.

If true byte progress is not available:
- show indeterminate upload status.

Never fake 20% → 80% progress.

## 10. Duplicate submission protection

Receipt upload:
- one active upload mutation per request;
- disable upload button during mutation;
- avoid automatic mutation retry;
- after timeout/ambiguous failure, refetch request state before allowing another upload.

Backend SHA-256 duplicate detection remains authoritative.

## 11. OCR truth model

Current backend:
1. validates owner/state;
2. stores receipt;
3. records image hash;
4. creates OCR pending record;
5. transitions request to `PAYMENT_UNDER_REVIEW`;
6. processes OCR asynchronously;
7. flags duplicates for staff;
8. does not automatically verify payment.

Mobile copy must reflect this.

Use:
- "Receipt submitted for review."
- "Payment proof is being reviewed."

Do not use:
- "AI verified your payment."
- "OCR confirmed payment."
unless backend workflow later changes.

## 12. Payment configuration

Use `GET /payment/configuration`.

Do not hardcode:
- provider names;
- account numbers;
- QR availability;
- payment instructions
when backend/config provides them.

If config is absent:
- show a safe unavailable state;
- do not invent GCash/Maya details.

## 13. Amount

For an existing request, display the authoritative fee snapshot/request payment amount.

Do not recalculate using current parish settings after the request already has a snapshot.

## 14. QR UX

Recommended:
- large readable QR;
- tap to enlarge;
- high-contrast background;
- prevent layout clipping;
- optional save/share only if product explicitly approves.

Do not assume user has a second device. Provide textual payment details if backend config supplies them.

## 15. Image privacy

Current R2 references may be public URLs.

Mobile should:
- not log them;
- not expose share controls for private receipt/supporting files unless explicitly approved;
- avoid copying URLs to clipboard;
- avoid prefetching confidential media unnecessarily.

Longer-term confidential download should use authenticated proxy/signed URL backend support.

## 16. Camera permissions

Ask camera permission only when user chooses Camera.

Ask photo permission only when necessary for library access.

Provide fallback:
- Camera denied → choose library/files.
- Library denied → camera/files where applicable.

Do not request all media permissions at startup.

## 17. Upload error mapping

Examples:

### Unsupported type
"Choose a PDF, PNG, JPEG, or WebP file."

### Receipt HEIC conversion failure
"This photo format can't be prepared for upload. Choose another image or take a new photo."

### 413
"This file is larger than the 5 MB limit."

### Network timeout
"Upload couldn't be confirmed. Check the request before trying again."

### 429
"Too many upload attempts. Please wait and try again."

## 18. File review before submit

Show:
- thumbnail/icon;
- filename;
- size;
- remove/replace.

Receipt:
- image preview;
- "Make sure the amount, date, and reference number are readable."

This is user guidance, not OCR promise.

## 19. R2 object-key rules

Mobile should never construct R2 object keys.

Backend currently controls layouts such as request supporting/receipt folders. Treat returned URLs/keys as opaque references.

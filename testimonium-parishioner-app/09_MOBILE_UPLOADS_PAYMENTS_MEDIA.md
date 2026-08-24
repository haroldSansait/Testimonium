# TESTIMONIUM Parishioner Mobile — Uploads, Payments & Media

**Last reconciled:** 24 August 2026
**Status:** Media acquisition, HEIC conversion, and payment workflows fully implemented.

## 1. Storage and upload architecture

All mobile uploads flow directly through the TESTIMONIUM Express API to Cloudflare R2:

```text
Mobile Client (Camera / Gallery / File Picker)
      │
      │ 1. Validate MIME & Size (Advisory)
      │ 2. Convert HEIC -> JPEG (If iOS receipt image)
      │ 3. Multipart Form-Data Request (Bearer Token)
      ▼
Express API (/api/v1/requests/:id/files OR /receipt)
      │
      ├──> Enforce MIME magic-bytes & 5 MB size limit
      ├──> Stream upload to Cloudflare R2
      ├──> Compute SHA-256 hash (Receipts)
      └──> Insert Prisma DB records (RequestAttachment / ReceiptUpload / OcrResult)
```

No Cloudflare R2 access keys or credentials exist within the mobile application bundle.

## 2. File constraints and types

| Purpose | Accepted MIME Types | Max Size | Max Files | Endpoint & Field |
| :--- | :--- | :--- | :--- | :--- |
| **Supporting Docs** | PDF, PNG, JPEG, WebP | 5 MB / file | 5 files | `POST /requests/:id/files` (`files`) |
| **Payment Receipt** | JPEG, PNG | 5 MB | 1 file | `POST /requests/:id/receipt` (`receipt`) |

## 3. Media service and HEIC handling

- **Abstraction (`src/services/media/mediaService.ts`):** Exposes `pickSupportingFiles()`, `captureReceiptImage()`, and `pickReceiptImageFromLibrary()`.
- **iOS HEIC Conversion:** Since the backend OCR pipeline rejects HEIC/HEIF images, `src/services/media/heicConverter.ts` detects HEIC inputs on iOS and converts them to standard JPEG with 85% compression quality before constructing the multipart upload payload.
- **Temporary File Cleanup:** Converted images stored in temporary app cache are scheduled for deletion upon upload completion or wizard cancellation.

## 4. Payment flow and QR display

1. **Configuration Resolution:** Fetch payment configuration via `GET /payment/configuration`.
2. **Fee Display:** Displays authoritative fee snapshot recorded on the document request.
3. **Interactive QR Card:**
   - Renders parish payment QR code with high contrast.
   - Tap-to-enlarge modal allows parishioners to pinch-and-zoom or save QR details.
   - Displays clear text instructions (GCash/Maya merchant name, account number) for parishioners using a single phone.
4. **Receipt Submission:** Parishioner selects/captures receipt, reviews file size/preview, and submits.
5. **Double-Submit Protection:** The upload button locks with an accessible loading indicator during submission.

## 5. OCR truth model and copy

- OCR processing runs asynchronously on the backend to extract reference numbers, amounts, and detect duplicate receipts.
- Mobile UI strictly displays **"Payment Proof Under Review"** and **"Submitted for staff review"**.
- The app never displays "Payment Verified" or "Approved by AI" based solely on client submission or OCR output. Staff verification remains mandatory.

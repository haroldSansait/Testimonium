# TESTIMONIUM OCR Integration Phase
## OCR.space Integration, Dual-Stream Processing & Hybrid Compression Architecture

**Phase Goal:** Introduce production-grade OCR-assisted payment receipt verification using OCR.space while preserving the current TESTIMONIUM architecture, maintaining backward compatibility, and ensuring that OCR only assists secretaries instead of replacing manual verification.

---

# Objectives

The primary objectives of this phase are:

- Integrate OCR.space into the existing Receipt Verification workflow.
- Preserve original receipt quality for evidence and future reference.
- Automatically extract receipt information to assist secretaries.
- Keep all payment approvals under manual secretary review.
- Maintain architecture scalability so OCR providers can easily be replaced in the future.
- Reduce OCR failures caused by large camera images through automatic compression.
- Preserve existing workflows without breaking current payment verification logic.

---

# High-Level Goals

## Goal 1 — Production OCR Integration

Replace the current Stub OCR implementation with a real OCR provider using OCR.space while preserving the provider abstraction.

Current:

```
ReceiptVerificationService
            │
            ▼
     StubOCRProvider
```

Target:

```
ReceiptVerificationService
            │
            ▼
       OCRProvider
      /          \
StubOCRProvider   OCRSpaceProvider
```

Future expansion:

```
ReceiptVerificationService
            │
            ▼
       OCRProvider
      /     |      \
 Stub   OCR.space  Google Vision
                     Azure AI
```

This ensures future OCR providers can be swapped without modifying business logic.

---

## Goal 2 — Preserve Original Evidence

The uploaded payment receipt serves as legal/payment evidence.

**The original file should NEVER be compressed before storage.**

Instead:

- Upload the original file directly to Cloudflare R2.
- Store the original metadata.
- Display the original file inside the Secretary Portal.

Benefits:

- Maximum image quality
- Future OCR improvements possible
- Secretary can zoom in
- Better audit trail

---

## Goal 3 — OCR Should Assist, Not Decide

TESTIMONIUM is **not** an accounting system.

OCR exists only to assist secretaries.

It should NEVER automatically approve payments.

Instead:

```
Upload Receipt
        │
        ▼
OCR Extraction
        │
        ▼
Extract Receipt Information
        │
        ▼
Secretary Review
        │
        ▼
Approve / Reject
```

Even if OCR confidence is 100%, manual review remains required.

---

# Architecture

## Dual-Stream Processing

This will become the standard processing pipeline.

```
                 Parishioner Upload
                        │
                        ▼
                 Express Backend
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
 Original Image                Compressed Copy
 (Cloudflare R2)                  (Sharp)
          │                           │
          ▼                           ▼
 Secretary View               OCR.space API
          │                           │
          │                    Extract Receipt
          │                           │
          └──────────────┬────────────┘
                         ▼
              ReceiptVerificationService
                         │
                         ▼
               Secretary Manual Review
```

---

# Why Dual-Stream?

Advantages:

✅ Secretary always sees original quality.

✅ OCR always receives an optimized image.

✅ No unnecessary bandwidth between OCR and backend.

✅ Future OCR providers can reuse the compressed stream.

---

# Backend Compression Strategy

Backend compression is the primary compression mechanism.

The backend is responsible for:

- resizing
- optimizing
- compressing
- ensuring OCR.space upload limits

This guarantees identical behavior regardless of client platform.

---

## Compression Pipeline

Recommended Sharp pipeline:

```
Original Image
        │
        ▼
Auto Rotate (EXIF)
        │
        ▼
Resize
(max width = 1200 px)
        │
        ▼
Normalize
        │
        ▼
Sharpen
        │
        ▼
JPEG Quality = 80
        │
        ▼
Check Size
        │
        ▼
< 900 KB ?
```

---

## Adaptive Compression

If image exceeds OCR.space's 1 MB limit:

```
Quality 80
      │
      ▼
Still >1MB?
      │
      ▼
Quality 70
      │
      ▼
Still >1MB?
      │
      ▼
Quality 60
      │
      ▼
Still >1MB?
      │
      ▼
Resize 1000 px
```

Target:

```
<= 900 KB
```

to leave a safety margin.

---

# Hybrid Frontend Compression

Frontend compression is OPTIONAL.

It exists purely to reduce upload bandwidth.

Backend compression remains mandatory.

---

## React Web

Use:

```
browser-image-compression
```

Recommended:

- Max Size: 0.8 MB
- Max Width: 1600 px

Benefits:

- Faster uploads
- Less server bandwidth
- Better user experience

---

## React Native / Expo (Future)

Use:

```
expo-image-manipulator
```

Recommended:

- Width: 1080 px
- Quality: 0.6

---

## Important

Even if frontend compression exists:

The backend MUST still compress again before OCR.

Never trust client-side processing.

---

# OCR Provider Layer

Create a new abstraction.

```
OCRProvider
```

Methods:

```
analyzeReceipt(buffer)
```

Providers:

```
StubOCRProvider

OCRSpaceProvider

Future:
GoogleVisionProvider

AzureDocumentAIProvider

PaddleOCRProvider
```

Provider selected using:

```
OCR_PROVIDER=ocrspace
```

---

# Environment Variables

```
OCR_PROVIDER=ocrspace

OCR_SPACE_API_KEY=xxxxxxxx

OCR_TIMEOUT=15000

OCR_MAX_SIZE_KB=900

OCR_COMPRESSION_WIDTH=1200

OCR_COMPRESSION_QUALITY=80
```

---

# OCR.space Integration

Workflow:

```
Compressed Buffer
        │
        ▼
OCR.space
        │
        ▼
JSON Response
        │
        ▼
ReceiptVerificationService
```

---

# OCR Extraction Goals

Extract:

- Merchant
- Payment Platform
- Amount
- Date
- Time
- Reference Number

Optional:

- Account Name
- Account Number (masked)
- Sender Name

---

# Confidence Calculation

Instead of trusting OCR directly:

Calculate confidence.

Example:

| Field | Found |
|--------|------|
| Merchant | ✅ |
| Amount | ✅ |
| Date | ✅ |
| Reference | ✅ |

Confidence:

```
96%
```

Displayed to secretary only.

---

# Secretary OCR Summary

Example UI:

```
OCR Summary

Merchant:
GCash

Reference:
123456789012

Amount:
₱500.00

Date:
July 31, 2026

Confidence:
96%
```

This assists manual review.

---

# Error Handling

OCR failures should NEVER block uploads.

Workflow:

```
Upload Receipt
        │
        ▼
Save Original
        │
        ▼
Try OCR
      /     \
Success    Failure
   │          │
   ▼          ▼
Save OCR   Log Error
Results
      │
      ▼
PAYMENT_UNDER_REVIEW
```

---

# Timeout Handling

OCR timeout:

```
10–15 seconds
```

If timeout:

- Continue workflow
- Mark OCR unavailable
- Manual review only

---

# Security Considerations

## API Key

The OCR API key:

- Backend only
- Never exposed to frontend
- Loaded from `.env`

---

## Input Validation

Accept only:

- JPEG
- PNG

Reject:

- PDFs (unless later supported)
- GIF
- SVG

---

## File Size Validation

Maximum upload:

Current system limit.

Maximum OCR upload:

900 KB after compression.

---

## Rate Limiting

Future recommendation:

Rate limit OCR requests to prevent abuse.

---

# Logging

Log:

- OCR Provider
- OCR Duration
- Compression Duration
- Original File Size
- Compressed File Size
- OCR Success
- OCR Failure Reason

---

# Performance Targets

Compression:

```
<100 ms
```

OCR API:

```
2–5 seconds
```

Total upload:

```
<8 seconds
```

---

# Backward Compatibility

The following remain unchanged:

- Payment workflow
- Secretary approval
- Cloudflare R2 storage
- Receipt upload API
- Request State Machine
- Payment statuses
- Notifications

Only the OCR provider changes.

---

# Implementation Phases

## Phase 1

Backend foundation

- OCRProvider abstraction
- OCRSpaceProvider
- Sharp compression
- Environment variables

---

## Phase 2

ReceiptVerificationService

- Dual-stream processing
- OCR integration
- OCR result mapping

---

## Phase 3

Secretary Portal

- OCR Summary
- Confidence display
- Receipt metadata

---

## Phase 4

Frontend Optimization

- Optional browser-image-compression
- Optional Expo image compression

---

## Phase 5

Testing

Test:

- Small screenshots
- Large camera photos
- Dark photos
- Blurry photos
- OCR timeout
- OCR failure
- Network loss

---

# Success Criteria

The implementation is considered complete when:

- Original images are always preserved in Cloudflare R2.
- OCR receives a compressed image below OCR.space limits.
- OCR successfully extracts receipt metadata.
- OCR failures never block uploads.
- Secretaries receive OCR summaries to assist manual verification.
- Manual secretary approval remains mandatory.
- The OCR provider is fully replaceable through the provider abstraction.
- Frontend compression functions as an optional optimization without becoming a dependency.
- The entire workflow builds successfully without breaking existing payment or document request functionality.

---

# Final Architecture

```
                 Parishioner
                      │
                      ▼
              Upload Original Receipt
                      │
                      ▼
               Express Backend
                      │
      ┌───────────────┴────────────────┐
      ▼                                ▼
Cloudflare R2                  Sharp Compression
Original Image                      │
      │                             ▼
      │                      OCR.space API
      │                             │
      └──────────────┬──────────────┘
                     ▼
          ReceiptVerificationService
                     │
             OCR Summary Generated
                     │
                     ▼
          Secretary Manual Review
                     │
             Approve / Reject
```

This architecture is scalable, provider-agnostic, bandwidth-efficient, preserves evidence quality, and aligns with the existing TESTIMONIUM architecture without introducing breaking changes.
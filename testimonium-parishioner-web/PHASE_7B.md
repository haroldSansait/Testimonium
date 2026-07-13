# TESTIMONIUM Parishioner Web Portal — Phase 7B
# Backend Integration, Document Processing Pipeline & Transaction Engine

---

# Objective

Phase 7B transitions the Parishioner Portal from a demonstration frontend into a fully functional production client connected to the TESTIMONIUM Backend.

This phase focuses on replacing all demo providers with real backend integrations while establishing a secure, scalable, and maintainable backend architecture for document processing, cloud storage, transaction workflows, payment verification, and OCR automation.

Unlike previous phases that emphasized UI and frontend architecture, Phase 7B establishes the application's operational backbone.

---

# Primary Goals

- Replace Demo Provider architecture with live Backend API integrations.
- Implement authenticated document submission workflows.
- Stream uploaded files securely into Cloudflare R2.
- Record transactional data inside Supabase.
- Introduce a robust request lifecycle state machine.
- Build defensive upload validation layers.
- Integrate OCR-ready payment receipt verification.
- Preserve the existing Demo/API/Hybrid provider architecture.

---

# Architectural Principles

Throughout Phase 7B the following principles must remain unchanged.

## Preserve Provider Architecture

The Parishioner Portal must continue supporting:

- Demo Mode
- API Mode
- Hybrid Mode

Pages must **never** communicate directly with backend endpoints.

Instead they continue calling:

```
services.request
services.profile
services.parish
services.scheduler
services.notification
services.event
services.chat
```

Only the API Providers should communicate with Express backend endpoints.

---

# Existing Authentication

Continue using Firebase Authentication.

The backend should trust authenticated Firebase ID Tokens.

Every protected endpoint must:

1. Verify Firebase ID Token
2. Extract Firebase UID
3. Resolve TESTIMONIUM User
4. Resolve Parishioner Profile
5. Continue processing

The frontend must never submit Parishioner IDs manually.

Everything should derive from the authenticated user.

---

# Phase Scope

---

# Part 1 — Live Provider Integration

Replace all placeholder API Providers with production implementations.

## Connect

Profile

Parishes

Announcements

Events

Notifications

Scheduler

Requests

Tracking

Chat Proxy

Maps

All providers must consume the existing Express Backend REST endpoints.

Maintain full compatibility with:

```
Demo Mode

API Mode

Hybrid Mode
```

---

# Part 2 — Parishioner Document Submission Pipeline

Replace the simulated Request Wizard with a complete production submission workflow.

---

## Backend Submission Endpoint

Create secure authenticated endpoints for:

```
POST /requests

POST /requests/:id/files

GET /requests

GET /requests/:trackingNumber

GET /requests/:id
```

Each request automatically belongs to the authenticated parishioner.

The frontend must never specify ownership.

---

## Submission Flow

```
Firebase User

↓

Verify Token

↓

Resolve Parishioner Profile

↓

Create Submission Draft

↓

Upload Supporting Files

↓

Store Files in Cloudflare R2

↓

Create Database Records

↓

Return Tracking Number
```

---

# Part 3 — Submission Drafts (Recommended Addition)

Introduce Draft Requests.

This prevents users from losing progress during long uploads.

Workflow:

```
New Request

↓

Draft Created

↓

Registrant Information Saved

↓

Supporting Files Uploaded

↓

Resume Later

↓

Final Submit
```

Drafts should survive browser refreshes and reconnects.

---

# Part 4 — Upload Session IDs (Recommended Addition)

Instead of uploading directly into completed requests:

Generate an Upload Session.

```
submissionId

↓

Temporary Upload Folder

↓

Multiple File Uploads

↓

Validation

↓

Finalize Request
```

Benefits:

- safer uploads
- resumable uploads
- no orphan request records
- easier rollback

---

# Part 5 — Cloudflare R2 Integration

All uploaded files should stream directly into Cloudflare R2.

Never store uploads permanently on the backend server.

Recommended structure:

```
documents/

    request-id/

        primary/

        supporting/

        receipts/
```

Example:

```
documents/

    req_10291/

        primary/

            baptism_form.pdf

        supporting/

            birth_certificate.pdf

            valid_id.jpg

        receipts/

            gcash_receipt.png
```

Do NOT place every upload into a single bucket root.

Folder organization should remain deterministic.

---

# Part 6 — Multer Upload Pipeline

Implement Multer middleware.

Validation order:

```
Receive Upload

↓

Check Empty File

↓

Check File Size

↓

Validate MIME Type

↓

Validate Extension

↓

Future Virus Scan Middleware

↓

Upload to Cloudflare R2

↓

Create Database Record
```

---

## Supported File Types

PDF

PNG

JPG

JPEG

WEBP

Reject:

Executable files

Archives

Unknown MIME Types

Corrupted files

Zero-byte files

---

## Upload Limits

Implement configurable limits.

Example:

Maximum File Size

Maximum Number of Files

Allowed MIME Types

These values should come from configuration.

---

# Part 7 — Database Records

Every uploaded file receives its own database record.

Do not embed files inside Requests.

Instead normalize.

Recommended structure:

```
Requests

↓

RequestFiles

↓

Payments

↓

PaymentReceipts

↓

ReceiptOCR

↓

AuditLogs
```

---

# Database Normalization Recommendations

Instead of

```
Request

files[]
```

Use

```
Requests

RequestFiles

PaymentTransactions

ReceiptUploads

OCRResults

RequestHistory

Notifications
```

Benefits:

- easier querying

- scalable

- audit-friendly

- future-proof

---

# Part 8 — Fiduciary Request State Machine

Replace simple status strings with a strict backend state machine.

Recommended lifecycle:

```
NEW

↓

PENDING

↓

UNDER_REVIEW

↓

AWAITING_INFORMATION

↓

PAYMENT_PENDING

↓

PAYMENT_VERIFICATION

↓

PROCESSING

↓

READY_FOR_PICKUP

↓

COMPLETED
```

Alternative exits:

```
REJECTED

CANCELLED

EXPIRED
```

---

## State Transition Rules

Only legal transitions should be permitted.

Example:

```
READY_FOR_PICKUP

↓

COMPLETED
```

Allowed

---

Example

```
PENDING

↓

READY_FOR_PICKUP
```

Not Allowed

The backend should reject illegal transitions.

---

# Part 9 — Audit Logs

Every state change should generate immutable audit records.

Example:

```
UNDER_REVIEW

↓

Coordinator Approved

↓

PAYMENT_PENDING
```

Audit entry:

```
Timestamp

Actor

Action

Old Status

New Status

Remarks
```

---

# Part 10 — Receipt Upload Pipeline

Payment receipts become independent uploads.

Workflow:

```
Payment

↓

Upload Receipt

↓

Store in Cloudflare

↓

OCR

↓

Verification

↓

Payment Status Update
```

---

# Part 11 — OCR Integration

Implement OCR through an abstraction layer.

Never call OCR directly from routes.

Architecture:

```
ReceiptVerificationService

↓

OCR Provider

↓

Result
```

Initial provider may use:

```
Tesseract

or

Server OCR
```

Future providers:

```
Gemini Vision

Google Vision

Azure OCR

AWS Textract
```

No frontend changes should be required when replacing OCR engines.

---

# OCR Extraction

Attempt to identify:

Reference Number

Amount

Payment Date

Provider

Confidence Score

Raw OCR Text

---

# Automatic Verification

If confidence is sufficiently high:

```
Receipt Uploaded

↓

OCR

↓

Reference Valid

↓

Amount Valid

↓

Verified
```

Otherwise:

```
Needs Manual Review
```

Coordinator performs approval.

---

# Part 12 — Request History

Every request should maintain chronological history.

Example:

```
Created

↓

Under Review

↓

Payment Requested

↓

Receipt Uploaded

↓

Payment Verified

↓

Processing

↓

Ready

↓

Completed
```

Frontend tracking becomes much richer.

---

# Part 13 — Notifications

Trigger notifications automatically when:

Request Submitted

Payment Requested

Receipt Verified

Request Approved

Ready for Pickup

Rejected

Completed

---

# Part 14 — API Error Handling

Standardize backend responses.

Success:

```
{
    success: true,
    data: ...
}
```

Failure:

```
{
    success: false,
    message: "...",
    errors: [...]
}
```

Avoid inconsistent response formats.

---

# Part 15 — Security

Protect every authenticated endpoint.

Never trust:

Parish IDs

Coordinator IDs

User IDs

Profile IDs

Everything should derive from Firebase identity.

---

# Verification Plan

## Backend

Verify:

- Firebase authentication
- Cloudflare uploads
- Database inserts
- Request creation
- Transaction updates
- Receipt uploads
- OCR execution
- Audit log generation

---

## Frontend

Verify:

API Mode

Hybrid Mode

Demo Mode

remain fully functional.

---

## Manual Testing

### Document Submission

- Submit request
- Upload multiple files
- Refresh browser
- Resume draft
- Finalize request

---

### Cloud Storage

Confirm:

Correct R2 folder structure

Correct file metadata

Correct object naming

---

### State Machine

Verify only legal transitions occur.

Attempt illegal transitions.

Ensure backend rejects them.

---

### OCR

Upload:

GCash Receipt

Maya Receipt

Unreadable Receipt

Corrupted Receipt

Confirm verification behaves correctly.

---

### Build Verification

Frontend

```bash
npm run build
```

Backend

```bash
npm run build
```

Both projects should compile with:

- Zero TypeScript errors
- Zero build warnings
- Zero lint failures

---

# Expected Outcome

Upon completion of Phase 7B, the TESTIMONIUM Parishioner Web Portal will evolve from a frontend prototype into a fully operational production client backed by a secure document processing pipeline.

The system will support authenticated request submissions, resilient draft workflows, Cloudflare R2 object storage, normalized relational data structures, immutable audit logging, a strictly enforced transaction state machine, OCR-assisted payment verification, and a provider-driven architecture that remains scalable for future integrations without requiring major frontend refactoring.
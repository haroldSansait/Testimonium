# TESTIMONIUM Backend REST API Reference Documentation

This document describes the backend endpoints, validation rules, pagination behaviors, role-based authorization requirements, and response formats for the TESTIMONIUM sacramental document processing and scheduling backend.

---

## 1. Authentication & Security

All routes (except public health checkpoints) require authentication using **Firebase ID Tokens** passed in the `Authorization` header:

```http
Authorization: Bearer <Firebase_ID_Token>
```

### Dev Auth Guard Bypass
In `development` environments (when `ENABLE_DEV_AUTH=true`), endpoints can be accessed by passing a mock token matching pre-seeded profiles:
*   `Authorization: Bearer test-token-coordinator` (maps context to `coordinator@testimonium.org`)
*   `Authorization: Bearer test-token-secretary` (maps context to parish secretary)
*   `Authorization: Bearer test-token-priest` (maps context to parish priest)

### Role Authorization
Users are restricted to resources matching their assigned role:
*   **`DIOCESE_COORDINATOR`**: Unrestricted reads/writes across all parishes, users, analytics, and audit logs.
*   **`PRIEST`**: Scoped view/edit of assigned parish entries, calendar events, and presiding priest assignment confirmations.
*   **`SECRETARY`**: Scoped view/edit of assigned parish document requests, scheduling requests, mass schedules, custom events, settings, and availabilities.
*   **`PARISHIONER`**: View/edit of own document requests, appointment scheduling, and profile updates.

---

## 2. Standardized Response Formats

All API responses follow a uniform JSON structure.

### Success Envelope (Collection/List)
Collection and list endpoints return a paginated envelope under the `data` property:

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 48,
    "page": 1,
    "limit": 25,
    "totalPages": 2
  }
}
```

### Success Envelope (Single Resource)
Single resource requests return the object directly under `data`:
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Envelope
Validation failures, authentication errors, not founds, or concurrency conflicts return:
```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

## 3. Endpoint Specifications

### 3.1 Authentication & Profile (`/api/v1/auth`)

#### JIT Authentication & Login
*   **Route**: `POST /api/v1/auth/login`
*   **Roles**: All authenticated users.
*   **Description**: Validates Firebase token, links pre-provisioned staff UIDs on first login, and registers JIT parishioners. Supports `rememberMe` mapping to calculate session limits.
*   **Request Body**:
```json
{
  "rememberMe": true
}
```
*   **Response**: `200 OK` with session DTO and user profile.

#### Get Active Profile
*   **Route**: `GET /api/v1/auth/profile`
*   **Roles**: All authenticated users.
*   **Response**: `200 OK` with profile object.

#### Update Profile Details
*   **Route**: `PUT /api/v1/auth/profile`
*   **Roles**: All authenticated users.
*   **Request Body**:
```json
{
  "fullName": "Elena Cruz-Santos",
  "contactNumber": "09171234567",
  "address": "San Carlos City"
}
```

---

### 3.2 Parish Administration (`/api/v1/parishes`)

#### List Parishes
*   **Route**: `GET /api/v1/parishes`
*   **Roles**: Public / All roles.
*   **Parameters**: `page`, `limit`, `search`, `type`, `status`
*   **Response**: List of parish metadata DTOs.

#### Get Parish By ID / Slug
*   **Route**: `GET /api/v1/parishes/:id`
*   **Roles**: All roles.

#### Update Parish Settings
*   **Route**: `PATCH /api/v1/parishes/:id/settings`
*   **Roles**: `DIOCESE_COORDINATOR`, `SECRETARY` (only for assigned parish)
*   **Request Body**:
```json
{
  "documentSettings": { "BAPTISMAL_CERTIFICATE": { "price": 100 } },
  "eventSettings": {
    "availableEvents": ["BAPTISM", "WEDDING", "CONFIRMATION"],
    "capacitySettings": { "slotCapacity": 2, "dailyLimit": 10 },
    "timeSlots": ["08:00 AM", "09:30 AM", "01:30 PM", "03:30 PM"]
  },
  "officeHours": { "Monday": { "openTime": "08:00 AM", "closeTime": "05:00 PM", "isClosed": false } },
  "availableDocuments": ["BAPTISMAL_CERTIFICATE", "MARRIAGE_CERTIFICATE"],
  "venueCapacity": 200,
  "paymentQrEnabled": true
}
```

#### Upload Payment QR Code
*   **Route**: `POST /api/v1/parishes/:id/payment-qr`
*   **Roles**: `DIOCESE_COORDINATOR`, `SECRETARY`
*   **Content-Type**: `multipart/form-data` (`file` field, max 5MB image).

#### Delete Payment QR Code
*   **Route**: `DELETE /api/v1/parishes/:id/payment-qr`
*   **Roles**: `DIOCESE_COORDINATOR`, `SECRETARY`

#### Batch Update Map Configuration
*   **Route**: `PATCH /api/v1/parishes/map`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Request Body**:
```json
{
  "updates": [
    {
      "id": 1,
      "latitude": 10.485,
      "longitude": 123.415,
      "mapZoom": 14,
      "pinColor": "#7B1C2A",
      "showLabel": true
    }
  ]
}
```

---

### 3.3 Document Requests (`/api/v1/document-requests`)

#### List Document Requests
*   **Route**: `GET /api/v1/document-requests`
*   **Roles**: `DIOCESE_COORDINATOR`, `SECRETARY`, `PARISHIONER` (scoped to own requests)
*   **Parameters**: `page`, `limit`, `search`, `status`, `parishId`, `documentType`

#### Create Document Request (Draft with Fee Snapshot)
*   **Route**: `POST /api/v1/document-requests`
*   **Roles**: `PARISHIONER`
*   **Description**: Creates a draft document request and **snapshots the authoritative fee** based on parish configuration/rates.
*   **Request Body**:
```json
{
  "parishId": 2,
  "applicantName": "Juan Dela Cruz",
  "relationship": "Self",
  "documentType": "BAPTISMAL_CERTIFICATE",
  "purpose": "Employment / Passport"
}
```

#### Submit Document Request Draft
*   **Route**: `POST /api/v1/document-requests/:id/submit`
*   **Roles**: `PARISHIONER`

#### Update Request Status & Corrections
*   **Route**: `PATCH /api/v1/document-requests/:id/status`
*   **Roles**: `SECRETARY`, `DIOCESE_COORDINATOR`
*   **Request Body**:
```json
{
  "status": "NEEDS_CORRECTION",
  "correctionNote": "Please upload a clearer scan of the Government ID.",
  "correctionRequirementIds": ["valid_id"]
}
```

---

### 3.4 Payment Proof & OCR Processing (`/api/v1/payment`)

#### Submit Payment Proof
*   **Route**: `POST /api/v1/payment/proof`
*   **Roles**: `PARISHIONER`
*   **Content-Type**: `multipart/form-data` (`receipt` image file, `requestId`, `provider`, `referenceNumber`)
*   **Description**: Uploads raw receipt to Cloudflare R2, executes Sharp image optimization, runs OCR parsing, and records `OcrResult` with confidence scores.

#### Verify / Reject Payment
*   **Route**: `POST /api/v1/payment/verify`
*   **Roles**: `SECRETARY`, `DIOCESE_COORDINATOR`
*   **Request Body**:
```json
{
  "requestId": 14,
  "status": "VERIFIED",
  "remarks": "GCash reference 10023456789 verified."
}
```

---

### 3.5 Sacramental Scheduling (`/api/v1/schedule-requests`)

#### Query Available Time Slots
*   **Route**: `GET /api/v1/schedule-requests/available-slots`
*   **Roles**: All authenticated users.
*   **Query Parameters**:
  - `parishId` (required, e.g. `2`)
  - `date` (required, ISO `YYYY-MM-DD`, e.g. `2026-08-25`)
  - `eventType` (optional, e.g. `WEDDING`, `BAPTISM`)
*   **Rules Enforced**:
  - Returns `400` if date is in the past or parish is closed on the day of week.
  - Returns `[]` if event type is disabled in `eventSettings.availableEvents`.
  - Filters out slots that reached `capacitySettings.slotCapacity`.
  - Returns `[]` if total daily bookings reached `capacitySettings.dailyLimit`.
*   **Response**: Array of available slot strings (e.g. `["08:00 AM", "09:30 AM", "01:30 PM", "03:30 PM"]`).

#### Book Sacramental Schedule
*   **Route**: `POST /api/v1/schedule-requests`
*   **Roles**: `PARISHIONER`
*   **Description**: Atomically reserves a time slot inside a **Prisma Serializable transaction**.
*   **Request Body**:
```json
{
  "parishId": 2,
  "serviceName": "Baptism",
  "date": "2026-08-25",
  "timeSlot": "09:30 AM",
  "location": "Parish Sanctuary"
}
```

#### Propose Reschedule (Parish Staff)
*   **Route**: `PATCH /api/v1/schedule-requests/:id/propose-reschedule`
*   **Roles**: `SECRETARY`, `DIOCESE_COORDINATOR`
*   **Request Body**:
```json
{
  "proposedDate": "2026-08-27",
  "proposedTime": "10:00 AM",
  "rescheduleReason": "Priest pastoral recollection conflict."
}
```

#### Respond to Proposed Reschedule (Parishioner)
*   **Route**: `POST /api/v1/schedule-requests/:id/respond-reschedule`
*   **Roles**: `PARISHIONER`
*   **Request Body**:
```json
{
  "accept": true
}
```

---

### 3.6 Calendar & Mass Schedules (`/api/v1/calendar`, `/api/v1/mass-schedules`, `/api/v1/parish-events`)

#### Get Parish Calendar Feed
*   **Route**: `GET /api/v1/calendar`
*   **Roles**: Staff & Coordinator. Scoped to parish.
*   **Parameters**: `start`, `end`, `parishId`

#### Mass Schedule Template Management
*   `GET /api/v1/mass-schedules` — List recurring weekly templates.
*   `POST /api/v1/mass-schedules` — Create/update Mass template.
*   `DELETE /api/v1/mass-schedules/:id` — Delete template.

#### Priest Assignment Confirmation
*   **Route**: `PATCH /api/v1/schedules/:id/priest-response` (or `/mass-schedules/:id/priest-response`)
*   **Roles**: `PRIEST`
*   **Request Body**:
```json
{
  "status": "CONFIRMED",
  "reason": "Available to preside."
}
```

---

### 3.7 Activity Logs & Audits (`/api/v1/activity-log`)

#### List Activity Logs
*   **Route**: `GET /api/v1/activity-log`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Parameters**: `page`, `limit`, `search`, `role`, `parishId`, `archived`

#### Archive / Restore / Purge Logs
*   `POST /api/v1/activity-log/archive` — Archive logs older than cutoff date.
*   `POST /api/v1/activity-log/restore` — Restore archived logs.
*   `DELETE /api/v1/activity-log/purge` — Permanently delete archived logs (requires `ENABLE_ACTIVITY_PURGE=true`).

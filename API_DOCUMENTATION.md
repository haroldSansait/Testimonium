# TESTIMONIUM Backend REST API Reference Documentation

This document describes the backend endpoints, validation rules, pagination behaviors, role-based authorization requirements, and response formats for the TESTIMONIUM sacramental document processing backend.

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
*   **`DIOCESE_COORDINATOR`**: Unrestricted reads/writes for parishes, users, analytics, and logs.
*   **`PRIEST`**: Scoped view/edit of their assigned parish database entries and event responses.
*   **`SECRETARY`**: Scoped view/edit of their assigned parish document requests, calendar, mass schedules, events, and availabilities.
*   **`PARISHIONER`**: View/edit of their own document requests, appointment scheduling, and profile updates.

---

## 2. Standardized Response Formats

All API responses follow a uniform JSON structure.

### Success Envelope (Collection/List)
All collection and list endpoints return a standardized paginated envelope under the `data` property to support consistent scaling:

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
Single resource requests return the object directly:
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Envelope
All validation failures, authentication/authorization failures, not found, or internal errors return:
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
*   **Description**: Validates the Firebase token, links pre-provisioned staff UIDs on first login, and registers JIT parishioners. Supports `rememberMe` mapping to calculate session limits (30 days vs 1 day).
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
*   **Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "coordinator@testimonium.org",
    "fullName": "Diocese Coordinator",
    "role": "DIOCESE_COORDINATOR",
    "parish": null
  }
}
```

#### Update Profile Details
*   **Route**: `PUT /api/v1/auth/profile`
*   **Roles**: All authenticated users.
*   **Description**: Updates user fullName, contactNumber, or address.
*   **Request Body**:
```json
{
  "fullName": "Elena Cruz-Santos",
  "contactNumber": "09171234567"
}
```

---

### 3.2 Parish Administration (`/api/v1/parishes`)

#### List Parishes
*   **Route**: `GET /api/v1/parishes`
*   **Roles**: All roles (public directory lists).
*   **Parameters**: `page`, `limit`, `search`, `type`, `status`
*   **Response**: List of parish metadata DTOs.

#### Get Parish By ID
*   **Route**: `GET /api/v1/parishes/:id`
*   **Roles**: All roles.
*   **Response**: Single parish profile DTO.

#### Update Parish Settings
*   **Route**: `PUT /api/v1/parishes/:id/settings`
*   **Roles**: `DIOCESE_COORDINATOR`, `SECRETARY` (only for their assigned parish)
*   **Request Body**:
```json
{
  "documentSettings": "{\"fee\": 100}",
  "eventSettings": "{\"marriageFee\": 1500}",
  "officeHours": "{\"monToFri\": \"08:00 AM - 05:00 PM\"}"
}
```

#### Create Parish
*   **Route**: `POST /api/v1/parishes`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Request Body**:
```json
{
  "name": "St. Joseph Parish",
  "type": "Parish",
  "address": "Canlaon City",
  "patronSaint": "St. Joseph",
  "contactNumber": "09281234567",
  "email": "stjoseph@testimonium.org"
}
```
*   **Response**: `201 Created`.

#### Update Parish Profile
*   **Route**: `PUT /api/v1/parishes/:id`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Request Body**: Partial fields from creation schema, plus optional status (`ACTIVE`, `INACTIVE`), `latitude`, `longitude`, `mapZoom`, `pinColor`, `showLabel`, `directoryDescription`, and `gallery` array.

#### Get Vicariate Map Config
*   **Route**: `GET /api/v1/parishes/map-config`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Response**: `200 OK` returning all parish map marker locations, custom pin colors, zoom thresholds, and label visibility.

#### Batch Update Vicariate Map Config
*   **Route**: `PATCH /api/v1/parishes/map-config/batch`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Rate Limit**: `MAP_SAVE_RATE_LIMIT_MAX` (20/min)
*   **Request Body**: Array of parish coordinate/marker updates.

#### Upload Parish Cover or Logo Image
*   **Route**: `POST /api/v1/parishes/:id/images`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Rate Limit**: `PARISH_IMAGE_UPLOAD_RATE_LIMIT_MAX` (5/min)
*   **Headers**: `Content-Type: multipart/form-data`
*   **Description**: Uploads parish cover or logo image to Cloudflare R2 bucket (`parishes/parish_{id}/...`).

#### Archive Parish
*   **Route**: `DELETE /api/v1/parishes/:id`
*   **Roles**: `DIOCESE_COORDINATOR`

#### Restore Parish
*   **Route**: `POST /api/v1/parishes/:id/restore`
*   **Roles**: `DIOCESE_COORDINATOR`

---

### 3.3 Staff User Management (`/api/v1/users`)

#### List Staff Users
*   **Route**: `GET /api/v1/users`
*   **Roles**: `DIOCESE_COORDINATOR` (all users), `SECRETARY`/`PRIEST` (only when filtering by `role=PRIEST` to show available event options)
*   **Parameters**: `page`, `limit`, `search`, `role`, `status`

#### Create Staff User
*   **Route**: `POST /api/v1/users`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Request Body**:
```json
{
  "name": "Elena Cruz",
  "email": "secretary.stjoseph@testimonium.org",
  "role": "SECRETARY",
  "parish": "St. Joseph Parish"
}
```
*   **Response**: `201 Created` with Firebase password reset link.

#### Update User Color preference
*   **Route**: `PUT /api/v1/users/:id/color`
*   **Roles**: `DIOCESE_COORDINATOR`, `SECRETARY`
*   **Request Body**: `{"color": "#FF5733"}`

#### Update User Role/Profile
*   **Route**: `PUT /api/v1/users/:id`
*   **Roles**: `DIOCESE_COORDINATOR`

#### Disable / Enable User
*   **Route**: `POST /api/v1/users/:id/disable` & `/api/v1/users/:id/enable`
*   **Roles**: `DIOCESE_COORDINATOR`

#### Trigger Password Reset Link
*   **Route**: `POST /api/v1/users/:id/reset-password`
*   **Roles**: `DIOCESE_COORDINATOR`

---

### 3.4 Dashboard & Scoped Feeds (`/api/v1/dashboard`, `/api/v1/calendar`)

#### Get Dashboard Stats
*   **Route**: `GET /api/v1/dashboard/stats`
*   **Roles**: Authenticated staff (scoped by assigned parishId).

#### Get Dashboard Schedule Feed
*   **Route**: `GET /api/v1/dashboard/schedule`
*   **Roles**: Authenticated staff. Retrieves upcoming weeks of calendar entries.

#### Get Dashboard Alerts
*   **Route**: `GET /api/v1/dashboard/alerts`
*   **Roles**: Authenticated staff. Fetches pending requests needing review or processing.

#### Get Calendar Events List
*   **Route**: `GET /api/v1/calendar/events`
*   **Roles**: All authenticated staff.
*   **Parameters**: `year` (e.g. `2026`), `month` (e.g. `7`)
*   **Description**: Scopes scheduled appointments, holy days, and custom events. Automatically filters by assigned `parishId` for non-coordinators.

---

### 3.5 Parishioner Requests & Submissions (`/api/v1/requests`, `/api/v1/payment`, `/api/v1/document-requirements`)

#### Get Requirements Checklist
*   **Route**: `GET /api/v1/document-requirements` & `GET /api/v1/document-requirements/:type`
*   **Parameters**: `type` (e.g. `BAPTISMAL_CERTIFICATE`), `parishId`
*   **Description**: Pulls document requirement checklist metadata.

#### Create Draft Request
*   **Route**: `POST /api/v1/requests`
*   **Roles**: `PARISHIONER`
*   **Request Body**:
```json
{
  "parishId": 2,
  "documentType": "BAPTISMAL_CERTIFICATE",
  "applicantName": "Juan Dela Cruz",
  "relationship": "Self",
  "purpose": "Employment"
}
```
*   **Response**: `201 Created` with request object.

#### List / Get Own Requests
*   **Route**: `GET /api/v1/requests` & `GET /api/v1/requests/:id`
*   **Roles**: `PARISHIONER`

#### Get Request By Tracking Number
*   **Route**: `GET /api/v1/requests/tracking/:trackingNumber`
*   **Roles**: `PARISHIONER`

#### Submit Draft
*   **Route**: `POST /api/v1/requests/:id/submit`
*   **Roles**: `PARISHIONER`. Locks the draft request and flags it as `PENDING` for staff view.

#### Cancel Request
*   **Route**: `POST /api/v1/requests/:id/cancel`
*   **Roles**: `PARISHIONER`

#### Upload Document Attachments
*   **Route**: `POST /api/v1/requests/:id/files`
*   **Roles**: `PARISHIONER`
*   **Headers**: `Content-Type: multipart/form-data`
*   **Files**: Binary uploads containing checklist document requirements. Saves metadata and streams blobs to R2 storage.

#### Upload Receipt & Verify GCash payment
*   **Route**: `POST /api/v1/requests/:id/receipt`
*   **Roles**: `PARISHIONER`
*   **Rate Limit**: `RECEIPT_UPLOAD_RATE_LIMIT_MAX` (5 per 15 min)
*   **Headers**: `Content-Type: multipart/form-data`
*   **Files**: Single screenshot receipt file (`receiptImage`).
*   **Description**: Uploads original receipt image to Cloudflare R2, executes Sharp pre-processing (EXIF auto-rotation, 1200px width normalization, quality 80 JPEG compression), runs OCR engine (OCR.Space Engine 2 or Stub fallback), calculates confidence metrics (`ocrConfidence`, `parserConfidence`, `finalConfidence`), normalizes payment amount and date, updates request status to `PAYMENT_UNDER_REVIEW`, and returns full `OcrResult` object.

#### Resubmit Corrected Requirements
*   **Route**: `POST /api/v1/requests/:id/resubmit-corrections`
*   **Roles**: `PARISHIONER`

#### Get Payment Details Configuration
*   **Route**: `GET /api/v1/payment/configuration`
*   **Roles**: `PARISHIONER`

---

### 3.6 Secretary/Staff Request Processing (`/api/v1/document-requests`, `/api/v1/schedule-requests`)

#### List Scoped Document Requests
*   **Route**: `GET /api/v1/document-requests`
*   **Roles**: `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`
*   **Description**: Scopes list to requester's parish. Coordinates see all.
*   **Parameters**: `page`, `limit`, `search`, `status`, `documentType`

#### Update Document Request Status
*   **Route**: `PATCH /api/v1/document-requests/:id/status`
*   **Roles**: `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`
*   **Request Body**:
```json
{
  "status": "NEEDS_CORRECTION",
  "remarks": "The uploaded GKK endorsement is blurry. Please upload a clear image.",
  "correctionRequirementIds": ["gkk_endorsement"]
}
```

#### List Scoped Schedule Requests
*   **Route**: `GET /api/v1/schedule-requests`
*   **Roles**: `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`

#### Request Scheduling Appointment
*   **Route**: `POST /api/v1/schedule-requests`
*   **Roles**: `PARISHIONER`, `SECRETARY`
*   **Request Body**:
```json
{
  "parishId": 2,
  "eventType": "WEDDING",
  "date": "2026-08-15",
  "timeSlot": "10:00 AM",
  "displayTitle": "Santos-Cruz Wedding",
  "remarks": "Nuptial Mass reservation"
}
```

#### Get Booking Availability Slots
*   **Route**: `GET /api/v1/schedule-requests/available-slots`
*   **Parameters**: `parishId`, `date` (YYYY-MM-DD), `eventType`

#### Update Schedule Appointment Status
*   **Route**: `PATCH /api/v1/schedule-requests/:id/status`
*   **Roles**: `SECRETARY`, `PRIEST`

#### Propose Reschedule
*   **Route**: `POST /api/v1/schedule-requests/:id/propose-reschedule`
*   **Roles**: `SECRETARY`
*   **Request Body**:
```json
{
  "proposedDate": "2026-08-22",
  "proposedTimeSlot": "09:00 AM",
  "rescheduleReason": "Conflict with Bishop visit"
}
```

#### Respond to proposed Reschedule
*   **Route**: `POST /api/v1/schedule-requests/:id/respond-reschedule`
*   **Roles**: `PARISHIONER`
*   **Request Body**:
```json
{
  "accept": true
}
```

#### Assign Priest to Event Schedule
*   **Route**: `POST /api/v1/schedule-requests/:id/assign-priest`
*   **Roles**: `SECRETARY`
*   **Request Body**: `{"assignedPriestId": 3}`

#### Priest Respond to Event Assignment
*   **Route**: `POST /api/v1/schedule-requests/:id/priest-respond`
*   **Roles**: `PRIEST`
*   **Request Body**:
```json
{
  "status": "CONFIRMED", // or "REJECTED"
  "reason": "Available to preside"
}
```

---

### 3.7 Mass Schedules, Parish Events, and Closures

#### List Mass Templates
*   **Route**: `GET /api/v1/mass-schedules/:parishId`
*   **Roles**: Authenticated staff.

#### Upsert / Delete Mass Schedule Templates
*   **Route**: `POST /api/v1/mass-schedules/:parishId` & `DELETE /api/v1/mass-schedules/:id`
*   **Roles**: `SECRETARY`
*   **Request Body (POST)**:
```json
{
  "dayType": "SUNDAY",
  "timeSlot": "08:00 AM",
  "label": "Sunday High Mass",
  "assignedPriestId": 4
}
```

#### Reset Mass Schedule templates
*   **Route**: `POST /api/v1/mass-schedules/:parishId/reset`
*   **Roles**: `SECRETARY`

#### Priest Respond to Recurring Mass Template
*   **Route**: `POST /api/v1/mass-schedules/:id/priest-respond`
*   **Roles**: `PRIEST`
*   **Request Body**: `{"status": "CONFIRMED", "reason": "Approved"}`

#### List Parish Events
*   **Route**: `GET /api/v1/parish-events/:parishId`
*   **Roles**: Authenticated staff.

#### Create / Update / Delete Parish Event
*   **Route**: `POST /api/v1/parish-events` & `PUT /api/v1/parish-events/:id` & `DELETE /api/v1/parish-events/:id`
*   **Roles**: `SECRETARY`, `DIOCESE_COORDINATOR`
*   **Request Body (POST)**:
```json
{
  "parishId": 2,
  "title": "Parish Patronal Fiesta",
  "eventType": "FIESTA",
  "eventDate": "2026-09-15",
  "startTime": "06:00 AM",
  "endTime": "09:00 PM",
  "assignedPriestId": 3
}
```

#### Priest Respond to Parish Event
*   **Route**: `POST /api/v1/parish-events/:id/priest-respond`
*   **Roles**: `PRIEST`

#### Define Availability / Closure Blocks
*   **Route**: `POST /api/v1/parish-availabilities`
*   **Roles**: `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`
*   **Request Body**:
```json
{
  "parishId": 2,
  "type": "PARISH_CLOSED",
  "startDate": "2026-11-01",
  "endDate": "2026-11-02",
  "title": "All Saints' Day closure",
  "description": "Office closed for holidays"
}
```

#### List / Delete Closures
*   **Route**: `GET /api/v1/parish-availabilities` & `DELETE /api/v1/parish-availabilities/:id`

---

### 3.8 Diocese Coordinator Tools (`/api/v1/diocese`, `/api/v1/analytics`, `/api/v1/activity-log`)

#### Get Diocese Stats
*   **Route**: `GET /api/v1/diocese/stats`
*   **Roles**: `DIOCESE_COORDINATOR`

#### Get Diocese Activity Feed
*   **Route**: `GET /api/v1/diocese/activity`
*   **Roles**: `DIOCESE_COORDINATOR`

#### Get Diocese Notifications Log
*   **Route**: `GET /api/v1/diocese/notifications`
*   **Roles**: `DIOCESE_COORDINATOR`

#### Get Analytics Feeds
*   **Routes**:
    *   `GET /api/v1/analytics/overview` (overall statistics)
    *   `GET /api/v1/analytics/sacraments` (sacrament counts)
    *   `GET /api/v1/analytics/documents` (request status details)
    *   `GET /api/v1/analytics/parishes` (comparison counts)
*   **Roles**: `DIOCESE_COORDINATOR`

#### List / Filter System Audit Logs
*   **Route**: `GET /api/v1/activity-log`
*   **Roles**: `DIOCESE_COORDINATOR`
*   **Parameters**: `page`, `limit`, `personnel`, `action`, `startDate`, `endDate`

#### Archive / Restore / Purge Logs
*   **Routes**:
    *   `POST /api/v1/activity-log/archive` (archive array of IDs)
    *   `POST /api/v1/activity-log/archive-all` (archive all)
    *   `POST /api/v1/activity-log/restore` (restore array of IDs)
    *   `POST /api/v1/activity-log/restore-all` (restore all)
    *   `POST /api/v1/activity-log/purge` (hard delete archived logs older than retention settings)
*   **Roles**: `DIOCESE_COORDINATOR`

---

### 3.9 Notifications & System Checkpoints

#### List User Notifications
*   **Route**: `GET /api/v1/notifications`
*   **Roles**: All authenticated users. Returns items scoped to active user ID.

#### Mark Notifications Read
*   **Route**: `PATCH /api/v1/notifications/read-all` & `PATCH /api/v1/notifications/:id/read`
*   **Roles**: All authenticated users.

#### Health Check
*   **Route**: `GET /api/v1/health`
*   **Roles**: Public (no token required).
*   **Response**: `{"status": "ok"}`


# TESTIMONIUM Backend REST API

**Base URL:** `/api/v1`
**Last reconciled:** 24 August 2026
**Source of truth:** `testimonium-backend/server.js`, route modules, validators, controllers, and services.

## Authentication, tenancy, and response conventions

Except for `GET /health`, all endpoints require a Firebase ID token:

```http
Authorization: Bearer <firebase-id-token>
```

In local development only, `ENABLE_DEV_AUTH=true` enables the backend’s development-auth bypass. It must never be enabled in production.

The roles are `PARISHIONER`, `SECRETARY`, `PRIEST`, and `DIOCESE_COORDINATOR`. Staff access is parish-scoped where applicable; the coordinator is cross-parish. A successful response is normally `{ "success": true, "data": ... }`; errors provide `success`, `message`, and optional `errors` or `code`. List endpoints may return pagination metadata alongside items.

## Public and authentication routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | API and database health status. |
| GET | `/auth/profile` | Authenticated | Get the signed-in user profile. |
| PUT | `/auth/profile` | Authenticated | Update the signed-in profile. |
| POST | `/auth/login` | Authenticated | Provision or resolve the Firebase-authenticated user session (supports Google JIT legal payload). |
| POST | `/auth/register` | Authenticated | Register/complete a user record after Firebase authentication. |
| POST | `/auth/legal-acceptance` | Authenticated | Record accepted terms and privacy policy versions. |
| POST | `/auth/resend-verification` | Rate-limited | Request a verification-email resend (60s cooldown, 5/day account limit). |

## Parish directory and configuration

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/parishes` | Authenticated | List active/visible parish directory records with optional search and type filtering. |
| GET | `/parishes/:id` | Authenticated | Get parish details. |
| POST | `/parishes` | Coordinator | Create a parish. |
| PUT | `/parishes/:id` | Coordinator | Update general parish data. |
| DELETE | `/parishes/:id` | Coordinator | Archive a parish. |
| POST | `/parishes/:id/restore` | Coordinator | Restore an archived parish. |
| GET | `/parishes/map-config` | Coordinator | Retrieve map configuration. |
| PATCH | `/parishes/map-config/batch` | Coordinator | Save a validated, rate-limited map configuration batch. |
| PATCH | `/parishes/:id/settings` | Staff | Update parish settings (event/document settings validated strictly via `SchedulingConfiguration`). |
| PUT | `/parishes/:id/settings` | Staff | Settings update path for clients using PUT. |
| POST | `/parishes/:id/payment-qr` | Staff | Upload a payment QR image (`qrImage`, 2 MB limit). |
| DELETE | `/parishes/:id/payment-qr` | Staff | Remove the payment QR image. |
| POST | `/parishes/:id/images` | Coordinator | Upload a directory image (`image`, 5 MB limit). |

`GET /document-requirements` and `GET /document-requirements/:type` expose document metadata and checklist requirements, optionally filtered by `type` and/or `parishId`.

## Parishioner document requests and payment

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/requests` | Parishioner | Create a validated document-request draft. |
| POST | `/requests/:id/submit` | Owner | Submit a draft request. |
| POST | `/requests/:id/cancel` | Owner | Cancel an eligible request. |
| GET | `/requests` | Owner | List the caller’s document requests. |
| GET | `/requests/:id` | Owner | Get request detail by ID. |
| GET | `/requests/tracking/:trackingNumber` | Owner | Get request detail by tracking number. |
| POST | `/requests/:id/files` | Owner | Upload up to five supporting files in `files` (PDF, PNG, JPEG, WebP, 5 MB max each). |
| POST | `/requests/:id/receipt` | Owner | Upload one payment receipt in `receipt` (JPEG/PNG only, 5 MB max, rate-limited). |
| POST | `/requests/:id/resubmit-corrections` | Owner | Resubmit a corrected request after staff request. |
| GET | `/payment/configuration` | Authenticated | Resolve payment settings and QR data for the caller’s context. |
| GET | `/document-requests` | Staff | List processable document requests. |
| PATCH | `/document-requests/:id/status` | Staff | Apply a validated workflow/status change. |

Supporting uploads allow PDF, PNG, JPEG, and WebP, up to 5 MB each. Receipts accept JPEG or PNG only, up to 5 MB; HEIC/HEIF and PDFs are rejected by the backend (mobile converts HEIC locally before upload). A receipt is stored in R2, creates payment and OCR records, and moves the request to `PAYMENT_UNDER_REVIEW`. OCR enriches the evidence asynchronously; staff verification remains mandatory.

## Scheduling, availability, and calendar

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/schedule-requests` | Authenticated | List scheduling requests in the caller’s scope. |
| GET | `/schedule-requests/configuration` | Authenticated | Fetch authoritative parish scheduling configuration (enabled services, time slots, daily and per-slot capacity). |
| GET | `/schedule-requests/availability-dates` | Authenticated | Query parish availability status across a date range. |
| GET | `/schedule-requests/available-slots` | Authenticated | Calculate real-time available slots for a parish, date, and event type. |
| POST | `/schedule-requests` | Authenticated | Create a validated schedule request (supports `Idempotency-Key` header for deduplication). |
| GET | `/schedule-requests/:id` | Authorized participant | Get schedule request details. |
| PATCH | `/schedule-requests/:id/status` | Authorized participant | Update request status within permitted workflow transitions. |
| POST | `/schedule-requests/:id/propose-reschedule` | Staff | Propose a new date/time schedule. |
| POST | `/schedule-requests/:id/respond-reschedule` | Parishioner | Accept or decline a staff reschedule proposal. |
| POST | `/schedule-requests/:id/assign-priest` | Staff | Assign a priest to a schedule. |
| POST | `/schedule-requests/:id/priest-respond` | Priest | Accept or reject a priest assignment. |
| GET | `/parish-availabilities` | Authenticated | List closure, leave, and fully-booked records. |
| POST | `/parish-availabilities` | Staff | Create an availability block. |
| DELETE | `/parish-availabilities/:id` | Staff | Delete an availability block. |
| GET | `/calendar/events` | Authenticated | Retrieve calendar events in the caller’s scope. |
| GET | `/mass-schedules/:parishId` | Authenticated staff | List recurring mass templates. |
| POST | `/mass-schedules/:parishId` | Secretary | Upsert a mass template. |
| DELETE | `/mass-schedules/:id` | Secretary | Delete a template. |
| POST | `/mass-schedules/:parishId/reset` | Secretary | Reset parish templates. |
| POST | `/mass-schedules/:id/priest-respond` | Priest | Respond to template assignment. |
| GET | `/parish-events/all` | Authenticated | Parishioner discovery feed for active public parish events (supports `year` and `month` filters). |
| GET | `/parish-events/:parishId` | Authenticated | List parish events within enforced staff tenancy scope. |
| POST | `/parish-events` | Secretary/Coordinator | Create a parish event. |
| PUT/PATCH | `/parish-events/:id` | Secretary/Coordinator | Update an event. |
| DELETE | `/parish-events/:id` | Secretary/Coordinator | Remove an event. |
| POST | `/parish-events/:id/priest-respond` | Priest | Respond to an event assignment. |

## Administration, notifications, and reporting

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/dashboard/stats`, `/dashboard/schedule`, `/dashboard/alerts` | Authenticated | Role-scoped dashboard data. |
| GET | `/notifications` | Authenticated | List caller notifications. |
| PATCH | `/notifications/read-all` | Authenticated | Mark all caller notifications read. |
| PATCH | `/notifications/:id/read` | Authenticated | Mark one notification read. |
| GET | `/users` | Coordinator; staff for priest directory | List users. |
| POST | `/users` | Coordinator | Create a user. |
| PUT | `/users/:id` | Coordinator | Update a user. |
| PUT | `/users/:id/color` | Coordinator/Secretary | Update user calendar/display color. |
| POST | `/users/:id/disable`, `/users/:id/enable` | Coordinator | Change user active status. |
| POST | `/users/:id/reset-password` | Coordinator | Trigger password reset, rate-limited. |
| GET | `/diocese/stats`, `/diocese/activity`, `/diocese/notifications` | Coordinator | Diocese dashboard data. |
| GET | `/analytics/overview`, `/analytics/sacraments`, `/analytics/documents`, `/analytics/parishes` | Coordinator | Analytics datasets. |
| GET | `/activity-log`, `/activity-log/action-types` | Coordinator | View audit records and filters. |
| POST | `/activity-log/archive`, `/archive-all`, `/restore`, `/restore-all`, `/purge` | Coordinator | Administer audit-log retention. |

## Idempotency and concurrency controls

The backend implements database-backed idempotency via the `idempotency_keys` table and `IdempotencyService`. For endpoints supporting idempotency (e.g. `POST /schedule-requests`), clients can provide an `Idempotency-Key` header (UUID or unique string up to 128 characters). If a duplicate request with the exact payload hash is detected, the previously created resource is returned idempotently. If the same key is submitted with a different payload, a `409 Conflict` is returned.

## Integration notes

- Web portal base URLs: `VITE_API_BASE_URL` (parishioner portal) and `VITE_API_URL` (admin portal).
- Mobile application base URL: `EXPO_PUBLIC_API_BASE_URL`.
- All mutation endpoints must be protected by authentication, role middleware, and strict request schema validation.
- Cloudflare R2 object keys are stored securely in database tables; storage credentials are never exposed to web or mobile clients.

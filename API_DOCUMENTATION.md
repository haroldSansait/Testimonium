# TESTIMONIUM Backend REST API

**Base URL:** `/api/v1`
**Last reconciled:** 20 August 2026
**Source of truth:** `testimonium-backend/server.js`, route modules, validators, and controllers.

## Authentication, tenancy, and response conventions

Except for `GET /health`, all endpoints require a Firebase ID token:

```http
Authorization: Bearer <firebase-id-token>
```

In local development only, `ENABLE_DEV_AUTH=true` enables the backend’s development-auth path. It must never be enabled in production.

The roles are `PARISHIONER`, `SECRETARY`, `PRIEST`, and `DIOCESE_COORDINATOR`. Staff access is parish-scoped where applicable; the coordinator is cross-parish. A successful response is normally `{ "success": true, "data": ... }`; errors normally provide `success`, `message`, and optional `errors`. List endpoints may return pagination metadata alongside items.

## Public and authentication routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | API and database health status. |
| GET | `/auth/profile` | Authenticated | Get the signed-in user profile. |
| PUT | `/auth/profile` | Authenticated | Update the signed-in profile. |
| POST | `/auth/login` | Authenticated | Provision or resolve the Firebase-authenticated user session. |
| POST | `/auth/register` | Authenticated | Register/complete a user record after Firebase authentication. |
| POST | `/auth/legal-acceptance` | Authenticated | Record accepted terms/privacy versions. |
| POST | `/auth/resend-verification` | Rate-limited | Request a verification-email resend. |

## Parish directory and configuration

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/parishes` | Authenticated | List active/visible parish directory records. |
| GET | `/parishes/:id` | Authenticated | Get parish details. |
| POST | `/parishes` | Coordinator | Create a parish. |
| PUT | `/parishes/:id` | Coordinator | Update general parish data. |
| DELETE | `/parishes/:id` | Coordinator | Archive a parish. |
| POST | `/parishes/:id/restore` | Coordinator | Restore an archived parish. |
| GET | `/parishes/map-config` | Coordinator | Retrieve map configuration. |
| PATCH | `/parishes/map-config/batch` | Coordinator | Save a validated, rate-limited map configuration batch. |
| PATCH | `/parishes/:id/settings` | Staff | Update parish settings, constrained to staff tenancy. |
| PUT | `/parishes/:id/settings` | Staff | Same settings update path for clients using PUT. |
| POST | `/parishes/:id/payment-qr` | Staff | Upload a payment QR image (`qrImage`, 2 MB limit). |
| DELETE | `/parishes/:id/payment-qr` | Staff | Remove the payment QR image. |
| POST | `/parishes/:id/images` | Coordinator | Upload a directory image (`image`, 5 MB limit). |

`GET /document-requirements` and `GET /document-requirements/:type` expose document metadata. Both optionally accept `type` and/or `parishId` as appropriate.

## Parishioner document requests and payment

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/requests` | Parishioner | Create a validated document-request draft. |
| POST | `/requests/:id/submit` | Owner | Submit a draft. |
| POST | `/requests/:id/cancel` | Owner | Cancel an eligible request. |
| GET | `/requests` | Owner | List the caller’s requests. |
| GET | `/requests/:id` | Owner | Get a request by ID. |
| GET | `/requests/tracking/:trackingNumber` | Owner | Get a request by tracking number. |
| POST | `/requests/:id/files` | Owner | Upload up to five supporting files in `files`. |
| POST | `/requests/:id/receipt` | Owner | Upload one payment receipt in `receipt`; rate-limited. |
| POST | `/requests/:id/resubmit-corrections` | Owner | Resubmit a corrected request. |
| GET | `/payment/configuration` | Authenticated | Resolve payment settings for the caller’s context. |
| GET | `/document-requests` | Staff | List processable document requests. |
| PATCH | `/document-requests/:id/status` | Staff | Apply a validated workflow/status change. |

Supporting uploads allow PDF, PNG, JPEG, and WebP, up to 5 MB each. Receipts accept JPEG or PNG only, up to 5 MB; HEIC/HEIF and PDFs are rejected. A receipt is stored in R2, creates payment/OCR records, and moves the request to `PAYMENT_UNDER_REVIEW`. OCR enriches the evidence asynchronously; staff still performs approval or correction handling.

## Scheduling, availability, and calendar

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/schedule-requests` | Authenticated | List scheduling requests in the caller’s scope. |
| POST | `/schedule-requests` | Authenticated | Create a validated schedule request. |
| GET | `/schedule-requests/available-slots` | Authenticated | Calculate available slots. |
| PATCH | `/schedule-requests/:id/status` | Authorized workflow participant | Update request status. |
| POST | `/schedule-requests/:id/propose-reschedule` | Staff | Propose a new schedule. |
| POST | `/schedule-requests/:id/respond-reschedule` | Parishioner | Accept or decline a proposal. |
| POST | `/schedule-requests/:id/assign-priest` | Staff | Assign a priest. |
| POST | `/schedule-requests/:id/priest-respond` | Priest | Accept or reject an assignment. |
| GET | `/parish-availabilities` | Authenticated | List closure/leave/full-booked records. |
| POST | `/parish-availabilities` | Staff | Create an availability block. |
| DELETE | `/parish-availabilities/:id` | Staff | Delete an availability block. |
| GET | `/calendar/events` | Authenticated | Retrieve calendar events in the caller’s scope. |
| GET | `/mass-schedules/:parishId` | Authenticated staff | List recurring mass templates. |
| POST | `/mass-schedules/:parishId` | Secretary | Upsert a mass template. |
| DELETE | `/mass-schedules/:id` | Secretary | Delete a template. |
| POST | `/mass-schedules/:parishId/reset` | Secretary | Reset parish templates. |
| POST | `/mass-schedules/:id/priest-respond` | Priest | Respond to template assignment. |
| GET | `/parish-events/all` | Authenticated | Get the parishioner discovery feed. |
| GET | `/parish-events/:parishId` | Authenticated | List parish events within the enforced caller scope. |
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
| GET | `/users` | Coordinator; staff only for priest directory | List users. |
| POST | `/users` | Coordinator | Create a user. |
| PUT | `/users/:id` | Coordinator | Update a user. |
| PUT | `/users/:id/color` | Coordinator/Secretary | Update calendar/display color. |
| POST | `/users/:id/disable`, `/users/:id/enable` | Coordinator | Change user status. |
| POST | `/users/:id/reset-password` | Coordinator | Trigger password reset, rate-limited. |
| GET | `/diocese/stats`, `/diocese/activity`, `/diocese/notifications` | Coordinator | Diocese dashboard data. |
| GET | `/analytics/overview`, `/analytics/sacraments`, `/analytics/documents`, `/analytics/parishes` | Coordinator | Analytics datasets. |
| GET | `/activity-log`, `/activity-log/action-types` | Coordinator | View audit records and filters. |
| POST | `/activity-log/archive`, `/archive-all`, `/restore`, `/restore-all`, `/purge` | Coordinator | Administer audit-log retention. |

## Integration notes

- Portal base URLs are `VITE_API_BASE_URL` (parishioner portal) and `VITE_API_URL` (admin portal).
- Do not add a route without registering it in `server.js`, protecting it with authentication/role middleware, and documenting its payload validation.
- Upload URLs returned by R2 are public URLs; the backend does not currently implement signed R2 URLs.

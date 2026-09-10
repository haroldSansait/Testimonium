# TESTIMONIUM Backend REST API

**Base URL:** `/api/v1`
**Last reconciled:** 9 September 2026
**Source of truth:** `testimonium-backend/server.js`, route modules, validators, controllers, and services.

## Authentication, tenancy, and response conventions

Public unauthenticated endpoints are:
- `GET /` (service info)
- `GET /health` (API and database health status)
- `GET /document-requirements` and `GET /document-requirements/:type` (document metadata and requirement checklists)
- `POST /auth/resend-verification` (rate-limited email verification trigger)

All other endpoints require a verified Firebase ID token in the authorization header:

```http
Authorization: Bearer <firebase-id-token>
```

In local development only, `ENABLE_DEV_AUTH=true` enables the backend’s development-auth bypass. It must never be enabled in production.

The roles are `PARISHIONER`, `SECRETARY`, `PRIEST`, and `DIOCESE_COORDINATOR`. Staff access is parish-scoped where applicable; the coordinator is cross-parish. Parishioners are required to have a completed user profile (`fullName` and `contactNumber`) before creating document or schedule requests; incomplete profiles receive `403 PROFILE_INCOMPLETE`.

A successful response is normally `{ "success": true, "data": ... }`; errors provide `success`, `message`, and optional `errors` or `code`. List endpoints return pagination metadata alongside items.

## Public and authentication routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | API and database health status. |
| GET | `/auth/profile` | Authenticated | Get the signed-in user profile (includes `emailNotificationsEnabled`). |
| PUT | `/auth/profile` | Authenticated | Update the signed-in profile (supports name fields, contact number, address, and `emailNotificationsEnabled` boolean). |
| POST | `/auth/login` | Authenticated (Rate-limited) | Provision or resolve the Firebase-authenticated user session (supports Google JIT legal payload). |
| POST | `/auth/register` | Authenticated (Rate-limited) | Register/complete a user record after Firebase authentication. |
| POST | `/auth/legal-acceptance` | Authenticated | Record accepted terms and privacy policy versions. |
| POST | `/auth/resend-verification` | Public (Rate-limited) | Request a verification-email resend (60s cooldown, 5/day account limit). |

## Parish directory and configuration

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/parishes` | Authenticated | List active/visible parish directory records with optional search and type filtering. (Council data omitted from list for performance). |
| GET | `/parishes/:id` | Authenticated | Get parish details, including structured `councils` (Parish Pastoral Council and conditional Parish Finance Council). |
| GET | `/parishes/selector` | Staff / Coordinator | Fast active parish listing for dropdown selectors (`id`, `parishName`, `municipalityCity`, `province`). |
| GET | `/parishes/:id/councils` | Staff / Coordinator | Fetch Parish Pastoral Council and Parish Finance Council configuration and members. |
| PUT | `/parishes/:id/councils` | Staff / Coordinator | Atomically update PPC/PFC members and toggle PFC status; requires `expectedVersion` (returns `409 COUNCIL_CONFIGURATION_STALE` on conflict). |
| POST | `/parishes/:id/councils/members/:memberId/photo` | Staff / Coordinator (Rate-limited) | Upload an officer portrait photo (`photo`, 2 MB max, JPEG/PNG/WebP). |
| DELETE | `/parishes/:id/councils/members/:memberId/photo` | Staff / Coordinator | Remove an officer portrait photo. |
| POST | `/parishes` | Coordinator | Create a parish. |
| PUT | `/parishes/:id` | Coordinator | Update general parish data. |
| DELETE | `/parishes/:id` | Coordinator | Archive a parish. |
| POST | `/parishes/:id/restore` | Coordinator | Restore an archived parish. |
| GET | `/parishes/map-config` | Coordinator | Retrieve map configuration. |
| PATCH | `/parishes/map-config/batch` | Coordinator (Rate-limited) | Save a validated, rate-limited map configuration batch. |
| PATCH | `/parishes/:id/settings` | Staff / Coordinator | Update parish settings (event/document settings validated strictly via `SchedulingConfiguration`). |
| PUT | `/parishes/:id/settings` | Staff / Coordinator | Settings update path for clients using PUT. |
| POST | `/parishes/:id/payment-qr` | Staff / Coordinator | Upload a payment QR image (`qrImage`, 2 MB limit). |
| DELETE | `/parishes/:id/payment-qr` | Staff / Coordinator | Remove the payment QR image. |
| POST | `/parishes/:id/images` | Coordinator (Rate-limited) | Upload a directory image (`image`, 5 MB limit). |
| GET | `/document-requirements` | Public | List all document metadata and checklist requirements, optionally filtered by `type` and/or `parishId`. |
| GET | `/document-requirements/:type` | Public | Get specific document requirement metadata by document type. |

## Parishioner document requests and payment

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/requests` | Parishioner | Create a validated document-request draft (requires completed user profile). |
| POST | `/requests/:id/submit` | Owner | Submit a draft request. |
| POST | `/requests/:id/cancel` | Owner | Cancel an eligible request. |
| GET | `/requests` | Owner | List the caller’s document requests. |
| GET | `/requests/:id` | Owner | Get request detail by ID. |
| GET | `/requests/tracking/:trackingNumber` | Owner | Get request detail by tracking number. |
| POST | `/requests/:id/files` | Owner | Upload up to five supporting files in `files` (PDF, PNG, JPEG, WebP, 5 MB max each). |
| GET | `/requests/:id/attachments/:attachmentId/download` | Owner | Authenticated private attachment download streaming. |
| POST | `/requests/:id/receipt` | Owner (Rate-limited) | Upload payment receipt in `receipt` (JPEG/PNG only, 5 MB max, rate-limited; allocates incremented `attemptVersion`, supersedes prior attempts). |
| POST | `/requests/:id/resubmit-corrections` | Owner | Resubmit a corrected request after staff request. |
| GET | `/payment/configuration` | Authenticated | Resolve payment settings and QR data for the caller’s context. |
| GET | `/document-requests` | Staff / Coordinator | List processable document requests. |
| PATCH | `/document-requests/:id/status` | Staff / Coordinator | Apply a validated workflow/status change. |
| GET | `/document-requests/:id/attachments/:attachmentId/download` | Staff / Coordinator | Authenticated staff attachment download streaming. |

Supporting uploads allow PDF, PNG, JPEG, and WebP, up to 5 MB each (maximum 5 files per request). Receipts accept JPEG or PNG only, up to 5 MB; HEIC/HEIF and PDFs are rejected by the backend (mobile converts HEIC locally before upload). A receipt upload allocates an atomic `attemptVersion`, supersedes previous non-superseded receipts, records SHA-256 duplicate image hashes, and moves the request to `PAYMENT_UNDER_REVIEW`. OCR enriches the evidence asynchronously; staff verification remains mandatory.

## Scheduling, availability, and calendar

Scheduling availability policy is managed under `/schedule-availability/parishes/:parishId`. Priest, Secretary, and Coordinator roles may read the persisted weekday, service-weekday, and date-exception rules. Only Secretary and Coordinator roles may mutate rules.

Every rule mutation requires `expectedVersion`. A stale configuration returns `409 SCHEDULING_CONFIG_STALE`. Booking, rescheduling, and emergency reschedule transactions lock the same parish configuration row, then re-evaluate office hours, operational blocks, date rules, weekday rules, slots, capacity, and priest availability. Canonical conflicts include `PARISH_CLOSED`, `FULLY_BOOKED`, `SLOT_NOT_CONFIGURED`, `SCHEDULE_CONFLICT`, `DATE_UNAVAILABLE`, `SERVICE_UNAVAILABLE_ON_DAY`, and `PRIEST_UNAVAILABLE`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/schedule-requests` | Authenticated | List scheduling requests in the caller’s scope. |
| GET | `/schedule-requests/configuration` | Authenticated | Fetch authoritative parish scheduling configuration (enabled services, time slots, daily and per-slot capacity). |
| GET | `/schedule-requests/availability-dates` | Authenticated | Query parish availability status across a date range. |
| GET | `/schedule-requests/available-slots` | Authenticated | Calculate real-time available slots for a parish, date, and event type. |
| GET | `/schedule-requests/eligible-priests` | Authenticated | Query active priests assigned to a parish (for preferred priest selection). |
| POST | `/schedule-requests/recommendations` | Authenticated | Constraint-based recommendation algorithm with heuristic ranking (body: `parishId`, `eventType`, `preferredDate`, optional `dateFrom`, `dateTo`, `preferredTimeSlot`, `requestedPriestId`). |
| POST | `/schedule-requests` | Authenticated | Create a validated schedule request (supports `requestedPriestId` and `Idempotency-Key` header; requires completed profile). |
| GET | `/schedule-requests/tracking/:reference` | Authenticated | Get schedule request details by tracking reference number. |
| GET | `/schedule-requests/:id` | Authorized participant | Get schedule request details. |
| GET | `/schedule-requests/:id/priest-availability` | Staff / Coordinator / Priest | Query priest availability for candidate schedule date and time slot. |
| PATCH | `/schedule-requests/:id/status` | Staff / Coordinator / Priest | Update request status within permitted transitions (requires `expectedVersion`). |
| POST | `/schedule-requests/:id/propose-reschedule` | Staff / Coordinator / Priest | Propose a new date/time schedule (requires `expectedVersion`). |
| POST | `/schedule-requests/:id/respond-reschedule` | Parishioner | Accept or decline a staff reschedule proposal (requires `expectedVersion`). |
| POST | `/schedule-requests/:id/assign-priest` | Staff / Coordinator / Priest | Assign a priest to a schedule (requires `expectedVersion`). |
| POST | `/schedule-requests/:id/priest-respond` | Priest | Accept or reject a priest assignment (requires `expectedVersion`). |
| POST | `/schedule-requests/:id/emergency-reschedule` | Staff / Coordinator / Priest | Emergency reschedule with immediate slot reallocation and audit logging (requires `expectedVersion`, `targetDate`, `timeSlot`, `reason`). |
| GET | `/schedule-availability/parishes/:parishId` | Staff / Coordinator | Fetch persisted weekday rules, service weekday rules, and date exceptions for a parish. |
| PUT | `/schedule-availability/parishes/:parishId/weekday-rules` | Secretary / Coordinator | Atomically replace the complete weekday rule set together with event settings and office hours. |
| POST | `/schedule-availability/parishes/:parishId/date-rules` | Secretary / Coordinator | Create a date-specific availability exception. |
| PATCH | `/schedule-availability/parishes/:parishId/date-rules/:ruleId` | Secretary / Coordinator | Update a date-specific availability exception. |
| DELETE | `/schedule-availability/parishes/:parishId/date-rules/:ruleId` | Secretary / Coordinator | Delete a date-specific availability exception. |
| GET | `/parish-availabilities` | Authenticated | List closure, leave, and fully-booked records. |
| POST | `/parish-availabilities` | Staff / Coordinator | Create an availability block. |
| DELETE | `/parish-availabilities/:id` | Staff / Coordinator | Delete an availability block. |
| GET | `/calendar/events` | Staff / Coordinator | Retrieve combined calendar events (including parish-private events) in the caller’s scope. |
| GET | `/mass-schedules/:parishId` | Staff / Coordinator | List recurring mass templates. |
| POST | `/mass-schedules/:parishId` | Secretary | Upsert a mass template. |
| DELETE | `/mass-schedules/:id` | Secretary | Delete a template. |
| POST | `/mass-schedules/:parishId/reset` | Secretary | Reset parish templates. |
| POST | `/mass-schedules/:id/priest-respond` | Priest | Respond to template assignment. |
| GET | `/parish-events/all` | Authenticated | Parishioner discovery feed for active public parish events (supports `year` and `month` filters). |
| GET | `/parish-events/:parishId` | Staff / Coordinator | List parish events within enforced staff tenancy scope (includes private events). |
| POST | `/parish-events` | Secretary / Coordinator | Create a parish event. |
| PUT/PATCH | `/parish-events/:id` | Secretary / Coordinator | Update an event (requires `expectedVersion`). |
| DELETE | `/parish-events/:id` | Secretary / Coordinator | Remove an event. |
| POST | `/parish-events/:id/priest-respond` | Priest | Respond to an event assignment. |

## Priest personal commitment schedules

Mounted under `/api/v1/priest/personal-schedules`, this module allows priests to manage personal calendar commitments that feed directly into the unified schedule conflict and recommendation engines.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/priest/personal-schedules` | Priest | List the priest’s personal schedule commitments (query: `from`, `to`). |
| GET | `/priest/personal-schedules/:id` | Priest | Get details of a single personal commitment. |
| POST | `/priest/personal-schedules` | Priest | Create a personal schedule commitment (`title`, optional `notes`, `startAt`, `endAt`). Enforces `endAt > startAt`. |
| PATCH | `/priest/personal-schedules/:id` | Priest | Update a personal schedule commitment (`title`, optional `notes`, `startAt`, `endAt`, `expectedVersion`). |
| DELETE | `/priest/personal-schedules/:id` | Priest | Delete a personal commitment (query: `expectedVersion`). |

## Administration, notifications, and reporting

Daily reports use `/reports`. Secretary scope is always forced to the authenticated parish. Coordinators may use explicit `PARISH` scope with `parishId` or `DIOCESE` scope with no `parishId`. GET and POST operate on the collection; GET and PATCH `/reports/:id` read/update one authorized report; DELETE `/reports/:id` archives rather than hard-deletes. Update and archive operations require `expectedVersion` and return `409 REPORT_STALE` for lost-update protection.

GET `/analytics/descriptive` accepts a bounded from/to date range plus optional domain filters. Secretaries are forced to their own parish; coordinators may choose one parish or all parishes. Response groups cover documents, payments, schedules, events, reports, and coordinator-only user/parish comparisons. Payment-tab metrics use unified Manila calendar day boundaries (`Asia/Manila` UTC+8) and support `documentType` filtering.

GET `/analytics/payments/verified` provides a paginated, privacy-safe detail feed of staff-verified payments. Accessible to `SECRETARY` (strictly scoped to assigned parish) and `DIOCESE_COORDINATOR` (all-parish or optional `parishId`). Supports server-side search across request tracking number, parishioner full name, transaction reference, and active non-superseded receipt OCR reference. Query parameters include `from`, `to`, `parishId`, `documentType`, `search`, `page`, and `limit`. Amounts are formatted as fixed two-decimal strings (e.g. `150.00`, `0.00`) and internal R2/OCR credentials are excluded. Reads use a consistent snapshot transaction.

Parish events accept `PUBLIC` or `PARISH_PRIVATE` visibility. Public discovery excludes private parish events while recurring public Mass templates remain present. Event updates require `expectedVersion` and return `409 EVENT_STALE` when stale.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/dashboard/stats`, `/dashboard/schedule`, `/dashboard/alerts` | Staff / Coordinator | Role-scoped dashboard statistics, schedules, and alerts. |
| GET | `/reports` | Secretary / Coordinator | List parish or diocese daily reports. |
| POST | `/reports` | Secretary / Coordinator | Create a daily report. |
| GET | `/reports/:id` | Secretary / Coordinator | Get daily report details by ID. |
| PATCH | `/reports/:id` | Secretary / Coordinator | Update a daily report (requires `expectedVersion`). |
| DELETE | `/reports/:id` | Secretary / Coordinator | Archive a daily report (requires `expectedVersion`). |
| GET | `/notifications` | Authenticated | List caller notifications. |
| PATCH | `/notifications/read-all` | Authenticated | Mark all caller notifications read. |
| PATCH | `/notifications/:id/read` | Authenticated | Mark one notification read. |
| GET | `/users` | Coordinator; staff for priest directory | List users. |
| POST | `/users` | Coordinator (Rate-limited) | Create a user. |
| PUT | `/users/:id` | Coordinator | Update a user. |
| PUT | `/users/:id/color` | Coordinator / Secretary | Update user calendar/display color. |
| POST | `/users/:id/disable`, `/users/:id/enable` | Coordinator | Change user active status. |
| POST | `/users/:id/reset-password` | Coordinator (Rate-limited) | Trigger password reset, rate-limited. |
| GET | `/diocese/stats`, `/diocese/activity`, `/diocese/notifications` | Coordinator | Diocese dashboard data. |
| GET | `/analytics/descriptive` | Secretary / Coordinator | Multi-domain descriptive analytics dataset with Manila payment boundaries. |
| GET | `/analytics/payments/verified` | Secretary / Coordinator | Paginated, privacy-safe verified payment detail records with server search. |
| GET | `/analytics/overview`, `/analytics/sacraments`, `/analytics/documents`, `/analytics/parishes` | Coordinator | Diocese analytics datasets. |
| GET | `/activity-log` | Coordinator | View audit records with role, personnel, action, and date filtering. |
| GET | `/activity-log/action-types` | Coordinator | View centralized catalog of canonical audit action types. |
| POST | `/activity-log/archive`, `/archive-all`, `/restore`, `/restore-all`, `/purge` | Coordinator | Administer audit-log retention. |


## Idempotency and concurrency controls

Mandatory document-lifecycle and schedule-transition emails are recorded in `email_outbox` inside the same transaction as the business state change. Seven transactional email types are supported:
- `DOCUMENT_SUBMITTED`
- `DOCUMENT_NEEDS_CORRECTION`
- `DOCUMENT_PAYMENT_NEEDS_CORRECTION`
- `DOCUMENT_READY_FOR_PICKUP`
- `SCHEDULE_SUBMITTED`
- `SCHEDULE_PROPOSED_RESCHEDULE`
- `SCHEDULE_CONFIRMED`

A worker claims due rows with `FOR UPDATE SKIP LOCKED`, a unique processing token, and an expiring lease. Delivery checks the recipient user's `emailNotificationsEnabled` preference; when set to `false`, email dispatch is safely bypassed while corresponding in-app notifications persist. `transitionKey` prevents duplicate delivery records for the same business transition; `proposalVersion` permits later legitimate reschedule proposals. SMTP delivery is provider-neutral, bounded by timeouts, and retries transient failures with capped backoff.

Parish council management uses optimistic concurrency control through `ParishCouncilConfiguration.version`. Every `PUT /parishes/:id/councils` mutation must supply `expectedVersion`. If the stored version differs, the API aborts the transaction with `409 COUNCIL_CONFIGURATION_STALE`. Saving requires at least one member when the Parish Finance Council is enabled, and toggling PFC disabled preserves existing finance rows as dormant snapshots rather than destroying them.

Scheduling entities (`schedules` and `priest_personal_schedules`) enforce optimistic concurrency control via integer `version` columns. Stale mutation attempts are rejected with conflict errors. Transitions on `schedules` automatically append audit entries to `schedule_history`.

The backend implements database-backed idempotency via the `idempotency_keys` table and `IdempotencyService`. For endpoints supporting idempotency (e.g. `POST /schedule-requests`), clients can provide an `Idempotency-Key` header (UUID or unique string up to 128 characters). If a duplicate request with the exact payload hash is detected, the previously created resource is returned idempotently. If the same key is submitted with a different payload, a `409 Conflict` is returned.

## Integration notes

- Web portal base URLs: `VITE_API_BASE_URL` (parishioner portal) and `VITE_API_URL` (admin portal).
- Mobile application base URL: `EXPO_PUBLIC_API_BASE_URL`.
- All mutation endpoints must be protected by authentication, role middleware, and strict request schema validation.
- Cloudflare R2 object keys are stored securely in database tables; storage credentials are never exposed to web or mobile clients.

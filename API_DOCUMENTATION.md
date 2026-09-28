# TESTIMONIUM Backend REST API

**Base URL:** `/api/v1`
**Last reconciled:** 28 September 2026
**Source of truth:** `testimonium-backend/server.js`, route modules, validators, controllers, and services.

## Authentication, tenancy, and response conventions

Public unauthenticated endpoints are:
- `GET /` (service info)
- `GET /health` (API and database health status)
- `GET /document-requirements` and `GET /document-requirements/:type` (document metadata, fee matrix, and requirement checklists with parish overrides)
- `POST /auth/resend-verification` (rate-limited email verification trigger)

All other endpoints require a verified Firebase ID token in the authorization header:

```http
Authorization: Bearer <firebase-id-token>
```

In local development only, `ENABLE_DEV_AUTH=true` enables the backend’s development-auth bypass. It must never be enabled in production.

The roles are `PARISHIONER`, `SECRETARY`, `PRIEST`, and `DIOCESE_COORDINATOR`:
- `PARISHIONER`: Access to own profile, document requests, receipt uploads, schedule requests with preferred priest selection, in-app notifications, and Caloy assistant queries. Incomplete profiles (`fullName` and `contactNumber`) receive `403 PROFILE_INCOMPLETE` on request creation.
- `SECRETARY`: Parish-scoped operations, document request processing (including drafting, advancing to `READY_FOR_SIGNING`, and `READY_FOR_PICKUP`), document settings/requirement configuration, payment review, verified payment analytics, mass templates, weekday/date rules, daily reports, parish events, council officer photos, and emergency rescheduling.
- `PRIEST`: Personal commitment calendar management (`/priest/personal-schedules`), parish-scoped operational schedule/event views, parish-scoped read-only document request review (`GET /document-requests` and attachment download streaming; status mutations strictly rejected with `403 FORBIDDEN`), read-only scheduling rules, and liturgical assignment responses.
- `DIOCESE_COORDINATOR`: Cross-parish administration, parish directory management (including Mother Parish designation), interactive map configuration, parish settings and document requirements governance, weekday/date rules, daily reports, system analytics, verified payment feeds, Caloy Control Center management, Knowledge Base governance, and audit log retention.

A successful response is normally `{ "success": true, "data": ... }`; errors provide `success`, `message`, and optional `errors` or `code`. List endpoints return pagination metadata alongside items.

### Registered Route Modules (22 Modules)
All REST API endpoints are mounted under `/api/v1` across 22 functional modules:
`health`, `auth`, `dashboard`, `document-requests`, `document-requirements`, `parish-availabilities`, `requests`, `payment`, `parishes`, `users`, `schedule-requests`, `schedule-availability`, `reports`, `notifications`, `calendar`, `activity-log`, `diocese`, `analytics`, `mass-schedules`, `parish-events`, `priest/personal-schedules`, and `chatbot` (including `/chatbot/admin/*` Caloy management and telemetry endpoints).

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
| GET | `/parishes` | Authenticated | List active/visible parish directory records with optional search and type filtering. Includes the parish-level `isMotherParish` designation, primary `priest`, and `assistantPriests` array (`[{ id, name }]`). (Council data omitted from list for performance). |
| GET | `/parishes/:id` | Authenticated | Get parish details, including the parish-level `isMotherParish` designation, primary `priest`, `assistantPriests`, and structured `councils` (Parish Pastoral Council and conditional Parish Finance Council). |
| GET | `/parishes/selector` | Staff / Coordinator | Fast active parish listing for dropdown selectors (`id`, `parishName`, `municipalityCity`, `province`). |
| GET | `/parishes/:id/councils` | Staff / Coordinator | Fetch Parish Pastoral Council and Parish Finance Council configuration and members. |
| PUT | `/parishes/:id/councils` | Staff / Coordinator | Atomically update PPC/PFC members and toggle PFC status; requires `expectedVersion` (returns `409 COUNCIL_CONFIGURATION_STALE` on conflict). |
| POST | `/parishes/:id/councils/members/:memberId/photo` | Staff / Coordinator (Rate-limited) | Upload an officer portrait photo (`photo`, 2 MB max, JPEG/PNG/WebP). |
| DELETE | `/parishes/:id/councils/members/:memberId/photo` | Staff / Coordinator | Remove an officer portrait photo. |
| POST | `/parishes` | Coordinator | Create a parish, including the optional `isMotherParish` boolean designation (defaults to `false`). Enforces single Mother Parish per diocese invariant. |
| PUT | `/parishes/:id` | Coordinator | Update general parish data, including `isMotherParish`. Only Diocese Coordinators may modify the designation. Conflicts return `409` if another parish already holds the designation. |
| DELETE | `/parishes/:id` | Coordinator | Archive a parish using the standard soft-archive behavior. |
| POST | `/parishes/:id/restore` | Coordinator | Restore an archived parish. |
| GET | `/parishes/map-config` | Coordinator | Retrieve map configuration. |
| PATCH | `/parishes/map-config/batch` | Coordinator (Rate-limited) | Save a validated, rate-limited map configuration batch. |
| PATCH | `/parishes/:id/settings` | Staff / Coordinator | Update parish settings (event/document settings validated strictly via `SchedulingConfiguration` and `validateDocumentSettingsForSave`). `documentSettings` and `availableDocuments` mutations are restricted to Secretary and Coordinator (`PRIEST` receives `403`). Supports custom requirement assignments and base prices. |
| PUT | `/parishes/:id/settings` | Staff / Coordinator | Settings update path for clients using PUT (same authorization restrictions and schema validation as PATCH). |
| POST | `/parishes/:id/payment-qr` | Staff / Coordinator | Upload a payment QR image (`qrImage`, 2 MB limit). |
| DELETE | `/parishes/:id/payment-qr` | Staff / Coordinator | Remove the payment QR image. |
| POST | `/parishes/:id/images` | Coordinator (Rate-limited) | Upload a directory image (`image`, 5 MB limit). |
| GET | `/document-requirements` | Public | List all document metadata and checklist requirements, optionally filtered by `type` and/or `parishId` (which resolves effective parish-specific base fees and custom requirements). |
| GET | `/document-requirements/:type` | Public | Get specific document requirement metadata by document type, supporting optional `parishId` query to resolve effective parish overrides. |

## Parishioner document requests, requirements, and payment

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/requests` | Parishioner | Create a validated document-request draft (requires completed user profile). |
| POST | `/requests/:id/submit` | Owner | Submit a draft request; validates all required documents for the document type and parish have been uploaded. |
| POST | `/requests/:id/cancel` | Owner | Cancel an eligible request. |
| GET | `/requests` | Owner | List the caller’s document requests. |
| GET | `/requests/:id` | Owner | Get request detail by ID. |
| GET | `/requests/tracking/:trackingNumber` | Owner | Get request detail by tracking number. |
| POST | `/requests/:id/files` | Owner | Upload up to five supporting files in `files` (PDF, PNG, JPEG, WebP, 5 MB max each) under canonical requirement category IDs. |
| GET | `/requests/:id/attachments/:attachmentId/download` | Owner | Authenticated private attachment download streaming. |
| POST | `/requests/:id/receipt` | Owner (Rate-limited) | Upload payment receipt in `receipt` (JPEG/PNG only, 5 MB max, rate-limited; allocates incremented `attemptVersion`, supersedes prior attempts). |
| POST | `/requests/:id/resubmit-corrections` | Owner | Resubmit a corrected request after staff request. |
| GET | `/payment/configuration` | Authenticated | Resolve payment settings and QR data for the caller’s context. |
| GET | `/document-requests` | Staff / Coordinator / Priest | List processable document requests. Priests have parish-scoped read-only access. |
| PATCH | `/document-requests/:id/status` | Secretary / Coordinator | Apply a validated workflow/status change. Priests are strictly rejected with `403` (read-only). Canonical workflow: `PROCESSING` → `READY_FOR_SIGNING` → `READY_FOR_PICKUP` → `COMPLETED`. Transitioning to `READY_FOR_SIGNING` dispatches an in-app notification to the active primary parish priest. |
| GET | `/document-requests/:id/attachments/:attachmentId/download` | Staff / Coordinator / Priest | Authenticated staff attachment download streaming (includes parish-assigned Priests for review). |

### Sacramental Document Types and Configurable Requirements Matrix

The system governs seven canonical document types and eight canonical requirement items:

**7 Canonical Document Types (`CANONICAL_DOCUMENT_TYPES`):**
1. `BAPTISMAL_CERTIFICATE`: Official copy of Sacrament of Baptism registry entry (default base fee ₱100.00).
2. `CONFIRMATION_CERTIFICATE`: Official record of Sacrament of Confirmation (default base fee ₱100.00).
3. `MARRIAGE_CERTIFICATE`: Official sacramental record of Holy Matrimony (default base fee ₱150.00).
4. `FIRST_COMMUNION_CERTIFICATE`: Official record of First Holy Communion (default base fee ₱75.00).
5. `MARRIAGE_BANNS`: Public notification of prospective marriage posted across parishes (default base fee ₱200.00).
6. `PERMIT_TO_MARRY`: Canonical clearance granted to marry in another parish or jurisdiction (default base fee ₱150.00).
7. `STATUS_OF_LIBERTY`: Attestation of canonical freedom to marry / Status Liber (default base fee ₱150.00).

**8 Canonical Requirement IDs (`CANONICAL_REQUIREMENT_IDS`):**
- `valid_id`: Valid Government / Student ID (category: `primary`)
- `baptismal_cert`: Baptismal Certificate (category: `supporting`)
- `confirmation_cert`: Confirmation Certificate (category: `supporting`)
- `marriage_license`: Civil Marriage License / Marriage Contract (category: `supporting`)
- `precana_proof`: Pre-Cana Seminar Certificate (category: `supporting`)
- `cenomar`: PSA CENOMAR (category: `supporting`)
- `banns_clearance`: Banns Clearance Form (category: `supporting`)
- `canonical_interview`: Canonical Interview Form / Document (category: `supporting`)

**Configurable Requirements Behavior:**
- Each document type has default required documents in `DOCUMENT_REQUIREMENTS_MATRIX`.
- Parishes can customize requirement assignments per document type in `Parish.documentSettings`:
  ```json
  {
    "BAPTISMAL_CERTIFICATE": {
      "price": 100,
      "requirements": {
        "valid_id": true,
        "cenomar": true,
        "baptismal_cert": false
      }
    }
  }
  ```
  - An override of `false` removes a default requirement.
  - An override of `true` enables any canonical requirement for that document type.
  - Setting updates are strictly validated by `validateDocumentSettingsForSave` against canonical IDs; unknown IDs, non-boolean values, or malformed JSON return `400 Bad Request`.
  - When `parishId` is passed to `GET /document-requirements` or `GET /document-requirements/:type`, the service dynamically overlays the parish's custom pricing and requirements.
  - During request submission (`POST /requests/:id/submit`), the backend validates that attachments exist for every resolved required document.

**Document Request Lifecycle & Presentation Mapping:**
- Canonical workflow: `PENDING` → `UNDER_REVIEW` → `PAYMENT_PENDING` → `PAYMENT_UNDER_REVIEW` → `PAYMENT_VERIFIED` → `PROCESSING` → `READY_FOR_SIGNING` → `READY_FOR_PICKUP` → `COMPLETED`.
- Correction workflows: `UNDER_REVIEW` → `NEEDS_CORRECTION` → `UNDER_REVIEW`; `PAYMENT_UNDER_REVIEW` → `PAYMENT_NEEDS_CORRECTION` → `PAYMENT_UNDER_REVIEW`.
- `READY_FOR_SIGNING`: Internal stage indicating document certificate drafting is complete and awaiting the physical signature of the parish's primary priest before pickup. Transitioning to `READY_FOR_SIGNING` automatically dispatches an in-app notification to the active primary parish priest (`DOCUMENT_REQUEST_READY_FOR_SIGNING`). If no active primary priest is assigned, it proceeds gracefully.
- Client presentation: Parishioner-facing clients (web portal and mobile app) map `READY_FOR_SIGNING` to "Processing" ("Document is prepared and awaiting the parish priest's signature before release"), shielding internal operational workflows from parishioner confusion while providing full transparency.
- Supporting uploads allow PDF, PNG, JPEG, and WebP, up to 5 MB each (maximum 5 files per request). Receipts accept JPEG or PNG only, up to 5 MB; HEIC/HEIF and PDFs are rejected by the backend (mobile converts HEIC locally before upload). A receipt upload allocates an atomic `attemptVersion`, supersedes previous non-superseded receipts, records SHA-256 duplicate image hashes, and moves the request to `PAYMENT_UNDER_REVIEW`. OCR enriches the evidence asynchronously; staff verification remains mandatory.

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
| POST | `/chatbot/query` | Parishioner | Query Caloy AI chatbot for verified guides and procedures. Strict schema, rate-limited, no internal state leakage. |
| GET | `/chatbot/knowledge` | Coordinator | List knowledge sources with strict, bounded query fields: `page` (default 1), `limit` (default 20, maximum 100), `status`, `authority`, `scope`, `parishId`, `category`, and `search`. Returns `{ total, page, limit, totalPages, data }`. |
| POST | `/chatbot/knowledge` | Coordinator | Create a new knowledge source with initial chunks (DRAFT + PROVISIONAL). |
| GET | `/chatbot/knowledge/:id` | Coordinator | Get knowledge source details including current-version chunks and embedding status. |
| PATCH | `/chatbot/knowledge/:id` | Coordinator | Update knowledge source. Optimistic concurrency with required `expectedVersion`. Invalidates old chunks and resets to DRAFT + PROVISIONAL. |
| POST | `/chatbot/knowledge/:id/confirm` | Coordinator | Confirm a DRAFT source (authority becomes CONFIRMED). Requires positive integer `expectedVersion`. Chunks become eligible for embedding worker. |
| POST | `/chatbot/knowledge/:id/publish` | Coordinator | Publish a CONFIRMED source with all READY chunks (status becomes ACTIVE). Requires positive integer `expectedVersion`. Retrievable by Caloy. |
| POST | `/chatbot/knowledge/:id/retire` | Coordinator | Retire an active knowledge source (status becomes RETIRED). Requires positive integer `expectedVersion`. Excluded from future retrieval. |
| POST | `/chatbot/knowledge/:id/retry-embedding` | Coordinator | Retry failed chunk embeddings for a knowledge source (FAILED chunks reset to PENDING). Requires positive integer `expectedVersion`. |

For `POST /chatbot/query`, `selectedParishId` is optional question context, not parishioner tenancy. With no selection, retrieval is diocese-wide knowledge only. Selecting any active parish P retrieves diocese-wide knowledge plus PARISH P knowledge while excluding every other parish; parishioners may freely switch the selected active parish and are not restricted by `User.parishId`.

### Caloy Semantic Routing & Authoritative Validation Architecture

Caloy operates using a **Gemini-First Natural Language Understanding + Safe Tool Validation** architecture. Instead of hardcoded regex command patterns or phrase dictionaries, Caloy utilizes Gemini (`gemini-3.5-flash-lite`) to semantically interpret what the user means, while the backend maintains strict, authoritative control over what can be executed.

```
USER MESSAGE
    ↓
SAFE CONVERSATIONAL CONTEXT
    ↓
GEMINI SEMANTIC INTERPRETATION (gemini-3.5-flash-lite)
    ↓
STRICT STRUCTURED INTENT + ENTITIES
    ↓
BACKEND VALIDATION & BOUNDARY ENFORCEMENT
    ├── SOCIAL (Zero-cost greetings/identity/capabilities)
    ├── CAPABILITIES (Dynamic platform capabilities, no death certs)
    ├── LIVE TOOL (Authoritative server validation & execution)
    ├── RAG (Procedural retrieval with 0.65 threshold & verification)
    ├── CLARIFICATION (Structured parameter collection: PARISH, DOC, EVENT, DATE)
    └── OUT OF SCOPE (Polite ecclesiastical domain boundary)
    ↓
BACKEND EXECUTES ONLY APPROVED ACTION
    ↓
FINAL RESPONSE + EPHEMERAL SAFE CONTEXT
```

#### Core Architectural Principles
1. **Semantic Understanding vs. Fixed Capabilities:**
   - Caloy's allowed capabilities and safety rules are hardcoded and strictly enforced by the backend.
   - User phrasing is **never** restricted to regex dictionaries. Natural phrasing variants (e.g. *"What would getting a copy of my baptism record cost over at St Joseph?"*, *"Which clergy members are currently serving this parish?"*) are understood semantically.
2. **Model Authority Boundaries:**
   - Gemini **never** directly executes tools, receives Prisma clients, or issues database queries.
   - Gemini output is strictly treated as a proposal (`route`, `intent`, `entities`).
   - Arbitrary or hallucinated tool proposals (e.g. `DROP_DATABASE`, `DELETE_USER`) are rejected immediately by the backend registry.
   - The model can never authorize users; private operational tools strictly use `req.user.id` from authenticated session principals.
3. **Data Privacy & Sanitization:**
   - Private live operational records (payment transactions, request records, uploaded receipts, OCR output, staff remarks) are **never** provided to Gemini.
   - Sensitive tracking numbers are masked to `<TRACKING_NUMBER>` before semantic evaluation; the backend retains and matches the identifier locally.
   - Unavailable slot reasons never reveal conflicting events, names, tracking numbers, or appointment details of other parishioners.
4. **Lightweight Ephemeral Conversational Context:**
   - Safe ephemeral state (`lastIntent`, `lastParishId`, `lastParishName`, `lastVicariateId`, `lastVicariateName`, `lastDocumentType`, `lastScheduleEvent`, `lastDatePhrase`, `lastTimePhrase`, `lastPriestName`, `lastPriestId`, `lastResponseType`) is retained in session storage and backend session memory (30-minute TTL).
   - Zero database persistence; cleared immediately upon user sign-out.
   - Natural follow-ups (e.g. *"How about St. Joseph?"*, *"Is Fr. Julius free at 2?"*, *"How many of those are parishes?"*) inherit context seamlessly. Explicit topic changes (e.g. switching from scheduling to payment verification) immediately clear prior scheduling context.
5. **Approved Live Tools (Current Operational State - 16 Registered Tools):**
   - `GET_ACTIVE_PARISHES`: Authoritative directory listing active parishes, quasi-parishes, and mission stations from database with type and location.
   - `GET_VICARIATE_DIRECTORY`: Authoritative directory listing active church units belonging to a requested Vicariate, with total counts and breakdowns by church unit type (Parish, Quasi-Parish, Mission Station).
   - `GET_ACTIVE_PARISH_PRIESTS`: Queries active clergy assigned to the requested parish, formatted with canonical single honorific.
   - `GET_PARISH_DOCUMENTS`: Queries document offerings configured for a parish.
   - `GET_PARISH_SCHEDULABLE_EVENTS`: Queries schedulable sacramental event offerings configured for a parish (`ScheduleEventType`).
   - `GET_DOCUMENT_REQUIREMENTS`: Queries current document requirements checklist.
   - `GET_DOCUMENT_FEE`: Returns effective parish fee with fallback if no fee is configured.
   - `GET_PARISH_OFFICE_INFO`: Returns public office hours, contact numbers, email, and address.
   - `GET_CALENDAR_SLOT_AVAILABILITY`: Reuses canonical `ScheduleService.getAvailableSlots` with the configured slot starts, office rules, service eligibility, and conflict engine. Evaluates specific time slots (`timeSlot`), computing `isAvailable` (AVAILABLE / UNAVAILABLE) and safe alternatives without exposing conflicting bookings. The legacy conflict-window fallback is not an authoritative configured service duration.
   - `GET_AVAILABLE_DATES`: Reuses canonical scheduling evaluation across a bounded date range (14 days by default, at most 31), returning only dates with at least one eligible configured slot and a safe reason when the service is not offered or no dates qualify.
   - `CHECK_PRIEST_AVAILABILITY`: Evaluates active clergy assignments and parish calendar conflicts (`loadPriestConflictSnapshot` + `evaluatePriestConflictFromSnapshot`) for a specific date and time slot, hiding private conflict details.
   - `GET_AVAILABLE_PRIESTS_FOR_SLOT`: Evaluates eligible active clergy assigned to the parish and returns only those free at the requested time slot.
   - `GET_PARISH_EVENTS_FOR_DATE`: Strictly queries `PUBLIC` parish calendar events and recurring `MassScheduleTemplate` occurrences for the date, hiding `PARISH_PRIVATE` operational records.
   - `CHECK_MY_REQUEST_STATUS`: Authenticated lookup scoped strictly to caller's owned `DocumentRequest` records.
   - `CHECK_MY_PAYMENT_STATUS`: Authenticated lookup scoped strictly to caller's owned payment/request records.
   - `GET_MY_UPCOMING_SCHEDULES`: Authenticated lookup for upcoming sacramental appointments in Asia/Manila timezone.
6. **Procedural Knowledge Pipeline (RAG):**
   - Used for stable procedural, policy, and system guidance (e.g., payment verification workflows, requirements rules).
   - Embedding: `gemini-embedding-2` (768 dimensions), cosine vector search with `CHATBOT_MIN_SIMILARITY=0.65`, evidence gating, generation via `gemini-3.5-flash-lite`, and strict citation verification.
   - Lexical matching enhanced with payment canonical terms (`gcash`, `ocr`, `receipt`, `verify`). Dedicated topic change reset prevents scheduling context contamination.

7. **Caloy Experience Architecture (Response Composer & Personality):**
   - **Central Policy (`CaloyPolicy.js`):** Defines canonical identity ("Caloy, your TESTIMONIUM assistant"), restrained saint-like personality (warm, calm, respectful, service-oriented, non-theatrical, no preachy religious catchphrases), pastoral boundaries (defers theological/confessional questions gently to priests/parish office), prompt-injection resistance, and natural language mirroring.
   - **Grounded Response Composer (`CaloyResponseComposer.js`):** Takes verified structured facts from backend live tools and rephrases into natural Caloy prose. Operates under a strict 12-second timeout with 0 retries. If composer fails or encounters provider 429, it safely falls back to the deterministic tool answer without breaking the query.
   - **Runtime Fact-Preservation Validator:** Verifies canonical facts (currency amounts, tracking numbers, parish names, priest names, schedule dates/times/slots, safe statuses) against approved facts before releasing composed answers. If validation fails or conflict is detected, falls back to deterministic answer.
   - **Follow-up Capability Validation:** Optional structured follow-ups are validated against registered whitelist capabilities; valid follow-up text is seamlessly appended to the final answer (zero new public API fields required).
   - **Native Multilingual Mirroring:** Uses Gemini's native multilingual ability to match the user's natural language and code-switching (English, Tagalog, Hiligaynon, Cebuano, Taglish) per turn without a rigid classifier, language enum, language persistence, or corpus duplication.
   - **Private Data Sanitization Boundary:** Authenticated private tools (`CHECK_MY_REQUEST_STATUS`, `CHECK_MY_PAYMENT_STATUS`, `GET_MY_UPCOMING_SCHEDULES`) send strictly authorized user-visible fields to Gemini. Raw staff notes, OCR confidence/text, Cloudflare R2 URLs, and private audit trails are strictly forbidden and filtered backend-side.
   - **Mobile Caloy Architecture:** Mobile client (`testimonium-parishioner-app`) uses the same `/chatbot/query` endpoint with Firebase Bearer token authentication. Features a dedicated `(caloy)` tab in the 5-tab navigation bar, alongside a prominent Home card navigating to the full-screen chat experience. Supports the central Quick Actions action sheet, animated message bubbles, progressive reveal, clarification selection pills, and sources accordion. Local chat state is stored via AsyncStorage namespaced by Firebase UID (`testimonium_caloy_context_v1:<uid>`), capped at 50 messages, and cleared on logout and account change. Zero AI provider secrets exist on mobile or web.

#### Rate Limiting & Quota Management
- **General Abuse Limiter:** HTTP layer (default 60 requests / 10 minutes) protecting against rapid messaging/spam. Returns `CHATBOT_RATE_LIMITED`.
- **AI Quota Limiter:** In-memory sliding window tracker (default 20 requests / 10 minutes, 50 requests / 24 hours per user). Substantive semantic router queries consume 1 AI token.
- **Zero-Cost Fast Paths:** Only exact trivial single-purpose greetings/thanks and UI selector continuations (`structuredClarification`) bypass AI quota consumption.
- **Provider 429 Distinction:** Upstream Gemini HTTP 429 exhaustion maps to `AI_PROVIDER_RATE_LIMITED`. If composer encounters provider 429 during live-tool execution, it silently returns the factual deterministic answer.

#### Additive Response Contract
```json
{
  "answer": "string",
  "fallback": false,
  "fallbackReason": null,
  "sessionId": "uuid",
  "responseType": "SOCIAL" | "CLARIFICATION" | "LIVE_DATA" | "RAG" | "FALLBACK",
  "clarificationType": "PARISH" | "DOCUMENT_TYPE" | "SCHEDULE_EVENT" | "DATE" | null,
  "clarificationOptions": [{ "label": "string", "value": "string" }],
  "structuredClarification": {
    "originalQuestion": "string",
    "originalIntent": "string",
    "toolId": "string",
    "collected": {},
    "missing": "string"
  },
  "liveData": { "label": "Current TESTIMONIUM Data", "asOf": "ISO8601", "parishId": 1 },
  "conversationContext": {
    "lastIntent": "string",
    "lastParishId": 1,
    "lastParishName": "string",
    "lastDocumentType": "string",
    "lastScheduleEvent": "string",
    "lastDatePhrase": "string",
    "lastResponseType": "string"
  },
  "sources": []
}
```



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

Knowledge base operations (`PATCH /chatbot/knowledge/:id`, `POST /chatbot/knowledge/:id/confirm`, `POST /chatbot/knowledge/:id/publish`, `POST /chatbot/knowledge/:id/retire`, and `POST /chatbot/knowledge/:id/retry-embedding`) enforce strict optimistic concurrency control via a required positive integer `expectedVersion`. Concurrent or stale updates are rejected with `409 KNOWLEDGE_CONCURRENCY_CONFLICT`.

## Caloy Control Center Admin APIs & Telemetry Architecture

The Caloy Control Center provides centralized operational management for the diocesan virtual assistant:

### Endpoints
All endpoints are mounted under `/api/v1/chatbot/admin` and require `DIOCESE_COORDINATOR` role authorization:

- `GET /chatbot/admin/overview`: System availability status (`ACTIVE`, `DISABLED_BY_COORDINATOR`, `DISABLED_BY_DEPLOYMENT`, `CONFIGURATION_WARNING`, `CONFIGURATION_DEGRADED`, `CONFIGURATION_ERROR`), explicit runtime-config database health, model/credential readiness, canonical query/provider metrics, recent safe error metadata, and knowledge health.
- `GET /chatbot/admin/analytics`: Aggregated usage telemetry over presets (`today`, `7d`, `30d`, `90d`, `custom`) and optional parish context filter. Provider operations use the canonical `GENERATE_CONTENT` and `EMBED_CONTENT` values; provider failures are reported separately from user-query failures. Query metrics honor all requested filters. Provider metrics are global across parishes but date/model filtered and declare `providerMetricsScope: GLOBAL_DATE_AND_MODEL_FILTERED`. Manila calendar buckets are generated without database-session timezone assumptions.
- `GET /chatbot/admin/settings`: Effective vs. configured runtime settings, master deployment gate state, approved model catalog, read-only component descriptors (Semantic Router and Embedding Engine), and safe numeric constraints.
- `PATCH /chatbot/admin/settings`: Atomic versioned update with optimistic concurrency (`expectedVersion`). When no row exists, `expectedVersion: 0` atomically creates row `id = 1`. Stale saves return `409 CONFIG_VERSION_CONFLICT`. Supports runtime enable/disable, generation model selection from the backend compatibility catalog, user question limits (10m, daily), request deadline (5s-28s), and automatic retention toggle. Partial quota updates are validated against the merged persisted values. The configuration mutation and required activity audit share one database transaction; an audit failure rolls back the mutation.
- `GET /chatbot/admin/logs`: Paginated operational logs table with strict projection omitting question, response text, userId, and sessionId. Supports filters for date range, responseType, outcome (`success`/`fallback`), category, and parish context.
- `GET /chatbot/admin/logs/purge-preview`: Informational preview for the server-owned `daysOlderThan` parameter (integer 14-365). The server computes and returns the cutoff and current matching counts; clients cannot submit an absolute or future cutoff.
- `POST /chatbot/admin/logs/purge`: Authoritative manual purge for `daysOlderThan` (integer 14-365) using batched 5,000-row loops. Preview counts are never trusted for execution. Manual and automatic callers share the renewable `CALOY_TELEMETRY_PURGE` lease. A durable `STARTED` audit is required before deletion; lease loss stops future batches and returns committed counts as partial work, and completion/failure is audited separately.
- `GET /chatbot/admin/knowledge-stats`: Summaries of source statuses, chunk statuses, RAG query counts, insufficient evidence fallbacks, average top retrieval cosine similarity scores, and read-only embedding configuration.

### Architectural Invariants
- **Runtime Override, Last-Known-Good, and Fail-Closed Reads**: The migration creates `caloy_runtime_config` empty. A successful database read returning no row uses validated environment configuration (`runtimeOverridePresent: false`, `version: 0`). After a successful read, later database failures preserve an immutable last-known-good snapshot and report `CONFIGURATION_DEGRADED`; a cold database failure has no trusted runtime state, disables Caloy and automatic retention, and reports `CONFIGURATION_ERROR`. Environment fallback is never substituted for an unverified database failure.
- **Request Snapshot Isolation**: At the start of every parishioner Caloy request, one immutable configuration snapshot is captured and used throughout the entire query pipeline (routing, quotas, RAG, composition). Settings changes mid-flight never produce mixed-model or mixed-limit responses.
- **One Root Request Deadline**: The configured `chatbotRequestDeadlineMs` (5,000-28,000 ms) creates one root deadline and one `AbortSignal` shared by semantic routing, query embeddings, retrieval, RAG generation, social composition, and live-tool composition. Retries consume the remaining budget and do not receive a fresh timeout.
- **Provider Concurrency Safety**: Provider adapters and composers use immutable per-model caching `Map<model, adapter>` rather than mutating `.model` on shared singleton instances. Social and live-tool composers receive the request snapshot's effective generation model, trace ID, and root abort signal.
- **Model Readiness**: Compatibility is determined by a deliberate server catalog. A deployment environment value is configuration, not automatic approval. Runtime overrides may fall back only to a known-compatible deployment model; missing credentials or no valid compatible model keeps Caloy fail-closed and is reflected in Overview/Settings.
- **Dedicated Components**: The Semantic Intent Router remains fixed on its dedicated model. The Embedding Engine remains fixed and read-only.
- **Safe Provider Telemetry**: Every SDK generation and embedding attempt (including retries) is measured in `ai_usage_events` via `traceId` correlation without persisting user questions, model response text, or credentials. Telemetry writes are best-effort and never fail live user queries.
- **Privacy Guarantee**: Admin logs and APIs explicitly omit raw user message text, assistant response text, user IDs, and session IDs.
- **Retention Worker**: Startup starts the scheduler, not an unconditional delayed purge. Automatic retention is eligible only from 03:00 through 03:59 Asia/Manila and at most once per Manila calendar day. Instances contend for `CALOY_TELEMETRY_RETENTION:YYYY-MM-DD`; a successful daily marker is retained, while a failed attempt releases it for retry. The destructive purge itself uses the shared renewable `CALOY_TELEMETRY_PURGE` lease. If runtime database state cannot be verified, retention performs no deletion.
- **Frontend Authorization**: Caloy navigation tabs and routes are gated by their declared permissions. Purge controls require `MANAGE_CALOY_LOGS`, while read-only log access requires `VIEW_CALOY_LOGS`.
- **Legacy Knowledge Base Redirects**: Legacy `/knowledge-base` and `/knowledge-base/:id` URLs redirect with HTTP 301/replace navigation to `/caloy/knowledge-base` and `/caloy/knowledge-base/:id`.
- **Conversation Review Removal**: Conversation review routes, models, transcript viewers, and reporting infrastructure are completely removed.

## Integration notes

- Web portal base URLs: `VITE_API_BASE_URL` (parishioner portal) and `VITE_API_URL` (admin portal).
- Mobile application base URL: `EXPO_PUBLIC_API_BASE_URL`.
- All mutation endpoints must be protected by authentication, role middleware, and strict request schema validation.
- Cloudflare R2 object keys are stored securely in database tables; storage credentials are never exposed to web or mobile clients.

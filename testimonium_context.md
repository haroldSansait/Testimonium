# TESTIMONIUM Project Context

**Last reconciled:** 13 September 2026
**Status:** Canonical system orientation and architectural map for contributors.

## System map

```text
testimonium/
├── testimonium-backend/          Express 5 REST API and Prisma schema (PostgreSQL)
├── testimonium-parishioner-web/  Parishioner React 19/Vite 8 web portal
├── testimonium-admin-portal/     Staff and diocesan React 19/Vite 8 admin portal
├── testimonium-parishioner-app/  Parishioner Expo SDK 57 / React Native mobile app
├── API_DOCUMENTATION.md          Registered API surface and contracts
├── DATABASE.md                   Database operations and migration policy
├── Testimonium_Database_Schema.md Authoritative database schema reference (30 models, 26 enums)
├── CLOUDFLARE_R2.md              Upload, storage, and OCR pipeline specification
└── DEPLOYMENT.md                 Production checklist and deployment architecture
```

## Runtime architecture

- **Backend:** Node.js ESM, Express 5, Prisma 7/`@prisma/adapter-pg`, PostgreSQL (`pgvector`), Firebase Admin, AWS S3 SDK configured for Cloudflare R2, Sharp, OCR provider adapters, `IdempotencyService`, authoritative `SchedulingConfiguration`/`BookingValidator`, centralized conflict helper and domain service (`ScheduleAvailabilityDomainService`), heuristic recommendation algorithm, transactional `EmailOutboxWorker`, Gemini AI integration (`gemini-3.5-flash-lite`, `gemini-embedding-2`), 16 authoritative server-executed live tools, grounded response composer, and background `knowledgeEmbeddingWorker`.
- **Parishioner Web:** React 19, React Router, Firebase client auth, Leaflet, Vite. `VITE_PROVIDER_MODE` supports `api` and `demo`. Features drawer-based Caloy virtual assistant with progressive reveal and sources accordion.
- **Admin Portal:** React 19, React Router, Firebase client auth, Leaflet, Vite. `VITE_DATA_PROVIDER` accepts `api`, `demo`, or `hybrid`. Includes verified payment analytics, council photo management, and full Knowledge Base governance.
- **Parishioner Mobile App:** Expo SDK 57, React Native 0.86, React 19, TypeScript 6, native `@react-native-firebase/auth`, `@react-native-google-signin/google-signin`, TanStack Query, and Expo Router. Modernized 5-tab layout (`(home)`, `(caloy)`, `quick-actions` CenterActionButton, `(notifications)`, `(profile)`), `QuickActionSheet`, dedicated full-screen Caloy chat with session caching (`testimonium_caloy_context_v1:<uid>`), and deep-link routing. Communicates directly with `/api/v1` (with `npm run dev:mobile` supporting local Android device testing over Cloudflare Quick Tunnel).
- **Storage and Verification:** Document attachments, authorization letters, council officer photos, and receipts are stored in Cloudflare R2; receipts are asynchronously retrieved, Sharp-optimized in memory, parsed via OCR, cached in process, and flagged for duplicate hashes while remaining subject to mandatory staff verification. Secure attachments are streamed via authenticated backend download endpoints.

## Current API modules

All API routes are mounted under `/api/v1` across 22 functional modules:
`health`, `auth`, `dashboard`, `document-requests`, `document-requirements`, `parish-availabilities`, `requests`, `payment`, `parishes`, `users`, `schedule-requests`, `schedule-availability`, `reports`, `notifications`, `calendar`, `activity-log`, `diocese`, `analytics`, `mass-schedules`, `parish-events`, `priest/personal-schedules`, and `chatbot`.

## Tenancy and role model

| Role | Boundary |
| --- | --- |
| `PARISHIONER` | Own profile, document requests, receipt uploads (with attempt versioning), schedule bookings with preferred priest selection, in-app notifications, Caloy assistant queries, and public discovery feeds across web and mobile. |
| `SECRETARY` | Parish-scoped request processing, payment review, verified payment analytics, availability blocks, mass templates, weekday/date rules, daily reports, parish events, council officer photos, and emergency rescheduling. |
| `PRIEST` | Personal commitment calendar management (`/priest/personal-schedules`), parish-scoped operational schedule/event views, read-only scheduling rules, and liturgical assignment responses. |
| `DIOCESE_COORDINATOR` | Cross-parish administration, directory management, interactive map configuration, weekday/date rules, daily reports, system analytics, verified payment feeds, Knowledge Base governance, and audit log retention. |

Staff tenancy is strictly derived from verified server identity, not client parameters. Parishioner mutations require a completed user profile (full name and contact number).

## Data model and workflows

The Prisma schema defines 30 models and 26 enums across identity, parish and council governance, documents and payments, scheduling and personal calendars, notifications, FAQ, audit, Mass templates, events, reports, transactional email, idempotency, and the governed AI/RAG knowledge source, chunk, and chatbot telemetry records.

- **Document Requests:** Draft creation, fee snapshots, supporting file and authorization letter uploads, staff review cycles, correction requests/resubmissions, authenticated download streaming, payment proof uploads, and immutable history logging.
- **Payments & Analytics:** R2 storage, receipt attempt versioning (`attempt_version`, `is_superseded`) preserving full audit history while enforcing at most one active receipt per transaction, SHA-256 duplicate image detection, OCR reference/amount extraction, staff verification workflows, and paginated verified payment analytics (`GET /analytics/payments/verified`) with Manila timezone boundaries and server-side search.
- **Scheduling:** 16 canonical event types, backend-enforced parish event settings (services, time slots, daily/per-slot capacities), persisted weekday/date rules, availability range checks, dynamic slot calculation, constraint-based recommendation algorithm with heuristic ranking, preferred priest requests (`requested_priest_id`), row-locked booking/configuration writes, reschedule negotiation, emergency rescheduling with version bumping, append-only `ScheduleHistory`, and database-backed idempotency key deduplication.
- **Priest Personal Calendar:** Discrete `priest_personal_schedules` records with interval check constraints (`end_at > start_at`), optimistic versioning, and unified calendar conflict prevention across parish scheduling and personal commitments.
- **Parish Governance:** Parish Pastoral Council (PPC) and optional Parish Finance Council (PFC) administration with position titles, member sorting, officer photos stored in R2 (`photo_object_key`, `photo_url`), dormant state preservation when PFC is toggled off, optimistic concurrency versioning, and public directory visibility.
- **Caloy AI & RAG Knowledge Base:** Gemini semantic intent routing, 16 registered authoritative server-executed live tools, grounded response composer with fact preservation, multilingual mirroring, pgvector procedural retrieval (`gemini-embedding-2`), and coordinator knowledge base governance (`knowledge_sources`, `knowledge_chunks`, `chatbot_logs`).
- **Mobile Integration:** Complete parity with parishioner web capabilities, including camera/gallery receipt capture with HEIC conversion, modernized 5-tab navigation with central `QuickActionSheet`, dedicated Caloy assistant experience, multi-step wizards, and deep-link routing.
- **Transactional Outbox:** Guaranteed document-lifecycle and schedule status email dispatch via PostgreSQL transactional `email_outbox` claimed with `FOR UPDATE SKIP LOCKED`, honoring user-configurable `emailNotificationsEnabled` preferences.

## Contributor guardrails

- Update routes, validation schemas, controllers/services, web providers, mobile services, and documentation in lockstep.
- Create explicit Prisma migrations for schema changes; never use `prisma db push` in production.
- Keep R2 object keys in the database and never expose storage credentials or direct database connections to web or mobile clients.
- Build and verify all clients before handoff (`npm run build:all`, `npm test` across backend and mobile).

# TESTIMONIUM Project Context

**Last reconciled:** 31 August 2026
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
├── Testimonium_Database_Schema.md Authoritative database schema reference (24 models)
├── CLOUDFLARE_R2.md              Upload, storage, and OCR pipeline specification
└── DEPLOYMENT.md                 Production checklist and deployment architecture
```

## Runtime architecture

- **Backend:** Node.js ESM, Express 5, Prisma 7/`@prisma/adapter-pg`, PostgreSQL, Firebase Admin, AWS S3 SDK configured for Cloudflare R2, Sharp, OCR provider adapters, `IdempotencyService`, authoritative `SchedulingConfiguration`/`BookingValidator`, and transactional `EmailOutboxWorker`.
- **Parishioner Web:** React 19, React Router, Firebase client auth, Leaflet, Vite. `VITE_PROVIDER_MODE` supports `api` and `demo`.
- **Admin Portal:** React 19, React Router, Firebase client auth, Leaflet, Vite. `VITE_DATA_PROVIDER` accepts `api`, `demo`, or `hybrid`.
- **Parishioner Mobile App:** Expo SDK 57, React Native 0.86, React 19, TypeScript 6, native `@react-native-firebase/auth`, `@react-native-google-signin/google-signin`, TanStack Query, and Expo Router. Communicates directly with `/api/v1` (with `npm run dev:mobile` supporting local Android device testing over Cloudflare Quick Tunnel).
- **Storage and Verification:** Document attachments and receipts are stored in Cloudflare R2; receipts are asynchronously retrieved, Sharp-optimized in memory, parsed via OCR, cached in process, and flagged for duplicate hashes while remaining subject to mandatory staff verification.

## Current API modules

All API routes are mounted under `/api/v1`:
`health`, `auth`, `dashboard`, `document-requests`, `document-requirements`, `parish-availabilities`, `requests`, `payment`, `parishes`, `users`, `schedule-requests`, `schedule-availability`, `reports`, `notifications`, `calendar`, `activity-log`, `diocese`, `analytics`, `mass-schedules`, and `parish-events`.

## Tenancy and role model

| Role | Boundary |
| --- | --- |
| `PARISHIONER` | Own profile, document requests, receipts, schedule bookings, in-app notifications, and public discovery feeds across web and mobile. |
| `SECRETARY` | Parish-scoped request processing, payment review, availability blocks, mass templates, weekday/date rules, daily reports, and parish events. |
| `PRIEST` | Parish-scoped operational schedule/event views, read-only scheduling rules, and liturgical assignment responses. |
| `DIOCESE_COORDINATOR` | Cross-parish administration, directory management, interactive map configuration, weekday/date rules, daily reports, system analytics, and audit log retention. |

Staff tenancy is strictly derived from verified server identity, not client parameters.

## Data model and workflows

The Prisma schema defines 24 models: the original identity, parish, document, payment, scheduling, notification, FAQ, audit, Mass-template, event, and idempotency records plus normalized parish weekday rules, service weekday rules, date rules and service overrides, daily reports, and the transactional email outbox.

- **Document Requests:** Draft creation, fee snapshots, supporting file uploads, staff review cycles, correction requests/resubmissions, payment proof uploads, and immutable history logging.
- **Payments:** R2 storage, SHA-256 duplicate image detection, OCR reference/amount extraction, and staff verification workflows.
- **Scheduling:** 16 canonical event types, backend-enforced parish event settings (services, time slots, daily/per-slot capacities), persisted weekday/date rules, availability range checks, dynamic slot calculation, row-locked booking/configuration writes, reschedule negotiation, and database-backed idempotency key deduplication.
- **Mobile Integration:** Complete parity with parishioner web capabilities, including camera/gallery receipt capture with HEIC conversion, multi-step document and scheduling wizards, and deep-link routing.
- **Transactional Outbox:** Guaranteed document-ready and schedule status email dispatch via PostgreSQL transactional `email_outbox` claimed with `FOR UPDATE SKIP LOCKED`.

## Contributor guardrails

- Update routes, validation schemas, controllers/services, web providers, mobile services, and documentation in lockstep.
- Create explicit Prisma migrations for schema changes; never use `prisma db push` in production.
- Keep R2 object keys in the database and never expose storage credentials or direct database connections to web or mobile clients.
- Build and verify all clients before handoff (`npm run build:all`, `npm test` across backend and mobile).

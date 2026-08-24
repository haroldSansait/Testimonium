# TESTIMONIUM Project Context

**Last reconciled:** 24 August 2026
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
├── Testimonium_Database_Schema.md Authoritative database schema reference (18 models)
├── CLOUDFLARE_R2.md              Upload, storage, and OCR pipeline specification
└── DEPLOYMENT.md                 Production checklist and deployment architecture
```

## Runtime architecture

- **Backend:** Node.js ESM, Express 5, Prisma 7/`pg`, PostgreSQL, Firebase Admin, AWS S3 SDK configured for Cloudflare R2, Sharp, OCR provider adapters, `IdempotencyService`, and authoritative `SchedulingConfiguration`/`BookingValidator`.
- **Parishioner Web:** React 19, React Router, Firebase client auth, Leaflet, Vite. `VITE_PROVIDER_MODE` supports `api` and `demo`.
- **Admin Portal:** React 19, React Router, Firebase client auth, Leaflet, Vite. `VITE_DATA_PROVIDER` accepts `api`, `demo`, or `hybrid`.
- **Parishioner Mobile App:** Expo SDK 57, React Native 0.86, React 19, TypeScript 6, native `@react-native-firebase/auth`, `@react-native-google-signin/google-signin`, TanStack Query, and Expo Router. Communicates directly with `/api/v1` (with `npm run dev:mobile` supporting local Android device testing over Cloudflare Quick Tunnel).
- **Storage and Verification:** Document attachments and receipts are stored in Cloudflare R2; receipts are asynchronously retrieved, Sharp-optimized in memory, parsed via OCR, cached in process, and flagged for duplicate hashes while remaining subject to mandatory staff verification.

## Current API modules

All API routes are mounted under `/api/v1`:
`health`, `auth`, `dashboard`, `document-requests`, `document-requirements`, `parish-availabilities`, `requests`, `payment`, `parishes`, `users`, `schedule-requests`, `notifications`, `calendar`, `activity-log`, `diocese`, `analytics`, `mass-schedules`, and `parish-events`.

## Tenancy and role model

| Role | Boundary |
| --- | --- |
| `PARISHIONER` | Own profile, document requests, receipts, schedule bookings, in-app notifications, and public discovery feeds across web and mobile. |
| `SECRETARY` | Parish-scoped request processing, payment review, availability blocks, mass templates, and parish events. |
| `PRIEST` | Parish-scoped operational schedule/event views and liturgical assignment responses. |
| `DIOCESE_COORDINATOR` | Cross-parish administration, directory management, interactive map configuration, system analytics, and audit log retention. |

Staff tenancy is strictly derived from verified server identity, not client parameters.

## Data model and workflows

The Prisma schema defines 18 models: `roles`, `parishes`, `users`, `document_requests`, `request_attachments`, `payment_transactions`, `receipt_uploads`, `ocr_results`, `request_history`, `schedules`, `parish_availabilities`, `notifications`, `faq_knowledge_base`, `chatbot_logs`, `activity_logs`, `mass_schedule_templates`, `parish_events`, and `idempotency_keys`.

- **Document Requests:** Draft creation, fee snapshots, supporting file uploads, staff review cycles, correction requests/resubmissions, payment proof uploads, and immutable history logging.
- **Payments:** R2 storage, SHA-256 duplicate image detection, OCR reference/amount extraction, and staff verification workflows.
- **Scheduling:** 16 canonical event types, backend-enforced parish event settings (services, time slots, daily/per-slot capacities), availability range checks, dynamic slot calculation, reschedule negotiation, and database-backed idempotency key deduplication.
- **Mobile Integration:** Complete parity with parishioner web capabilities, including camera/gallery receipt capture with HEIC conversion, multi-step document and scheduling wizards, and deep-link routing.

## Contributor guardrails

- Update routes, validation schemas, controllers/services, web providers, mobile services, and documentation in lockstep.
- Create explicit Prisma migrations for schema changes; never use `prisma db push` in production.
- Keep R2 object keys in the database and never expose storage credentials or direct database connections to web or mobile clients.
- Build and verify all clients before handoff (`npm run build:all`, `npm test` across backend and mobile).

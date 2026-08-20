# TESTIMONIUM Project Context

**Last reconciled:** 20 August 2026

This is a concise orientation document for contributors. It describes the current repository shape and implemented boundaries, not a future roadmap.

## System map

```text
testimonium/
├── testimonium-backend/          Express API and Prisma schema
├── testimonium-parishioner-web/  Parishioner React/Vite portal
├── testimonium-admin-portal/     Staff and diocesan React/Vite portal
├── testimonium-parishioner-app/  Expo mobile scaffold
├── API_DOCUMENTATION.md          Registered API surface
├── DATABASE.md                   Database operations
├── Testimonium_Database_Schema.md
├── CLOUDFLARE_R2.md              Upload and OCR integration
└── DEPLOYMENT.md                 Production checklist
```

The root `package.json` uses `concurrently` to run the backend and both web portals. It does not make the applications a single deployable process.

## Runtime architecture

- **Backend:** Node.js ESM, Express 5, Prisma 7/`pg`, PostgreSQL, Firebase Admin, AWS S3 SDK configured for Cloudflare R2, Sharp, and OCR provider adapters.
- **Parishioner web:** React 19, React Router, Firebase client auth, Leaflet, Vite. `VITE_PROVIDER_MODE` selects `api` or `demo` (default is `demo`).
- **Admin portal:** React 19, React Router, Firebase client auth, Leaflet, Vite. `VITE_DATA_PROVIDER` accepts `api`, `demo`, or `hybrid` (default is `demo`).
- **Storage and verification:** originals are stored in R2; receipts are asynchronously fetched, optimized in memory for OCR, parsed, cached in process, and remain subject to manual payment verification.

## Current API modules

All API routes are mounted under `/api/v1`. Registered modules are: `health`, `auth`, `dashboard`, `document-requests`, `document-requirements`, `parish-availabilities`, `requests`, `payment`, `parishes`, `users`, `schedule-requests`, `notifications`, `calendar`, `activity-log`, `diocese`, `analytics`, `mass-schedules`, and `parish-events`.

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for the method-level catalog.

## Tenancy and role model

| Role | Boundary |
| --- | --- |
| `PARISHIONER` | Own profile, document requests, receipts, and scheduling requests; authenticated discovery feeds. |
| `SECRETARY` | Parish-scoped request processing, settings, availability, mass templates, and events. |
| `PRIEST` | Parish-scoped operational views and priest-assignment responses. |
| `DIOCESE_COORDINATOR` | Cross-parish administration, user and directory management, analytics, and audit-log administration. |

Tenant guards derive the effective parish from staff identity where applicable; do not trust a client-supplied `parishId` to widen staff access.

## Data model and workflows

The Prisma schema currently defines 17 models: roles, parishes, users, document requests, attachments, payments, receipt uploads, OCR results, request history, schedules, availabilities, notifications, FAQs, chatbot logs, activity logs, mass templates, and parish events. The schema file is the canonical database contract: `testimonium-backend/prisma/schema.prisma`.

Document requests keep a fee snapshot, correction notes/required IDs, payment-state fields, and append-only request-history records. Payment receipts create a payment transaction and OCR result, transition the request to `PAYMENT_UNDER_REVIEW`, and are not automatically approved. Schedules support availability checks, reschedule proposals, and priest responses.

## Contributor guardrails

- Update route, validation, controller/service, portal provider, and documentation together when changing a contract.
- Add a Prisma migration for persisted schema changes; do not use `db push` as a production migration path.
- Keep R2 object keys in the database and avoid exposing storage credentials to either browser.
- Treat `ENABLE_DEV_AUTH=true`, in-memory rate limiting, and demo data as development-only features.
- Build both portals before a cross-portal handoff: `npm run build:all`.

# TESTIMONIUM Portal Suite

TESTIMONIUM is the Roman Catholic Diocese of San Carlos portal suite for sacramental-document requests, parish scheduling, parish-directory management, and diocesan administration.

**Implementation snapshot: 14 September 2026.** The backend routes and Prisma schema are the operational source of truth; this guide links to the focused reference documents in this repository.

## Applications

| Application | Purpose | Development address |
| --- | --- | --- |
| `testimonium-backend` | Express 5 REST API, Prisma 7, PostgreSQL, Firebase Admin, R2, OCR, Gemini AI, and SMTP | `http://localhost:5000` |
| `testimonium-parishioner-web` | React 19/Vite 8 parishioner web portal | `http://localhost:5173` |
| `testimonium-admin-portal` | React 19/Vite 8 portal for secretaries, priests, and coordinators | `http://localhost:5174` |
| `testimonium-parishioner-app` | Expo SDK 57 / React Native parishioner mobile application | `http://localhost:8081` (Metro) |

The two web portals are separate Vite applications. The mobile application is built with Expo Router and React Native. All clients share the backend and Firebase project while enforcing strict role boundaries and tenant isolation.

## What is implemented

- **Identity and Security:** Firebase-authenticated role-based access for parishioners, secretaries, priests, and diocese coordinators. JIT Google authentication, single-flight email verification, profile completion gates (`fullName` and `contactNumber`), user-configurable transactional email preferences, and isolated session lifecycles.
- **Sacramental Document Requests:** Multi-step request wizard, draft persistence, document fee snapshots, supporting-file and authorization-letter uploads (PDF/image), authenticated private download streaming, tracking numbers, request history, staff review, and structured correction resubmission.
- **Payment and Cloudflare R2 Pipeline:** Parish payment QR code management, client receipt acquisition (with mobile HEIC conversion), R2 object storage, receipt attempt versioning (`attempt_version`, `is_superseded`) preserving complete payment history while enforcing at most one active attempt per transaction, SHA-256 duplicate detection, asynchronous OCR enrichment, and mandatory staff verification.
- **Parish Scheduling and Availability:** Authoritative backend parish scheduling configuration (enabled canonical services, time slots, daily and per-slot capacity limits), persisted parish/service weekday rules, date-specific overrides, availability date ranges, dynamic slot calculation, constraint-based scheduling recommendation algorithm with heuristic ranking, preferred priest selection (`requested_priest_id`), row-locked booking validation, reschedule proposals/responses, emergency rescheduling with version bumping, append-only `ScheduleHistory` auditing, and database-backed idempotency.
- **Priest Personal Commitments:** Dedicated calendar management module (`/priest/personal-schedules`) with interval check constraints (`end_at > start_at`) and optimistic versioning, integrated into centralized parish conflict detection.
- **Parish Directory and Governance:** Parish directory with search and municipality filtering, contact and location information, public monthly event discovery feed, interactive map configuration for coordinators, mass schedule templates, and Parish Pastoral Council (PPC) and Parish Finance Council (PFC) governance with officer portrait photos stored in Cloudflare R2, member ordering, toggleable finance council with dormant state preservation, and optimistic versioning.
- **Caloy AI Virtual Assistant & Centralized Control Center:** Gemini-powered (`gemini-3.5-flash-lite`) natural language understanding, 16 registered authoritative server-executed live tools, runtime canonical fact preservation, grounded response composer, native multilingual code-switching (English, Tagalog, Cebuano, Hiligaynon, Taglish), `pgvector` procedural retrieval (`gemini-embedding-2`, 768 dimensions), multi-stage coordinator governance (DRAFT -> CONFIRMED -> ACTIVE -> RETIRED), and centralized Caloy Control Center (`/caloy` — Overview, Analytics, Knowledge Base, AI Settings, Logs) with runtime configuration snapshotting, monotonic deadlines, and privacy-safe SDK telemetry (`ai_usage_events`).
- **Parishioner Mobile Experience:** Full-featured native mobile app with modernized 5-tab layout (`(home)`, `(caloy)`, `quick-actions` CenterActionButton, `(notifications)`, `(profile)`), `QuickActionSheet`, dedicated Caloy assistant screen, Document Request Wizard, Payment/Receipts with attempt history, Scheduling Wizard with priest preferences and heuristic suggestions, In-App Notifications with live badges, Profile & Settings, Deep-linking, and Error Boundaries.
- **Administration, Reports, Analytics, and Workers:** Role-scoped dashboards, parish/diocese daily reports, descriptive multi-domain analytics telemetry deck with trend charts, paginated verified payment details (`GET /analytics/payments/verified`) with Manila timezone boundaries and server-side search, public/private event visibility, in-app notifications, centralized canonical audit action types catalog, user directory administration, and three dedicated background workers: `EmailOutboxWorker` (PostgreSQL transactional email dispatch via SMTP), `knowledgeEmbeddingWorker` (vector embeddings), and `CaloyTelemetryRetentionWorker` (daily 03:00-03:59 Asia/Manila automated retention via database-clock `SystemLease`).

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL accessible by Prisma (Supabase PostgreSQL is supported)
- Firebase credentials for the backend, web clients, and mobile app (`google-services.json` for Android)
- Cloudflare R2 credentials; OCR.Space credentials only when live OCR is enabled
- Expo / EAS CLI (for mobile native builds and development)

## Local setup

1. Run `npm run install:all` from the repository root.
2. Copy each app’s `.env.example` to `.env` and configure database, Firebase, R2, and portal variables. The root template is a cross-application reference.
3. From `testimonium-backend`, run:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   node prisma/seed.js
   ```

4. Start the suite:

   ```bash
   npm run dev
   ```

   Or start mobile development with automated Cloudflare HTTPS tunnel:

   ```bash
   npm run dev:mobile
   ```

For local backend development without Firebase, set `ENABLE_DEV_AUTH=true` only in `testimonium-backend/.env`. Never use that setting in production.

## Useful commands

```bash
npm run dev                           # backend + both web portals
npm run dev:mobile                    # backend + Cloudflare Quick Tunnel + mobile Metro dev server
npm run backend                       # backend only
npm run parishioner                   # parishioner web portal only
npm run admin                         # admin portal only
npm run mobile                        # mobile app Metro bundler
npm run mobile:android                # run mobile app on connected Android device/emulator
npm run build:all                     # build both web portals
npm test --prefix testimonium-backend # run backend test suite
npm run test:dev-mobile               # run mobile dev tunnel script tests
```

## Architecture

```text
Parishioner Web  ──┐
Parishioner App  ──┼──> Express API (/api/v1) ──> PostgreSQL via Prisma (33 models, 26 enums)
Admin Portal     ──┘         │                     └──> pgvector (768-dim knowledge chunk embeddings)
                             ├──> Firebase Admin token verification
                             ├──> Cloudflare R2 (attachments, receipts, & officer photos)
                             ├──> OCR provider (asynchronous receipt enrichment)
                             ├──> Gemini AI (semantic intent router, live tools, grounded composer)
                             └──> Three Background Workers (Email Outbox, Knowledge Embeddings, Caloy Telemetry Retention)
```

## Documentation

- [Setup & Deployment Guide](SETUP.md)
- [API reference](API_DOCUMENTATION.md)
- [Database operations](DATABASE.md) and [schema reference](Testimonium_Database_Schema.md)
- [Cloudflare R2 and OCR pipeline](CLOUDFLARE_R2.md)
- [Production deployment](DEPLOYMENT.md)
- [Project context and implementation map](testimonium_context.md)
- [Mobile application documentation pack](testimonium-parishioner-app/00_MOBILE_DOCS_INDEX.md)
- [Backend developer guide](testimonium-backend/DEVELOPER_GUIDE.md)

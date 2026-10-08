# TESTIMONIUM Portal Suite

TESTIMONIUM is the Roman Catholic Diocese of San Carlos portal suite for sacramental-document requests, parish scheduling, parish-directory management, and diocesan administration.

**Implementation snapshot: 8 October 2026.** The backend routes and Prisma schema are the operational source of truth; this guide links to the focused reference documents in this repository.

## Applications

| Application | Purpose | Development address |
| --- | --- | --- |
| `testimonium-backend` | Express 5 REST API, Prisma 7, PostgreSQL, Firebase Admin, R2, OCR, Gemini AI, and SMTP | `http://localhost:5000` |
| `testimonium-parishioner-web` | React 19/Vite 8 parishioner web portal | `http://localhost:5173` |
| `testimonium-admin-portal` | React 19/Vite 8 portal for secretaries, priests, and coordinators | `http://localhost:5174` |
| `testimonium-parishioner-app` | Expo SDK 57 / React Native parishioner mobile application | `http://localhost:8081` (Metro) |

The two web portals are separate Vite applications. The mobile application is built with Expo Router and React Native. All clients share the backend and Firebase project while enforcing strict role boundaries and tenant isolation.

## What is implemented

- **Identity, Security, and Government ID Verification:** Firebase-authenticated role-based access for parishioners, secretaries, priests, and diocese coordinators. JIT Google authentication, single-flight email verification, profile completion gates (`fullName` and `contactNumber`), user-configurable transactional email preferences, and isolated session lifecycles. Full automated Government ID verification flow covering 5 Philippine card IDs (PhilSys / National ID, Driver's License, UMID, Voter's ID, Postal ID) using Sharp Laplacian variance sharpness checks (>= 15), distinct SHA-256 binary hash validation, concurrent front/back OCR Space processing, regex card classification with strength levels (`STRONG`, `SUPPORTING`, `SHARED`), deterministic card side orientation diagnostics (`FRONT_IS_BACK`, `BACK_IS_FRONT`, `BOTH_APPEAR_FRONT`, `BOTH_APPEAR_BACK`, `SIDES_SWAPPED`), Levenshtein legal name matching, and expiration date parsing. Stored in a dedicated private R2 bucket (`R2_IDENTITY_BUCKET_NAME`), concurrency-locked with `SystemLease` (`GOVERNMENT_ID_VERIFICATION:<userId>`), rate-limited per authenticated account (default 6 / 10m, configurable), streamed privately to Diocese Coordinators with robust 404/503 error handling, and automatically invalidated upon material legal name changes. Effective Government ID verification automatically fulfills the `valid_id` requirement for document requests and gates both document requests and appointments (`403 IDENTITY_NOT_VERIFIED` when unverified).
- **Legal Policy Governance & Dynamic Policy Gating:** Database-backed authoritative Terms of Service and Privacy Policy (`legal_policies`, enum `LegalPolicyType`), plain-text coordinator editor under Admin Portal Settings (`/settings`) guarded by `MANAGE_LEGAL_POLICIES` with CAS revision control (`v{revision}.0`) and SHA-256 content hash audit logging, public unauthenticated endpoint (`GET /legal-policies/current`), user registration & Google JIT legal validation requiring exact current version matching with stale-version rejection (`409 LEGAL_ACCEPTANCE_VERSION_CONFLICT`), and cross-platform dynamic legal gates (`LegalGate`, `useLegalPolicies`) on web and mobile preventing access to protected features until current policies are accepted.
- **Sacramental Document Requests & Hardened Workflow:** Multi-step request wizard, draft persistence, document fee snapshots, configurable requirement matrix (parish-customized checklists per document type toggled via canonical requirement IDs, with `valid_id` auto-satisfied by verified Government ID), supporting-file and authorization-letter uploads (PDF/image), authenticated private download streaming, tracking numbers, request history, staff review, internal staff signing stage (`READY_FOR_SIGNING` awaiting the primary priest's physical signature and triggering an in-app notification; mapped to Processing for parishioners), Priest parish-scoped read-only access (status mutations rejected with `403`), hardened correction flow with non-correctable requirement rejection (`valid_id` excluded and rejected via `400 NON_CORRECTABLE_REQUIREMENT`), legacy correction revalidation requiring effective Government ID verification (`403 IDENTITY_NOT_VERIFIED`), and bidirectional document type mapping (`getDocumentLabel`, `getCanonicalDocumentId`, `getDocumentTypeFilterParam`).
- **Payment and Cloudflare R2 Pipeline:** Parish payment QR code management, client receipt acquisition (with mobile HEIC conversion), R2 object storage, receipt attempt versioning (`attempt_version`, `is_superseded`) preserving complete payment history while enforcing at most one active attempt per transaction, SHA-256 duplicate detection, asynchronous OCR enrichment, and mandatory staff verification.
- **Parish Scheduling and Availability:** Authoritative backend parish scheduling configuration (enabled canonical services, time slots, daily and per-slot capacity limits), persisted parish/service weekday rules, date-specific overrides, availability date ranges, dynamic slot calculation, constraint-based scheduling recommendation algorithm with heuristic ranking, preferred priest selection (`requested_priest_id`), row-locked booking validation (requiring completed profile and verified Government ID), reschedule proposals/responses, emergency rescheduling with version bumping, append-only `ScheduleHistory` auditing, and database-backed idempotency.
- **Priest Personal Commitments:** Dedicated calendar management module (`/priest/personal-schedules`) with interval check constraints (`end_at > start_at`) and optimistic versioning, integrated into centralized parish conflict detection.
- **Parish Directory and Governance:** Parish directory with search and municipality filtering, Mother Parish designation (`is_mother_parish`, single mother parish per diocese enforced at database level with partial unique index), clergy assignment visibility (primary priest and assistant priests directory cards and drawer views), contact and location information, public monthly event discovery feed, interactive map configuration for coordinators, mass schedule templates, and Parish Pastoral Council (PPC) and Parish Finance Council (PFC) governance with officer portrait photos stored in Cloudflare R2, member ordering, toggleable finance council with dormant state preservation, and optimistic versioning.
- **Caloy AI Virtual Assistant & Centralized Control Center:** Gemini-powered (`gemini-3.5-flash-lite`) natural language understanding, 16 registered authoritative server-executed live tools, runtime canonical fact preservation, grounded response composer, native multilingual code-switching (English, Tagalog, Cebuano, Hiligaynon, Taglish), `pgvector` procedural retrieval (`gemini-embedding-2`, 768 dimensions), multi-stage coordinator governance (DRAFT -> CONFIRMED -> ACTIVE -> RETIRED), and centralized Caloy Control Center (`/caloy` — Overview, Analytics, Knowledge Base, AI Settings, Logs) with runtime configuration snapshotting, monotonic deadlines, and privacy-safe SDK telemetry (`ai_usage_events`).
- **Parishioner Mobile Experience:** Full-featured native mobile app with modernized 5-tab layout (`(home)`, `(caloy)`, `quick-actions` CenterActionButton, `(notifications)`, `(profile)`), `QuickActionSheet`, interactive native camera scanner with real-time card edge/alignment detection and perspective normalization (`GovernmentIdCameraScanner`), animated verifying scanning indicator (`GovernmentIdVerifyingAnimation`), single-flight attempt tracker (`GovernmentIdAttemptTracker`), targeted side retake guidance, dedicated Government ID verification wizard (`/profile/id-verification`), native legal onboarding and terms/privacy viewer screens, dedicated Caloy assistant screen, Document Request Wizard, Payment/Receipts with attempt history, Scheduling Wizard with priest preferences and heuristic suggestions, In-App Notifications with live badges, Request Status Timeline with `READY_FOR_SIGNING` mapped to Processing, Profile & Settings, Deep-linking, and Error Boundaries.
- **Administration, Reports, Analytics, and Workers:** Role-scoped dashboards, parish/diocese daily reports, descriptive multi-domain analytics telemetry deck with trend charts, paginated verified payment details (`GET /analytics/payments/verified`) with Manila timezone boundaries and server-side search, user directory administration with typed Government ID verification inspection and private card image streaming, public/private event visibility, in-app notifications, centralized canonical audit action types catalog, Document Requirement Assignment management and Legal Policies Editor in Settings, and three dedicated background workers: `EmailOutboxWorker` (PostgreSQL transactional email dispatch via SMTP), `knowledgeEmbeddingWorker` (vector embeddings), and `CaloyTelemetryRetentionWorker` (daily 03:00-03:59 Asia/Manila automated retention via database-clock `SystemLease`).

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL accessible by Prisma (Supabase PostgreSQL is supported)
- Firebase credentials for the backend, web clients, and mobile app (`google-services.json` for Android)
- Cloudflare R2 credentials (including dedicated private `R2_IDENTITY_BUCKET_NAME`); OCR.Space credentials for live receipt OCR and Government ID verification
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
Parishioner App  ──┼──> Express API (/api/v1) ──> PostgreSQL via Prisma (35 models, 29 enums)
Admin Portal     ──┘         │                     └──> pgvector (768-dim knowledge chunk embeddings)
                             ├──> Firebase Admin token verification
                             ├──> Cloudflare R2 (attachments, receipts, officer photos, & private identity bucket)
                             ├──> OCR provider (asynchronous receipt enrichment & synchronous Government ID verification)
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

### Relationship-based document evidence

All non-Self document requests now require an authorization letter and private front/back registrant Government ID images. Web and Mobile capture this evidence without replacing the account-level valid_id verification flow. Staff access is limited to same-parish Secretaries and Diocese Coordinators; Priests cannot view registrant IDs. OCR enrichment is asynchronous and advisory.

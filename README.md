# TESTIMONIUM Portal Suite

TESTIMONIUM is the Roman Catholic Diocese of San Carlos portal suite for sacramental-document requests, parish scheduling, parish-directory management, and diocesan administration.

**Implementation snapshot: 24 August 2026.** The backend routes and Prisma schema are the operational source of truth; this guide links to the focused reference documents in this repository.

## Applications

| Application | Purpose | Development address |
| --- | --- | --- |
| `testimonium-backend` | Express 5 REST API, Prisma 7, PostgreSQL, Firebase Admin, R2 and OCR | `http://localhost:5000` |
| `testimonium-parishioner-web` | React 19/Vite 8 parishioner web portal | `http://localhost:5173` |
| `testimonium-admin-portal` | React 19/Vite 8 portal for secretaries, priests, and coordinators | `http://localhost:5174` |
| `testimonium-parishioner-app` | Expo SDK 57 / React Native parishioner mobile application | `http://localhost:8081` (Metro) |

The two web portals are separate Vite applications. The mobile application is built with Expo Router and React Native. All clients share the backend and Firebase project while enforcing strict role boundaries and tenant isolation.

## What is implemented

- **Identity and Security:** Firebase-authenticated role-based access for parishioners, secretaries, priests, and diocese coordinators. JIT Google authentication, single-flight email verification, profile completion gates, and isolated session lifecycles.
- **Sacramental Document Requests:** Multi-step request wizard, draft persistence, document fee snapshots, supporting-file uploads (PDF/image), tracking numbers, request history, staff review, and structured correction resubmission.
- **Payment and Cloudflare R2 Pipeline:** Parish payment QR code management, client receipt acquisition (with mobile HEIC conversion), R2 object storage, SHA-256 duplicate detection, asynchronous OCR enrichment, and mandatory staff verification.
- **Parish Scheduling and Availability:** Authoritative backend parish scheduling configuration (enabled canonical services, time slots, daily and per-slot capacity limits), availability date ranges, dynamic slot calculation, reschedule proposals/responses, priest assignment, and database-backed idempotency deduplication.
- **Parish Directory and Events:** Parish directory with search and municipality filtering, contact and location information, public monthly event discovery feed, interactive map configuration for coordinators, and mass schedule templates.
- **Parishioner Mobile Experience:** Full-featured native mobile app (Phases 1–7 complete: Auth & Onboarding, Parish Directory & Home, Document Request Wizard, Payment/Receipts, Scheduling Wizard & Parity, In-App Notifications & Events, Profile & Settings, Deep-linking, and Error Boundaries).
- **Administration, Notifications, and Audit:** Role-scoped dashboards, in-app notifications with reference routing, audit logging with retention administration, user directory administration, and diocesan analytics.

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
npm run dev                    # backend + both web portals
npm run dev:mobile             # backend + Cloudflare Quick Tunnel + mobile Metro dev server
npm run backend                # backend only
npm run parishioner            # parishioner web portal only
npm run admin                  # admin portal only
npm run mobile                 # mobile app only
npm run build:all              # build both web portals
npm run test                   # run test suites across packages
```

## Architecture

```text
Parishioner Web  ──┐
Parishioner App  ──┼──> Express API (/api/v1) ──> PostgreSQL via Prisma
Admin Portal     ──┘         │
                             ├──> Firebase Admin token verification
                             ├──> Cloudflare R2 (document attachments & receipts)
                             └──> OCR provider (asynchronous receipt enrichment)
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


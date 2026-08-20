# TESTIMONIUM Portal Suite

TESTIMONIUM is the Roman Catholic Diocese of San Carlos portal suite for sacramental-document requests, parish scheduling, parish-directory management, and diocesan administration.

**Implementation snapshot: 20 August 2026.** The backend routes and Prisma schema are the operational source of truth; this guide links to the focused reference documents in this repository.

## Applications

| Application | Purpose | Development address |
| --- | --- | --- |
| `testimonium-backend` | Express 5 REST API, Prisma 7, PostgreSQL, Firebase Admin, R2 and OCR | `http://localhost:5000` |
| `testimonium-parishioner-web` | React 19/Vite 8 parishioner portal | `http://localhost:5173` |
| `testimonium-admin-portal` | React 19/Vite 8 portal for secretaries, priests, and coordinators | `http://localhost:5174` |
| `testimonium-parishioner-app` | Expo/React Native mobile-app scaffold | — |

The two web portals are separate Vite applications. They share the backend and Firebase project but have their own environment files and provider-mode switches.

## What is implemented

- Firebase-authenticated role-based access for parishioners, secretaries, priests, and diocese coordinators.
- Document-request drafts, submission, tracking, supporting-file uploads, correction cycles, payment review, and request history.
- Receipt upload to Cloudflare R2 with asynchronous OCR enrichment, hash-based duplicate detection, and mandatory staff review.
- Scheduling with availability blocks, slot/capacity controls, reschedule responses, priest assignment, parish events, and recurring mass templates.
- Parish directory, interactive map configuration, image and payment-QR management, dashboards, calendar, notifications, analytics, and audited administrative activity.

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL accessible by Prisma (Supabase PostgreSQL is supported)
- Firebase credentials for the backend and both web clients
- Cloudflare R2 credentials; OCR.Space credentials only when live OCR is enabled

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

For local backend development without Firebase, set `ENABLE_DEV_AUTH=true` only in `testimonium-backend/.env`. Never use that setting in production.

## Useful commands

```bash
npm run dev                    # backend + both web portals
npm run backend                # backend only
npm run parishioner            # parishioner web portal only
npm run admin                  # admin portal only
npm run build:all              # build both web portals
```

## Architecture

```text
Parishioner Web -> Express API (/api/v1) -> PostgreSQL via Prisma
Admin Portal     -> Firebase Admin token verification
                -> Cloudflare R2 (uploads) -> OCR provider (receipts)
```

## Documentation

- [API reference](API_DOCUMENTATION.md)
- [Database operations](DATABASE.md) and [schema reference](Testimonium_Database_Schema.md)
- [Cloudflare R2 and OCR pipeline](CLOUDFLARE_R2.md)
- [Production deployment](DEPLOYMENT.md)
- [Project context and implementation map](testimonium_context.md)
- [Backend developer guide](testimonium-backend/DEVELOPER_GUIDE.md)

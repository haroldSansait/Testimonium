# TESTIMONIUM Core API - Sprint Tracker

## Setup Log
- [x] 2026-07-04: Initialized npm package metadata with `npm init -y`.
- [x] 2026-07-04: Installed production dependencies for Express, security middleware, validation, Firebase Admin, Cloudflare R2 S3 access, Prisma, and PostgreSQL.
- [x] 2026-07-04: Installed development dependencies `nodemon` and `prisma`.
- [x] 2026-07-04: Ran `npx prisma init`; Prisma was already present, so the existing scaffold was preserved for idempotent configuration.
- [x] 2026-07-04: Ensured architecture folders exist: `config`, `controllers`, `routes`, `middlewares`, `services`, `repositories`, `validators`, `utils`, and `prisma`.
- [x] 2026-07-04: Configured `package.json` for ES Modules with `dev` and `start` scripts.
- [x] 2026-07-04: Configured Prisma for Supabase PostgreSQL and generated Prisma Client with Prisma 7.8.0.
- [x] 2026-07-04: Created modular Express scaffold with config, route, controller, service, repository, middleware, validator, and utility layers.
- [x] 2026-07-04: Created Firebase ID token authentication middleware without adding login/signup or custom JWT routes.
- [x] 2026-07-04: Created Cloudflare R2 service wrapper using the S3-compatible SDK and memory-only upload middleware.
- [x] 2026-07-04: Added `.env.example` and backend `README.md` setup/architecture documentation.
- [x] 2026-07-04: Validated Prisma schema, generated Prisma Client, passed JavaScript syntax checks, and verified `GET /api/v1/health` returned HTTP 200.
- [x] 2026-07-04: Drafted Phase 2 relational Prisma schema with Firebase-linked users, roles, parishes, document requests, requirements, schedules, notifications, FAQ entries, chatbot logs, and activity logs.
- [x] 2026-07-04: Added idempotent `prisma/seed.js` for roles and the seven Vicariate of Canlaon parish records from `address_parishes.md`.
- [x] 2026-07-04: Added Just-In-Time Firebase user provisioning through repository and service layers.
- [x] 2026-07-04: Added `checkRole([...allowedRoles])` role authorization middleware.
- [x] 2026-07-04: Moved Prisma seed configuration to `prisma.config.ts` under `migrations.seed` for Prisma 7.x and removed the legacy `package.json` Prisma seed block.
- [x] 2026-07-04: Validated Phase 2 Prisma schema and generated Prisma Client; first migration remains pending until Prisma schema engine can run against the database without sandbox `EPERM`.

## ðŸŸ© Phase 1: Foundation & Infrastructure
- [x] Initialize Node.js Express server boilerplate for TESTIMONIUM with custom health-check endpoints
- [x] Set up connection to cloud PostgreSQL and define base Prisma schemas
- [x] Implement global CORS configurations and JSON payload parsers
- [x] Connect AWS S3 SDK wrapper configured for Cloudflare R2 bucket streaming

## ðŸŸ¦ Phase 2: Authentication & User Profiles
- [x] Build Firebase ID token middleware parsing Bearer tokens from incoming headers
- [x] Define PostgreSQL-backed application role model after base Prisma models are approved
- [x] Implement role-based authorization blocks checking permissions (PARISHIONER, SECRETARY, PRIEST, DIOCESE_COORDINATOR)
- [x] Attach authenticated Firebase users to persisted TESTIMONIUM user profiles
- [x] Create idempotent seed data for roles and Vicariate of Canlaon parish records
- [x] Run first Prisma migration: `npx prisma migrate dev --name init_testimonium_relational_schema`
- [x] Run database seed against the migrated database: `npx prisma db seed`

## ðŸŸ¨ Phase 3: Core Transactional Endpoints
- [ ] Design document submission pathways saving metadata to DB and file streams to R2
- [ ] Create status update triggers allowing administrators to switch tracking states (PENDING -> VALIDATED -> READY_FOR_PICKUP)
- [ ] Build scheduling routes handling appointment logs and checking time conflicts

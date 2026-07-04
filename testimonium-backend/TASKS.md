# TESTIMONIUM Core API - Sprint Tracker

## 🟩 Phase 1: Foundation & Infrastructure
- [ ] Initialize Node.js Express server boilerplate for TESTIMONIUM with custom health-check endpoints
- [ ] Set up connection to cloud PostgreSQL and define base Prisma schemas
- [ ] Implement global CORS configurations and JSON payload parsers
- [ ] Connect AWS S3 SDK wrapper configured for Cloudflare R2 bucket streaming

## 🟦 Phase 2: Authentication & User Profiles
- [ ] Create `POST /api/auth/register` with `bcryptjs` password salting and hashing
- [ ] Create `POST /api/auth/login` returning state-signed JWT authentication tokens
- [ ] Build a reusable `protect` middleware parsing Bearer tokens from incoming headers
- [ ] Implement role-based authorization blocks checking permissions (PARISHIONER, SECRETARY, PRIEST, SUPERADMIN)

## 🟨 Phase 3: Core Transactional Endpoints
- [ ] Design document submission pathways saving metadata to DB and file streams to R2
- [ ] Create status update triggers allowing administrators to switch tracking states (PENDING -> VALIDATED -> READY_FOR_PICKUP)
- [ ] Build scheduling routes handling appointment logs and checking time conflicts
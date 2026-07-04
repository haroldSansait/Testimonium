# PHASE2_AGENT.md

Act as a Senior Software Engineer using VS Code Agent Mode.

## Context
- Workspace: testimonium-backend
- Backend scaffold (Phase 1) is complete and verified.
- Stack:
  - Express
  - Prisma 7
  - Supabase PostgreSQL
  - Firebase Authentication (Admin SDK)
  - Cloudflare R2
- Read BOTH:
  1. Testimonium_Database_Schema.md
  2. Phase2_Database_Specification.md

The second document supersedes conflicting parts of the first.

## Tasks

### 1. Build Prisma Schema
Translate the schema into prisma/schema.prisma while applying the revised specification.

Requirements:
- Remove password_hash.
- Add firebase_uid (UNIQUE).
- Rename name -> full_name.
- Replace file paths with R2 object keys.
- Use Prisma enums for roles, document types, request status, payment status, schedule status and notification type.
- Add indexes and foreign keys.
- Preserve all relationships.

### 2. Migration
Run:
npx prisma migrate dev --name init_testimonium_relational_schema

Verify migration succeeds.

### 3. Seed Data
Create prisma/seed.js.

Seed:
- Roles
- All Vicariate of Canlaon parishes/mission stations
- Configure package.json so `npx prisma db seed` works.

Seed must be idempotent using upsert.

### 4. Authentication Integration
Implement Just-In-Time provisioning.

Flow:
Firebase ID Token
→ Verify with firebase-admin
→ Lookup firebase_uid
→ Create local user if absent
→ Default role = PARISHIONER
→ Return application profile

Create roleMiddleware.js implementing:
checkRole([...allowedRoles])

### 5. Quality Checks
Run:
- npx prisma validate
- npx prisma generate
- npm run dev

Verify /api/v1/health returns HTTP 200.

### 6. TASKS.md
Update Phase 2 progress accurately.

If any command fails, diagnose, self-heal, retry, and explain the final fix before proceeding.

# TESTIMONIUM Backend — Developer Guide

> **Audience:** Contributors working on `testimonium-backend`.  
> **Purpose:** Backend lifecycle, Prisma workflows, troubleshooting, and recovery procedures.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Startup](#startup)
3. [Environment Configuration](#environment-configuration)
4. [Prisma Workflows](#prisma-workflows)
5. [Database Synchronization](#database-synchronization)
6. [Backend Restart Requirements](#backend-restart-requirements)
7. [Port Conflict Resolution](#port-conflict-resolution)
8. [Stale Prisma Client Recovery](#stale-prisma-client-recovery)
9. [Development Auth Bypass](#development-auth-bypass)
10. [Troubleshooting Reference](#troubleshooting-reference)

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Node.js | `v20.x LTS` | Use `node --version` to verify |
| npm | `v10.x` | Ships with Node.js 20 |
| Prisma CLI | `^7.8.0` | Installed as devDependency |
| PostgreSQL | Supabase-hosted | No local PostgreSQL install required |

> The backend uses **ES Modules** (`"type": "module"` in `package.json`). All imports must use the `.js` extension even when importing `.ts`-adjacent files.

---

## Startup

### From the root workspace (recommended)

```powershell
# From the testimonium/ root
npm run dev
```

This starts all three services simultaneously. The backend is labeled `[Backend]` in the concurrently output.

### Standalone backend only

```powershell
# From the testimonium/ root
npm run backend

# Or directly from the backend directory
npm run dev
```

The backend starts nodemon watching `server.js`. Changes to any `*.js` file in the backend directory trigger an automatic restart.

### Confirming the backend is running

```
GET http://localhost:5000/
```

Expected response:
```json
{
  "name": "TESTIMONIUM Backend API",
  "status": "online",
  "version": "v1"
}
```

Or use the health endpoint:
```
GET http://localhost:5000/api/v1/health
```

---

## Environment Configuration

Copy `.env.example` to `.env` and fill in all values before first startup.

```powershell
copy .env.example .env
```

### Critical variables

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string | ✅ Yes |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK project | ✅ Yes |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK service account | ✅ Yes |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK private key (multiline, quoted) | ✅ Yes |
| `R2_ACCOUNT_ID` | Cloudflare R2 account | ✅ Yes |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | ✅ Yes |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key | ✅ Yes |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name | ✅ Yes |
| `R2_PUBLIC_URL` | Cloudflare R2 public CDN base URL | ✅ Yes |
| `PORT` | Express server port (default: `5000`) | Optional |
| `NODE_ENV` | `development` or `production` | Optional |
| `ENABLE_DEV_AUTH` | `true` to bypass Firebase in development | Dev only |
| `ENABLE_ACTIVITY_PURGE` | `true` to allow log purge endpoint | Dev only |
| `ACTIVITY_LOG_RETENTION_DAYS` | Days to retain activity logs (default: `365`) | Optional |

> **`FIREBASE_PRIVATE_KEY` format:** The key is a multiline PEM string. In the `.env` file, wrap it in double quotes and use literal `\n` sequences — the `parsePrivateKey()` function in `config/env.js` handles unescaping automatically.

---

## Prisma Workflows

### When to run `prisma generate`

Run after **any** of the following:
- Pulling updated `prisma/schema.prisma` from the repository
- Running `prisma migrate dev` (generates automatically, but run manually if you see type errors)
- After a `npm install` that upgrades the `@prisma/client` package version

```powershell
npx prisma generate
```

This regenerates the Prisma Client TypeScript types and query engine. **It does not change the database.**

---

### When to run `prisma migrate dev`

Run when you are **authoring a new schema change** and want to:
1. Generate a migration SQL file
2. Apply it to your development database
3. Regenerate the Prisma Client

```powershell
npx prisma migrate dev --name describe_your_change
```

> ⚠️ **Do not run `migrate dev` on the production database.** Use `migrate deploy` for production.

---

### When to run `prisma db push`

Use for rapid prototyping when you **do not** want a migration history entry. Syncs schema directly to the database without creating a migration file.

```powershell
npx prisma db push
```

> ⚠️ Use with caution — `db push` can cause data loss if columns are removed. Prefer `migrate dev` for any tracked changes.

---

### When to run `prisma migrate deploy`

Use only in **production or staging** environments to apply pending migrations without modifying the schema:

```powershell
npx prisma migrate deploy
```

---

### Seeding the Database

The seeder is idempotent — safe to run multiple times.

```powershell
node prisma/seed.js
```

The seeder provisions:
- 7 canonical Canlaon Vicariate parishes
- One pre-provisioned priest and one secretary per parish (Firebase UID set to `null`)
- A Diocese Coordinator account (`coordinator@testimonium.org`)

Staff accounts activate on first Firebase login via the JIT (Just-In-Time) UID linking flow.

---

## Database Synchronization

### Standard sync after pulling from the repository

```powershell
# 1. Apply any pending migrations
npx prisma migrate deploy

# 2. Regenerate the client (in case schema changed)
npx prisma generate

# 3. Restart the backend
npm run dev
```

### Checking migration status

```powershell
npx prisma migrate status
```

This shows which migrations have been applied and which are pending.

---

## Backend Restart Requirements

**nodemon handles most restarts automatically.** However, a **manual kill and restart** is required after:

| Scenario | Why nodemon is insufficient |
|---|---|
| `prisma generate` run manually | The running process holds a reference to the old Prisma Client binary |
| Schema change applied via `migrate dev` | Same as above |
| `.env` file modified | nodemon does not watch `.env` by default |
| Port `5000` conflict detected | nodemon cannot restart a process that failed to bind |

### Manual restart procedure (Windows)

```powershell
# Option A — Kill by port (if nodemon is unresponsive)
netstat -ano | findstr :5000
# Note the PID from the output, then:
taskkill /PID <PID> /F

# Option B — Kill all node processes (use with caution)
taskkill /IM node.exe /F

# Then restart
npm run dev
```

---

## Port Conflict Resolution

The backend binds to port `5000`. If the port is occupied from a previous session:

### Step 1 — Find the process using port 5000

```powershell
netstat -ano | findstr :5000
```

Output example:
```
TCP    0.0.0.0:5000    0.0.0.0:0    LISTENING    12345
```
The last column is the PID.

### Step 2 — Terminate the process

```powershell
taskkill /PID 12345 /F
```

### Step 3 — Restart the backend

```powershell
npm run dev
```

> **Prevention:** Always start the suite from the **root workspace** using `npm run dev`. This ensures only one backend process is spawned. Never start the backend from both the root and the backend directory simultaneously.

---

## Stale Prisma Client Recovery

Symptoms of a stale Prisma Client:
- TypeScript errors referencing missing model fields
- Runtime errors about unknown Prisma models or operations
- Queries returning unexpected shapes after a schema change

### Full recovery procedure

```powershell
# 1. Stop all running processes (Ctrl+C or kill node.exe)

# 2. Regenerate the Prisma Client
npx prisma generate

# 3. Verify migration status
npx prisma migrate status

# 4. Apply any pending migrations if needed
npx prisma migrate deploy

# 5. Restart the backend
npm run dev
```

If TypeScript errors persist after `generate`, delete the generated client cache and regenerate:

```powershell
# Remove the generated client directory
Remove-Item -Recurse -Force node_modules\.prisma

# Regenerate
npx prisma generate
```

---

## Development Auth Bypass

When `ENABLE_DEV_AUTH=true` is set in `.env`, the auth middleware skips Firebase token verification and accepts a synthetic token header.

**Usage:**
```http
Authorization: Bearer test-token-coordinator
```

This maps the request directly to the pre-seeded `coordinator@testimonium.org` (Diocese Coordinator) profile.

> ⚠️ **Never set `ENABLE_DEV_AUTH=true` in production.** This completely bypasses authentication and grants coordinator-level access to any request with the bypass header.

Available bypass tokens:

| Token | Mapped Role |
|---|---|
| `test-token-coordinator` | Diocese Coordinator |

---

## Troubleshooting Reference

| Symptom | Likely Cause | Resolution |
|---|---|---|
| `Error: listen EADDRINUSE :::5000` | Another process is using port 5000 | See [Port Conflict Resolution](#port-conflict-resolution) |
| `PrismaClientInitializationError` | Stale or missing Prisma Client | Run `npx prisma generate` then restart |
| `Invalid database URL` | `DATABASE_URL` missing or malformed in `.env` | Check `.env` against `.env.example` |
| `Firebase: App named [DEFAULT] already exists` | Backend started twice | Kill all node processes, restart once |
| `CORS error from frontend` | Frontend running on unpinned port | Confirm Vite ports are `5173`/`5174`; check `env.js` corsOrigins |
| Missing parish records on startup warning | Database not seeded | Run `node prisma/seed.js` |
| Startup validation warnings for coordinates | Parish seeded without coordinates | Expected for scaffold data; not a blocker |
| `Unauthorized` on all API requests | `ENABLE_DEV_AUTH` not set, or Firebase credentials missing | Set `ENABLE_DEV_AUTH=true` for local dev |

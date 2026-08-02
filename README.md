# TESTIMONIUM Portal Suite

> **Roman Catholic Diocese of San Carlos**  
> Sacramental Document Processing & Parish Administration System

TESTIMONIUM is a diocesan-scale platform enabling parishioners to request sacramental records, schedule parish events, and track certificate processing — while providing parish staff and diocese administrators with a unified management dashboard.

---

## Applications

| Application | Description | Dev URL |
|---|---|---|
| **Backend API** | Node.js / Express REST API serving the suite | `http://localhost:5000` |
| **Parishioner Web Portal** | React / Vite portal for parishioners | `http://localhost:5173` |
| **Admin Portal** | React / Radix UI management dashboard for parish staff and diocese | `http://localhost:5174` |
| **Parishioner Mobile App** | React Native / Expo mobile app scaffold | *Scaffold Only* |

These are **independent applications** that share the same backend API and Firebase project. They are orchestrated together from the root workspace but remain completely separate codebases with their own routing, authentication flows, layouts, and build pipelines.

---

## Repository Structure

```
testimonium/
├── package.json                        ← Root workspace (start here)
├── .env.example                        ← Environment variable reference for the full suite
├── README.md                           ← This file
│
├── testimonium-backend/                ← Backend API Service
│   ├── server.js                       ← Express entry point (port 5000)
│   ├── DEVELOPER_GUIDE.md              ← Backend lifecycle & Prisma workflows
│   ├── .env.example                    ← Backend environment template
│   ├── config/                         ← Firebase, DB, R2, env configuration
│   ├── controllers/                    ← Express route handlers
│   ├── middlewares/                    ← Auth, RBAC, upload, error guards
│   ├── prisma/                         ← Schema, migrations, seed script
│   ├── repositories/                   ← Prisma DB query layer
│   ├── routes/                         ← Express route registrations
│   ├── services/                       ← Business logic
│   └── validators/                     ← Zod request validators
│
├── testimonium-parishioner-web/        ← Parishioner Web Portal
│   ├── .env.example                    ← Frontend environment template
│   └── src/
│       ├── pages/public/               ← Landing, Login, Signup pages
│       ├── pages/dashboard/            ← Authenticated parishioner pages
│       ├── contexts/                   ← AuthContext, NotificationContext
│       ├── layouts/                    ← PublicLayout, DashboardLayout
│       ├── components/                 ← Reusable UI components
│       └── providers/                  ← Data provider architecture
│
├── testimonium-parishioner-app/        ← Parishioner Mobile App (Scaffold)
│   ├── App.js                          ← Boilerplate entry point
│   ├── app.json                        ← Native configuration file
│   └── src/                            ← Screens, components, services scaffolds
│
└── testimonium-admin-portal/           ← Parish Admin Portal
    ├── .env.example                    ← Frontend environment template
    └── src/
        ├── pages/                      ← Admin management screens
        ├── context/                    ← AuthContext
        ├── layouts/                    ← Dashboard and auth layouts
        ├── components/                 ← Radix UI wrappers and widgets
        ├── providers/                  ← Data provider architecture (Demo/API/Hybrid)
        └── routes/                     ← AppRouter with RBAC-guarded routes
```

---

## Prerequisites

| Requirement | Version | Verify With |
|---|---|---|
| **Node.js** | `v20.x LTS` (minimum) | `node --version` |
| **npm** | `v10.x` (ships with Node 20) | `npm --version` |
| **Git** | Any recent version | `git --version` |
| **Prisma CLI** | `^7.8.0` (installed as devDependency) | `npx prisma --version` |

> A local PostgreSQL installation is **not required** — the database is hosted on Supabase. You only need connection credentials.

---

## First-Time Setup

### 1. Clone the repository

```powershell
git clone <repository-url>
cd testimonium
```

### 2. Install all dependencies

```powershell
npm run install:all
```

This installs dependencies for the root workspace, backend, Parishioner Portal, and Admin Portal in one command.

### 3. Configure environment variables

Each application has its own `.env` file. Copy the templates and fill in the values:

```powershell
# Backend
copy testimonium-backend\.env.example testimonium-backend\.env

# Parishioner Web Portal
copy testimonium-parishioner-web\.env.example testimonium-parishioner-web\.env

# Admin Portal
copy testimonium-admin-portal\.env.example testimonium-admin-portal\.env
```

See the [Environment Variables](#environment-variables) section below for what each variable does.

> **Credentials:** Obtain Firebase and Cloudflare R2 credentials from the project maintainer. Do not commit `.env` files.

### 4. Synchronize the database

```powershell
cd testimonium-backend
npx prisma migrate deploy
npx prisma generate
cd ..
```

### 5. Seed the database (first time only)

```powershell
cd testimonium-backend
node prisma/seed.js
cd ..
```

This provisions the 7 Canlaon Vicariate parishes and pre-provisioned staff accounts.

---

## Starting the Suite

### Start everything at once (recommended)

```powershell
# From the testimonium/ root
npm run dev
```

This launches all three services simultaneously using `concurrently`:

```
[Backend]     nodemon server.js           → http://localhost:5000
[Parishioner] vite (port 5173)            → http://localhost:5173
[Admin]       vite (port 5174)            → http://localhost:5174
```

Each service is color-coded in the terminal output:
- **Blue** — Backend
- **Green** — Parishioner Web Portal
- **Magenta** — Admin Portal

> If the backend fails to start, `--kill-others-on-fail` automatically terminates the frontend processes to prevent zombie UI instances running against a dead API.

### Start individual applications

```powershell
npm run backend        # Backend only
npm run parishioner    # Parishioner Web Portal only
npm run admin          # Admin Portal only
```

---

## Startup Order

The frontend applications can technically start before the backend, but they will fail to load data until the backend is ready. The recommended order is:

```
1. Backend (port 5000) — must be healthy before API calls succeed
2. Parishioner Portal (port 5173) — depends on backend
3. Admin Portal (port 5174) — depends on backend
```

`npm run dev` starts all three simultaneously. The frontends handle backend unavailability gracefully during the brief startup window.

---

## Health Check & Service Verification

After startup, verify each service is running:

### Backend

```powershell
# Using PowerShell
Invoke-WebRequest -Uri http://localhost:5000/api/v1/health -UseBasicParsing
```

Or open in a browser: `http://localhost:5000/api/v1/health`

Expected response:
```json
{ "status": "ok" }
```

### Parishioner Web Portal

Open in a browser: `http://localhost:5173`

The TESTIMONIUM landing page should load with the parishioner services and the **"Parish Staff & Administrators"** gateway section at the bottom.

### Admin Portal

Open in a browser: `http://localhost:5174`

The Admin Portal login page should load.

---

## Stopping All Services

Press `Ctrl+C` in the terminal running `npm run dev`. `concurrently` will terminate all three processes.

If a process becomes unresponsive:

```powershell
# Find processes on specific ports
netstat -ano | findstr :5000
netstat -ano | findstr :5173
netstat -ano | findstr :5174

# Kill by PID
taskkill /PID <PID> /F

# Or kill all Node.js processes (use carefully)
taskkill /IM node.exe /F
```

---

## Port Map

| Service | Port | Configured In |
|---|---|---|
| Backend API | `5000` | `testimonium-backend/.env` (`PORT`) |
| Parishioner Web Portal | `5173` | `testimonium-parishioner-web/vite.config.ts` |
| Admin Portal | `5174` | `testimonium-admin-portal/vite.config.ts` |

Ports are **pinned with `strictPort: true`** in both Vite configurations. If a port is already in use, Vite will fail immediately with a clear error instead of silently moving to the next available port.

The backend CORS configuration (`testimonium-backend/config/env.js`) explicitly allows both `http://localhost:5173` and `http://localhost:5174`.

---

## Environment Variables

See `.env.example` in the root for a full cross-application reference table.

### Key differences between portal `.env` files

The two frontend portals use **different variable names** for the same logical purpose. This is intentional for historical reasons — do not rename them.

| Purpose | Parishioner Web Portal | Admin Portal |
|---|---|---|
| Backend API URL | `VITE_API_BASE_URL` | `VITE_API_URL` |
| Data provider mode | `VITE_PROVIDER_MODE` | `VITE_DATA_PROVIDER` |
| Firebase credentials | `VITE_FIREBASE_*` (6 keys) | `VITE_FIREBASE_*` (6 keys, same) |

---

## Development Rules

These rules prevent the most common development environment issues.

### ✅ Always start from the root workspace

```powershell
# Correct — starts exactly one backend instance
npm run dev

# Risky — can create a second backend if root dev is also running
cd testimonium-backend && npm run dev
```

### ✅ Only one backend instance at a time

Port `5000` can only be bound once. Running the backend from both the root workspace and the backend directory simultaneously causes an `EADDRINUSE` error. Always verify no stale backend process is running before starting.

### ✅ Regenerate Prisma Client after schema changes

After any `prisma migrate dev` or `prisma generate`:

```powershell
npx prisma generate
# Then restart the backend — nodemon does not detect Prisma Client changes
```

### ✅ Restart the backend manually after `.env` changes

nodemon does not watch `.env` files. Changes to backend environment variables require a manual `Ctrl+C` and restart.

### ✅ Use `npm run install:all` after pulling dependency changes

If `package.json` files were updated in the pull:

```powershell
npm run install:all
```

### ✅ Keep ports fixed

Do not change the Vite ports without also updating:
- `testimonium-backend/config/env.js` — `corsOrigins` array
- Both frontend `.env` files — backend URL variables
- This README and `.env.example` files

---

## User Roles

| Role | Application | Access |
|---|---|---|
| **Parishioner** | Parishioner Web Portal | Request documents, schedule events, track status |
| **Secretary** | Admin Portal | Process document requests for their assigned parish |
| **Parish Coordinator (Priest)** | Admin Portal | Approve schedules, view parish calendar |
| **Diocese Coordinator** | Admin Portal | Multi-parish oversight, analytics, user management |
| **Super Administrator** | Admin Portal | Full system access |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js `v20.x`, Express `v5.x`, ES Modules |
| Database | PostgreSQL (Supabase), Prisma `v7.8.0` |
| Authentication | Firebase Auth (Admin SDK `v14.x` + Client SDK `v12.x`) |
| File storage | Cloudflare R2 (S3-compatible via `@aws-sdk/client-s3`) |
| Admin Portal | React `v19`, Vite `v8`, TypeScript, TailwindCSS `v3.4`, Radix UI |
| Parishioner Portal | React `v19`, Vite `v8`, TypeScript, TailwindCSS `v3.4` |

---

## Additional Documentation

| Document | Location | Purpose |
|---|---|---|
| Backend Developer Guide | [`testimonium-backend/DEVELOPER_GUIDE.md`](./testimonium-backend/DEVELOPER_GUIDE.md) | Prisma workflows, lifecycle, recovery, troubleshooting |
| Backend API Reference | [`testimonium-backend/API_DOCUMENTATION.md`](./testimonium-backend/API_DOCUMENTATION.md) | REST endpoint documentation |
| Database Schema | [`testimonium-backend/Testimonium_Database_Schema.md`](./testimonium-backend/Testimonium_Database_Schema.md) | Schema definitions and relations |
| Admin Portal Design | [`testimonium-admin-portal/ADMIN_PORTAL.md`](./testimonium-admin-portal/ADMIN_PORTAL.md) | Admin portal architecture notes |
| Parishioner Portal Design | [`testimonium-parishioner-web/DESIGN.md`](./testimonium-parishioner-web/DESIGN.md) | Parishioner portal design system |

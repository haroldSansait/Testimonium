# TESTIMONIUM Portal Suite

> **Roman Catholic Diocese of San Carlos**  
> Sacramental Document Processing & Parish Administration System — *Vicariate of Canlaon*

TESTIMONIUM is a diocesan-scale platform enabling parishioners to request sacramental certificates, schedule parish rites and appointments, and track certificate processing in real time — while providing parish secretaries, priests, and diocese coordinators with a unified administrative dashboard.

---

## Applications

| Application | Description | Dev URL |
|---|---|---|
| **Backend API** | Node.js / Express 5 REST API with Prisma ORM & PostgreSQL | `http://localhost:5000` |
| **Parishioner Web Portal** | React 19 / Vite 8 portal with Leaflet GIS maps & DatePicker | `http://localhost:5173` |
| **Admin Portal** | React 19 / Vite 8 management dashboard for parish staff and diocese | `http://localhost:5174` |
| **Parishioner Mobile App** | React Native / Expo mobile app scaffold | *Scaffold Only* |

These are **independent applications** that share the same backend API and Firebase project. They are orchestrated together from the root workspace but remain completely separate codebases with their own routing, authentication flows, layouts, and build pipelines.

---

## Repository Structure

```
testimonium/
├── package.json                        ← Root workspace (start here)
├── .env.example                        ← Environment variable reference for the full suite
├── README.md                           ← This file
├── API_DOCUMENTATION.md                ← Comprehensive REST API documentation
├── DATABASE.md                         ← Database administration, migrations & backup guide
├── Testimonium_Database_Schema.md      ← Schema definitions, models & entity relationships
├── DEPLOYMENT.md                       ← Production deployment manual (PM2, Docker, Nginx)
├── CLOUDFLARE_R2.md                    ← Cloudflare R2 storage hierarchy & image pipeline
├── testimonium_context.md              ← Master synchronization state & architecture snapshot
│
├── testimonium-backend/                ← Backend API Service
│   ├── server.js                       ← Express entry point (port 5000)
│   ├── DEVELOPER_GUIDE.md              ← Backend developer guide & troubleshooting
│   ├── .env.example                    ← Backend environment template
│   ├── config/                         ← Firebase, DB, R2, env configuration
│   ├── controllers/                    ← Express route handlers
│   ├── middlewares/                    ← Auth, RBAC, upload, rate limiting guards
│   ├── prisma/                         ← Schema, migrations, seed script
│   ├── repositories/                   ← Prisma DB query layer
│   ├── routes/                         ← Express route registrations
│   ├── services/                       ← Business logic (ScheduleService, ParishService, etc.)
│   └── validators/                     ← Zod request validators
│
├── testimonium-parishioner-web/        ← Parishioner Web Portal
│   ├── .env.example                    ← Frontend environment template
│   └── src/
│       ├── pages/public/               ← Landing, Login, Signup pages
│       ├── pages/dashboard/            ← Authenticated parishioner pages (Home, Scheduler, Tracking, Directory)
│       ├── contexts/                   ← AuthContext, NotificationContext, SubmissionProtectionContext
│       ├── features/                   ← DatePickerCalendar, PaymentInstructionsCard
│       ├── layouts/                    ← PublicLayout, DashboardLayout
│       ├── components/                 ← Reusable UI & Map components (ParishDrawer, MapMarker)
│       └── providers/                  ← Data provider architecture (API / Demo)
│
├── testimonium-parishioner-app/        ← Parishioner Mobile App (Scaffold)
│   ├── App.js                          ← Boilerplate entry point
│   ├── app.json                        ← Native configuration file
│   └── src/                            ← Screens, components, services scaffolds
│
└── testimonium-admin-portal/           ← Parish Admin & Coordinator Portal
    ├── .env.example                    ← Frontend environment template
    ├── ADMIN_PORTAL.md                 ← Admin portal architecture & feature guide
    └── src/
        ├── pages/                      ← Admin management screens (Settings, Map, Requests, Users, Logs)
        ├── contexts/                   ← AuthContext, NotificationContext
        ├── layouts/                    ← DashboardLayout, AuthLayout
        ├── components/                 ← Map Configuration, Parish Settings, Modals (Help, About)
        ├── providers/                  ← Data provider architecture (ApiParishProvider, DemoParishProvider)
        └── services/                   ← ParishManagementService, etc.
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

Copy the templates and fill in the values:

```powershell
# Backend
copy testimonium-backend\.env.example testimonium-backend\.env

# Parishioner Web Portal
copy testimonium-parishioner-web\.env.example testimonium-parishioner-web\.env

# Admin Portal
copy testimonium-admin-portal\.env.example testimonium-admin-portal\.env
```

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

### Start individual applications

```powershell
npm run backend        # Backend only
npm run parishioner    # Parishioner Web Portal only
npm run admin          # Admin Portal only
```

---

## Port Map

| Service | Port | Configured In |
|---|---|---|
| Backend API | `5000` | `testimonium-backend/.env` (`PORT`) |
| Parishioner Web Portal | `5173` | `testimonium-parishioner-web/vite.config.ts` |
| Admin Portal | `5174` | `testimonium-admin-portal/vite.config.ts` |

Ports are **pinned with `strictPort: true`** in both Vite configurations.

---

## User Roles & Capabilities

| Role | Application | Primary Access & Responsibilities |
|---|---|---|
| **`PARISHIONER`** | Parishioner Web Portal | Order certificates with fee snapshotting, submit GCash/Maya receipts, schedule appointments with interactive date picker, track request timelines. |
| **`SECRETARY`** | Admin Portal | Process parish document requests, verify payments with OCR, issue correction notices, manage sacramental bookings, configure parish pricing, offered sacraments, venue capacity, time slots, office hours, and payment QR codes. |
| **`PRIEST`** | Admin Portal | View assigned presiding calendar, confirm sacramental appointments and Masses, log leave/unavailability ranges. |
| **`DIOCESE_COORDINATOR`** | Admin Portal | Unrestricted vicariate-wide management, interactive church map pin positioning and styling, user/staff provisioning, analytics, and activity audit logs. |

---

## Core System Architecture & Features

1. **Immutable Historical Fee Snapshotting**:
   - Every document request snapshots its authoritative `fee Decimal(10,2)` upon draft creation, ensuring future price adjustments never alter in-flight or completed transactions.
2. **Sacramental Scheduling Concurrency Hardening**:
   - Appointment reservations execute inside **Prisma Serializable transactions**.
   - Strict separation between physical church attendance limits (`venueCapacity`) and staff booking concurrency (`slotCapacity` / `dailyLimit`).
   - Dynamic parish sacrament availability derivation with canonical default time slots.
3. **Interactive Vicariate Mapping**:
   - Custom church sanctuary SVG markers with hex color customization (`#7B1C2A`), zoom controls, label toggles, and drag-and-drop coordinates with unsaved-changes protection.
4. **Optical Character Recognition (OCR)**:
   - Sharp image pre-processing (EXIF auto-rotation, 1200px resize, contrast stretching, quality 80 JPEG) combined with Google Vision API / OCR.Space parsing for GCash and Maya receipts.
5. **Robust Audit Trail**:
   - Detailed activity logging recording actor role, IP address, timestamp, and JSON diffs of previous vs new values.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Runtime | Node.js `v20.x LTS`, Express `v5.x` (ES Modules) |
| Database & ORM | PostgreSQL (Supabase), Prisma `v7.8.0` with `@prisma/adapter-pg` |
| Authentication | Firebase Auth (Admin SDK `v14.x` + Client SDK `v12.x`) + JIT Provisioning |
| Cloud Object Storage | Cloudflare R2 (S3-compatible via `@aws-sdk/client-s3`) |
| Image & OCR Pipeline | Sharp `v0.35.x`, Google Vision API / OCR.Space Engine 2 |
| Logging | Pino `v10.x` structured logger with `pino-http` |
| Admin Portal | React `v19`, Vite `v8`, TypeScript, TailwindCSS `v3.4`, Radix UI, Lucide Icons |
| Parishioner Web Portal | React `v19`, Vite `v8`, TypeScript, TailwindCSS `v3.4`, Leaflet GIS Maps |

---

## Additional Documentation

| Document | Location | Purpose |
|---|---|---|
| **System Context & Snapshot** | [`testimonium_context.md`](./testimonium_context.md) | Master synchronization state, directory tree & phase tracker |
| **Database Administration** | [`DATABASE.md`](./DATABASE.md) | Migrations, backup scripts, restore & disaster recovery |
| **Database Schema Reference** | [`Testimonium_Database_Schema.md`](./Testimonium_Database_Schema.md) | Entity descriptions, table fields & constraints |
| **Backend REST API Reference** | [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) | REST endpoints, request/response envelopes & validation |
| **Production Deployment Manual** | [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Production setup with PM2, Docker, Nginx & SSL |
| **Cloudflare R2 Storage Guide** | [`CLOUDFLARE_R2.md`](./CLOUDFLARE_R2.md) | Bucket hierarchy, permissions, CORS & OCR pipeline |
| **Backend Developer Guide** | [`testimonium-backend/DEVELOPER_GUIDE.md`](./testimonium-backend/DEVELOPER_GUIDE.md) | Lifecycle, Prisma workflows, dev auth bypass & troubleshooting |
| **Admin Portal Documentation** | [`testimonium-admin-portal/ADMIN_PORTAL.md`](./testimonium-admin-portal/ADMIN_PORTAL.md) | Admin portal architecture, RBAC & page capabilities |

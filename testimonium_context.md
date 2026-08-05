# TESTIMONIUM Synchronization Context

This document compiles the master synchronization state and comprehensive architectural snapshot of the **TESTIMONIUM** sacramental document processing system across the monorepo workspace.

---

## 1. 📊 SYSTEM SNAPSHOT & METADATA

*   **Generation Date/Time:** `2026-08-04T17:03:00+08:00` (Local Workspace Time)
*   **System Architecture:** Decoupled, multi-tenant / multi-parish row-level ring-fenced structure with roles-based access control (RBAC).

### Core Tech Stack
*   **Backend:** Node.js, Express `v5.2.1` (ES Modules)
*   **Database & ORM:** PostgreSQL (hosted on Supabase) accessed via **Prisma 7.8.0** with `@prisma/adapter-pg` driver adapter.
*   **Identity & Access Management:** Firebase Auth Admin SDK (v14.1.0) with Just-In-Time (JIT) user auto-provisioning.
*   **Cloud Storage:** Cloudflare R2 Object Storage utilizing the AWS S3-compatible SDK (`@aws-sdk/client-s3`) and memory-only `multer` upload streams.
*   **Admin Portal Frontend:** React 19.x, Vite 8.x, TypeScript, TailwindCSS 3.4.x, React Router 7.x, Radix UI.
*   **Parishioner Web Portal:** React 19.x, Vite 8.x, TypeScript, TailwindCSS 3.4.x, React Router 7.x, Leaflet maps.
*   **Parishioner Mobile App:** Expo / React Native scaffolding.

---

## 2. 📁 MONOREPO DIRECTORY TREE

```text
testimonium/
├── package.json
├── package-lock.json
├── testimonium-admin-portal/               # Admin Management Dashboard
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── src/
│       ├── index.css
│       ├── main.tsx
│       ├── api/                            # Axios API integrations
│       ├── components/                     # Reusable UI widgets & Radix wrappers
│       ├── contexts/                       # Auth & Theme states
│       ├── layouts/                        # Dashboard & Auth page layouts
│       ├── pages/                          # Admin View-Layer Screens
│       │   ├── ActivityLogPage.tsx
│       │   ├── AnalyticsPage.tsx
│       │   ├── CalendarPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── DocumentRequestsPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── MassSchedulePage.tsx
│       │   ├── NotificationsPage.tsx
│       │   ├── ParishManagementPage.tsx
│       │   ├── ProfilePage.tsx
│       │   ├── ScheduleRequestsPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── StaffAvailabilityPage.tsx
│       │   ├── UnauthorizedPage.tsx
│       │   └── UserManagementPage.tsx
│       ├── providers/                      # Data Provider Architecture (Demo/API/Hybrid)
│       └── services/                       # Client business logic
├── testimonium-backend/                    # Backend API Service
│   ├── server.js                           # Express entry point
│   ├── package.json
│   ├── config/                             # App configurations (Firebase, DB, R2)
│   │   ├── db.js
│   │   ├── env.js
│   │   ├── firebase.js
│   │   └── r2.js
│   ├── controllers/                        # Express API route controllers
│   ├── middlewares/                        # Auth, RBAC, Upload, Error guards
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   └── uploadMiddleware.js
│   ├── prisma/
│   │   ├── schema.prisma                   # Database Schema Definitions
│   │   ├── seed.js                         # Idempotent database seeder
│   │   └── migrations/                     # Prisma migration records
│   ├── repositories/                       # Prisma DB query layer
│   ├── routes/                             # Express route endpoints
│   ├── services/                           # Backend business logic
│   └── validators/                         # Zod Zod request validators
├── testimonium-parishioner-web/            # Parishioner Web Portal
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── src/
│       ├── index.css
│       ├── main.tsx
│       ├── App.tsx
│       ├── firebaseConfig.ts               # Firebase web configuration
│       ├── api/                            # Axios API integrations
│       ├── components/                     # Reusable UI widgets
│       ├── contexts/                       # Auth & Notification states
│       ├── layouts/                        # Public & Dashboard layouts
│       ├── hooks/                          # Reusable custom hooks
│       ├── pages/                          # Parishioner View-Layer Screens
│       │   ├── public/                     # LandingPage, LoginPage, SignupPage
│       │   └── dashboard/                  # HomePage, SacramentalRequestPage, RequestTrackingPage, EventSchedulerPage, ProfilePage, NotificationsPage, ParishDirectoryPage
│       ├── providers/                      # Data Provider Architecture
│       └── services/                       # Client business logic
└── testimonium-parishioner-app/            # Parishioner Mobile App (Scaffold)
    ├── App.js                              # Empty boilerplate entry point
    ├── app.json                            # Empty native configuration file
    ├── assets/                             # Empty assets folder
    └── src/
        ├── google-services.json            # Firebase native credentials
        ├── components/                     # Empty UI components folder
        ├── navigation/                     # Empty navigation flow controllers
        ├── screens/                        # Empty view screens
        └── services/                       # Empty API integration services
```

---

## 3. 🗄️ DATABASE & SCHEMATIC ALIGNMENT

The PostgreSQL database is managed via Prisma 7.8.0. Database schema changes are tracked via migration history.

### Core Active Models & Relations
*   **`Role`**: Authorization roles (`PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`).
*   **`Parish`**: Details parish structures (`PARISH`, `QUASI_PARISH`, `MISSION_STATION`). Includes settings (`documentSettings`, `eventSettings`, `officeHours`), map display metadata (`mapZoom`, `pinColor`, `showLabel`), location update audits (`locationUpdatedBy`, `locationUpdatedAt`), directory details (`directoryDescription`), coordinates, Cover/Logo/Gallery links, and Slug details.
*   **`User`**: Core user accounts. Links to a single `Role` and optionally to an assigned `Parish` (staff roles). Tracks color preferences and assistant flags.
*   **`DocumentRequest`**: Sacrament certificate requests. Links a `User` (submitter), a `Parish` (receiver), and a `User` (processor). Supports tracking, drafts, payments, and correction notes.
*   **`RequestAttachment`**: Uploaded attachments supporting a document request. Points to keys in Cloudflare R2.
*   **`PaymentTransaction`**: Manages payment verification metadata for GCash/etc. transfers.
*   **`ReceiptUpload`**: Represents individual receipt image references stored in R2.
*   **`OcrResult`**: Contains raw text, extracted reference data, multi-tiered confidence metrics (`ocrConfidence`, `parserConfidence`, `finalConfidence`), normalized values (`normalizedAmount`, `normalizedDate`), engine parameters (`ocrEngine`, `ocrLanguage`, `compressionWidth`, `compressionQuality`), and performance telemetry from GCash screenshots.
*   **`RequestHistory`**: Audit trail of statuses, updates, and reasons for Document Requests.
*   **`Schedule`**: Event requests (weddings, baptisms, etc.) with dates and calendar allocations. Tracks rescheduling states.
*   **`ParishAvailability`**: Tracks unavailability ranges, office closures, and leaves for staff.
*   **`Notification`**: Broadcasts/individual triggers (`PUSH`, `IN_APP`, `EMAIL`) with link details.
*   **`FaqKnowledgeBase`**: Questions and answers utilized for FAQ hubs.
*   **`ChatbotLog`**: Interaction transcripts between parishioners and the AI chatbot.
*   **`ActivityLog`**: Audit tracking system logging staff database changes, capturing old/new values (`previousValues`, `newValues`), system flags, archiving state (`archivedAt`, `archivedBy`), and metadata JSON snapshots.
*   **`MassScheduleTemplate`**: Templates for recurring Masses.
*   **`ParishEvent`**: Custom parish activities like Masses, Fiestas, or blessings.

### Enum Values Enforced
*   **`RoleName`**: `PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`
*   **`UserStatus`**: `ACTIVE`, `INACTIVE`
*   **`ParishType`**: `PARISH`, `QUASI_PARISH`, `MISSION_STATION`
*   **`DocumentType`**: `BAPTISMAL_CERTIFICATE`, `CONFIRMATION_CERTIFICATE`, `MARRIAGE_CERTIFICATE`, `FIRST_COMMUNION_CERTIFICATE`
*   **`DocumentRequestStatus`**: `PENDING`, `UNDER_REVIEW`, `NEEDS_CORRECTION`, `PAYMENT_PENDING`, `PAYMENT_UNDER_REVIEW`, `PAYMENT_NEEDS_CORRECTION`, `PAYMENT_VERIFIED`, `PROCESSING`, `READY_FOR_PICKUP`, `COMPLETED`, `REJECTED`, `CANCELLED`
*   **`PaymentStatus`**: `UNPAID`, `PROOF_SUBMITTED`, `CONFIRMED`
*   **`PaymentVerificationStatus`**: `PENDING`, `VERIFIED`, `REJECTED`
*   **`ScheduleEventType`**: `WEDDING`, `BAPTISM`, `CONFIRMATION`, `PRIVATE_MASS`, `MASS_INTENTION`, `MARRIAGE_SPECIAL`, `WAKE_MASS`, `FUNERAL`, `ANOINTING_OF_THE_SICK`, `FIESTA`, `BLESSING`, `DELIVERANCE`, `THANKSGIVING`, `FIRST_COMMUNION`, `MASS_OF_HOLY_SPIRIT`, `CONFESSION`
*   **`ScheduleStatus`**: `PENDING`, `REQUESTED`, `PROPOSED_RESCHEDULE`, `WAITING_PARISHIONER_RESPONSE`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`
*   **`AvailabilityType`**: `PARISH_CLOSED`, `SECRETARY_LEAVE`, `PRIEST_LEAVE`, `FULLY_BOOKED`
*   **`NotificationType`**: `PUSH`, `IN_APP`, `EMAIL`
*   **`NotificationReferenceType`**: `DOCUMENT_REQUEST`, `SCHEDULE_REQUEST`, `GENERAL`
*   **`OcrStatus`**: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`

### Seeded Canlaon Vicariate Parishes
The `prisma/seed.js` script successfully seeds the 7 official parish entities of the Canlaon Vicariate:
1.  **Our Lady of the Mountains Quasi-Parish** (QUASI_PARISH) - San Carlos City, Negros Occidental
2.  **St. Joseph Parish** (PARISH) - Canlaon City, Negros Oriental
3.  **Our Lady of the Miraculous Medal Parish** (PARISH) - Don Salvador Benedicto, Negros Occidental
4.  **Nuestra Señora De Las Flores Mission Station** (MISSION_STATION) - Canlaon City, Negros Oriental
5.  **Our Lady of Peace and Good Voyage Quasi-Parish** (QUASI_PARISH) - San Carlos City, Negros Occidental
6.  **Holy Child Parish** (PARISH) - San Carlos City, Negros Occidental
7.  **Our Lady of Guadalupe Parish** (PARISH) - Vallehermoso, Negros Oriental

*Pre-provisioned staff accounts (one priest, one secretary per parish) are seeded with `firebaseUid: null`. Upon their first successful Firebase Authentication login, their UID is dynamically linked via the email matching JIT flow.*

---

## 4. ⚙️ BACKEND API CORE STATUS (ALL PHASES COMPLETE)

The backend Express server is running on Port 5000 and connects to Supabase Postgres.

### Security & Middlewares
*   **Helmet & Compression:** Headers secured and payloads compressed.
*   **CORS Configuration:** Enforces dynamic origin authorization matching environment properties.
*   **Auth Middleware:** `authenticateFirebaseToken` extracts and verifies JWT ID tokens via the Firebase Admin SDK.
*   **JIT Auto-Provisioning:** Dynamically registers new `PARISHIONER` records or links pre-seeded staff users.
*   **Role Middleware:** `checkRole(allowedRoles)` enforces RBAC.

### Completed API Modules
*   **Login & Authentication (`/api/v1/auth`)**: Supports rememberMe configurations, session duration calculations, and profile updating.
*   **Diocese Management (`/api/v1/diocese`)**: Scopes overview stats, notifications, and activities for Diocese Coordinators.
*   **Parish CRUD & Settings (`/api/v1/parishes`)**: Full lifecycle and custom settings configuration (hours, requirements).
*   **User CRUD (`/api/v1/users`)**: Staff enablement/disabling, password resets, and calendar color preferences.
*   **Analytics (`/api/v1/analytics`)**: live counts of sacramental requests, parishes, and payments.
*   **Calendar & Events (`/api/v1/calendar`, `/api/v1/parish-events`, `/api/v1/mass-schedules`)**:
    *   Retrieves calendar feeds scoped to parish restrictions.
    *   Creates parish-wide events and recurring mass schedule templates.
    *   Allows priests to respond to assigned slots.
*   **Parishioner Request Flow (`/api/v1/requests`, `/api/v1/payment`)**:
    *   Creates request drafts and updates.
    *   Handles Cloudflare R2 file attachments and metadata.
    *   Processes payment proof submissions, executes Sharp image optimization (EXIF rotation, max 1200px width, quality 80 JPEG compression), and triggers OCR analysis (OCR.Space Engine 2 or Stub fallback).
*   **Secretary Management Flow (`/api/v1/document-requests`, `/api/v1/schedule-requests`)**:
    *   Updates request statuses with comments and correction requirement targets.
    *   Manages booking slots and proposes scheduling changes.
*   **Parish Availability (`/api/v1/parish-availabilities`)**: Configures office closures and leave ranges.
*   **Activity Logs & Audits (`/api/v1/activity-log`)**: Lists, archives, restores, and purges logging tables.

---

## 5. 🖥️ FRONTEND APPLICATIONS STATUS

### 1. `testimonium-parishioner-web`
*   **Portal Status:** Fully developed React 19.x / Vite 8.x app.
*   **Routing & Page Screens:** Fully implements user landing pages, authentication (login, signup, onboarding), home dashboards, transactional workflows (document wizards, receipt uploads, request trackers), scheduling forms, notification logs, profile updating, and vicariate maps.
*   **State & Services:** Leverages contexts (Auth, Theme, Notifications) and hooks for REST endpoints.

### 2. `testimonium-parishioner-app` (Expo Mobile App)
*   **Status:** Scaffold baseline. Entry files and directories are provisioned but pages/logic are pending implementation.

---

## 6. 🎯 ACTIVE SPRINT TRACKER & ROADMAP

### 100% Complete & Verified Tasks
*   [x] Express API scaffolding with health check.
*   [x] PostgreSQL migrations and seeding (7 Canlaon parishes & staff).
*   [x] Cloudflare R2 client integrations (`R2Service`).
*   [x] Firebase token verification and JIT auto-provisioning.
*   [x] Scoped calendar query handlers and multi-parish ring-fencing.
*   [x] Audit activity log manager (archiving, restores, purges).
*   [x] Parishioner transactions: document submission, tracking, scheduling, and R2 uploads.
*   [x] GCash receipt upload parsing with dual OCR engines (OCR.Space API + Stub OCR) and Sharp image optimization.
*   [x] Mass schedule template managers and priest response pipelines.
*   [x] Parish availability blocks (leave lists, closures).
*   [x] Parishioner Web Portal: Landing page, authentication, dashboard wizard, tracking, and maps.

### Active Dev Shortcuts & Environment Configurations
*   **Dev Auth Guard Bypass:** Set `ENABLE_DEV_AUTH=true` in development. By sending `Authorization: Bearer test-token-coordinator`, the auth middleware bypasses Firebase validation and maps the context to `coordinator@testimonium.org`.

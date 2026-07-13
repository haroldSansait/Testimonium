# TESTIMONIUM Synchronization Context

This document compiles the master synchronization state and comprehensive architectural snapshot of the **TESTIMONIUM** sacramental document processing system across the monorepo workspace.

---

## 1. 📊 SYSTEM SNAPSHOT & METADATA

*   **Generation Date/Time:** `2026-07-09T12:55:47+08:00` (Local Workspace Time)
*   **System Architecture:** Decoupled, multi-tenant / multi-parish row-level ring-fenced structure with roles-based access control (RBAC).

### Core Tech Stack
*   **Backend:** Node.js, Express (ES Modules)
*   **Database & ORM:** PostgreSQL (hosted on Supabase) accessed via **Prisma 7.8.0** with `@prisma/adapter-pg` driver adapter.
*   **Identity & Access Management:** Firebase Auth Admin SDK (v14.1.0) with Just-In-Time (JIT) user auto-provisioning.
*   **Cloud Storage:** Cloudflare R2 Object Storage utilizing the AWS S3-compatible SDK (`@aws-sdk/client-s3`) and memory-only `multer` upload streams.
*   **Admin Portal Frontend:** React 19.x, Vite 8.x, TypeScript, TailwindCSS 3.4.x, React Router 7.x, Radix UI.
*   **Parishioner Web Portal:** Baseline React boilerplate with Firebase Client Web SDK.
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
│       │   ├── NotificationsPage.tsx
│       │   ├── ParishManagementPage.tsx
│       │   ├── ScheduleRequestsPage.tsx
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
│   └── validators/                         # Zod request validators
├── testimonium-parishioner-web/            # Parishioner Web Portal (Scaffold)
│   └── src/
│       └── firebaseConfig.js               # Firebase web configuration
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

The PostgreSQL database is managed via Prisma 7.8.0. Database schema changes are tracked via four migrations:
1.  `init_testimonium_relational_schema`: Scaffolds the base relational models.
2.  `rename_vicariate_admin_to_diocese_coordinator`: Renames roles to align with diocesan requirements.
3.  `make_firebase_uid_optional`: Facilitates pre-provisioned staff record mapping.
4.  `add_patron_saint_and_email_to_parish`: Expands parish profile fields.

### Core Active Models & Relations
*   **`Role`**: Authorization roles (`PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`).
*   **`Parish`**: Details parish structures (`PARISH`, `QUASI_PARISH`, `MISSION_STATION`).
*   **`User`**: Core user accounts. Links to a single `Role` and optionally to an assigned `Parish` (staff roles).
*   **`DocumentRequest`**: Sacrament certificate requests. Links a `User` (submitter), a `Parish` (receiver), and a `User` (processor).
*   **`Requirement`**: Uploaded attachments supporting a document request. Points to keys in Cloudflare R2.
*   **`Schedule`**: Event requests (weddings, baptisms, etc.) with dates and calendar allocations.
*   **`Notification`**: Broadcasts/individual triggers (`PUSH`, `IN_APP`, `EMAIL`).
*   **`FaqKnowledgeBase`**: Questions and answers utilized for chatbots and FAQ hubs.
*   **`ChatbotLog`**: Interaction transcripts between parishioners and the AI chatbot.
*   **`ActivityLog`**: Audit tracking system logging staff database changes.

### Enum Values Enforced
*   **`RoleName`**: `PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`
*   **`UserStatus`**: `ACTIVE`, `INACTIVE`
*   **`ParishType`**: `PARISH`, `QUASI_PARISH`, `MISSION_STATION`
*   **`DocumentType`**: `BAPTISMAL_CERTIFICATE`, `CONFIRMATION_CERTIFICATE`, `MARRIAGE_CERTIFICATE`, `FIRST_COMMUNION_CERTIFICATE`
*   **`DocumentRequestStatus`**: `PENDING`, `UNDER_REVIEW`, `PAYMENT_PENDING`, `PAYMENT_VERIFIED`, `PROCESSING`, `READY_FOR_PICKUP`, `COMPLETED`, `REJECTED`, `CANCELLED`
*   **`PaymentStatus`**: `UNPAID`, `PROOF_SUBMITTED`, `CONFIRMED`
*   **`ScheduleEventType`**: `WEDDING`, `BAPTISM`, `CONFIRMATION`, `PRIVATE_MASS`, `MASS_INTENTION`
*   **`ScheduleStatus`**: `PENDING`, `CONFIRMED`, `REJECTED`
*   **`NotificationType`**: `PUSH`, `IN_APP`, `EMAIL`

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

## 4. ⚙️ BACKEND API CORE STATUS (PHASES 1, 4, 5, 6 COMPLETE)

The backend Express server is running on Port 5000 and connects to Supabase Postgres.

### Security & Middlewares
*   **Helmet & Compression:** Headers secured and payloads compressed.
*   **CORS Configuration:** Enforces dynamic origin authorization (`http://localhost:3000`, `http://localhost:3001`, `http://localhost:5173`).
*   **Auth Middleware:** `authenticateFirebaseToken` extracts and verifies JWT ID tokens via the Firebase Admin SDK.
*   **JIT Auto-Provisioning:** If an authenticated Firebase email does not exist in the database, a `PARISHIONER` profile is created automatically. If a pre-provisioned staff email matches, the `firebaseUid` is permanently linked.
*   **Role Middleware:** `checkRole(allowedRoles)` enforces RBAC.

### Completed API Modules
*   **Login & Authentication (`/api/v1/auth/login`)**: Supports secure `rememberMe` checkbox parameter mapping, setting client-side persistence and returning calculated session durations (30 days vs 1 day).
*   **Diocese Management (`/api/v1/diocese`)**: Scopes overview stats, notifications, and aggregated activities for Diocese Coordinators.
*   **Parish CRUD (`/api/v1/parishes`)**: Full lifecycle management of parish endpoints.
*   **User CRUD (`/api/v1/users`)**: Staff enablement, disabling, and Firebase password reset link generators.
*   **Analytics (`/api/v1/analytics`)**: Live DB counts for sacrament trends, parish submissions, and payment statistics.
*   **Calendar & Multi-Parish Scoping (`/api/v1/calendar/events`)**:
    *   Retrieves event lists by year/month.
    *   **Row-Level Scoping:** If the requester is not a `DIOCESE_COORDINATOR`, queries automatically inject the user's `parishId`. Priests and Secretaries are ring-fenced to see and edit only their own parish data.
*   **Activity Logs & Audits (`/api/v1/activity-log`)**: Tracking log actions, supporting soft archiving, restores, and cron-like retention purges.
*   **Cloudflare R2 Storage Service (`R2Service`)**: Configured S3-compatible endpoints for uploads, downloads, and deletes. Memory uploads are limited to 10MB via Multer memory storage buffers.

---

## 5. 🖥️ FRONTEND APPLICATIONS STATUS

### 1. `testimonium-parishioner-web`
*   **Baseline Configuration:** The portal exists as a barebones scaffold.
*   **File Readiness:** Only `src/firebaseConfig.js` is established, housing web api credentials (`projectId: testimonium-b46b0`).
*   **Status:** Not yet ready; routers, pages, layouts, and components are pending initialization.

### 2. `testimonium-parishioner-app` (Expo Mobile App)
*   **Entry Points:** `App.js` and `app.json` are present but exist as empty 0-byte placeholders.
*   **Native Firebase Configuration:** `src/google-services.json` is configured, linking the Android package identifier `com.testimonium.app` to Firebase project `testimonium-b46b0`.
*   **View-layer & Component Readiness:** All directories (`screens`, `navigation`, `components`, `services`) are created but currently remain empty scaffolds.

---

## 6. 🎯 ACTIVE SPRINT TRACKER & CURRENT ROADBLOCKS

### 100% Complete & Verified Tasks
*   [x] Node.js Express scaffolding with health verification.
*   [x] PostgreSQL schema migrations (4 runs successfully initialized/configured).
*   [x] Cloudflare R2 bucket connection client (`R2Service.js`).
*   [x] Firebase token verification and JIT profile mapping.
*   [x] Role-Based Access Control checks (`checkRole`).
*   [x] Diocese Coordinator dashboard integrations and analytics charts.
*   [x] Parish and staff user lifecycle administration (CRUD, disable/enable, resets).
*   [x] Scoped calendar query handlers and multi-parish ring-fencing.
*   [x] Audit activity log manager (list, filter, archive, purge).

### Immediate Next Tasks (Roadmap)
*   [ ] **Phase (?) Parishioner Transaction endpoints**:
    *   Build document submission routes saving metadata to DB and file streams to R2.
    *   Implement status update transitions (`PENDING` -> `UNDER_REVIEW` -> `PAYMENT_PENDING` -> `READY_FOR_PICKUP`).
    *   Build scheduling forms and appointment validation routes to avoid calendar overlaps.
*   [ ] **Multer Streaming Upload validation**:
    *   Integrate backend file size and MIME-type validators for document requirement payloads.
*   [ ] **OCR Integration for GCash Receipts**:
    *   Establish scanning integration to parse GCash screenshot reference codes, amounts, and timestamps, automatically moving status to `PAYMENT_VERIFIED`.

### Active Dev Shortcuts & Environment Configurations
*   **Dev Auth Guard Bypass:** Set `ENABLE_DEV_AUTH=true` in development environments. By sending the header:
    ```http
    Authorization: Bearer test-token-coordinator
    ```
    the auth middleware bypasses Firebase validation and maps the request context directly to the pre-seeded `coordinator@testimonium.org` profile to facilitate API testing.

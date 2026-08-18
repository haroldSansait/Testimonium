# TESTIMONIUM Synchronization Context

This document compiles the master synchronization state and comprehensive architectural snapshot of the **TESTIMONIUM** sacramental document processing and parish management system across the monorepo workspace.

---

## 1. 📊 SYSTEM SNAPSHOT & METADATA

*   **Generation Date/Time:** `2026-08-18T19:00:00+08:00` (Asia/Manila, UTC+8)
*   **System Architecture:** Decoupled, multi-tenant / multi-parish row-level ring-fenced structure with roles-based access control (RBAC).
*   **Current Production Phase:** Phase 4.3.2 (Sacramental Scheduling Configuration Sync, Time Slot Availability, Historical Fee Snapshotting & Parish Capacity Hardening).

### Core Tech Stack
*   **Backend API:** Node.js, Express `v5.2.1` (ES Modules)
*   **Database & ORM:** PostgreSQL (hosted on Supabase) accessed via **Prisma 7.8.0** with `@prisma/adapter-pg` driver adapter.
*   **Identity & Access Management:** Firebase Auth Admin SDK (v14.1.0) with Just-In-Time (JIT) user auto-provisioning and role mapping.
*   **Cloud Storage:** Cloudflare R2 Object Storage utilizing the AWS S3-compatible SDK (`@aws-sdk/client-s3`) and memory-only `multer` upload streams.
*   **OCR & Image Optimization:** Google Vision API / OCR.Space Engine 2 with Sharp EXIF rotation, contrast stretching, and JPEG compression.
*   **Admin Portal Frontend:** React 19.x, Vite 8.x, TypeScript, TailwindCSS 3.4.x, React Router 7.x, Lucide Icons, Radix UI.
*   **Parishioner Web Portal:** React 19.x, Vite 8.x, TypeScript, TailwindCSS 3.4.x, React Router 7.x, Leaflet GIS mapping, custom DatePicker Calendar.
*   **Parishioner Mobile App:** Expo / React Native scaffolding.

---

## 2. 📁 MONOREPO DIRECTORY TREE

```text
testimonium/
├── package.json
├── package-lock.json
├── API_DOCUMENTATION.md
├── CLOUDFLARE_R2.md
├── DATABASE.md
├── DEPLOYMENT.md
├── OCR_INTEGRATION_SPEC.md
├── README.md
├── Testimonium_Database_Schema.md
├── testimonium_context.md
├── testimonium-admin-portal/               # Admin & Diocese Coordinator Portal
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── src/
│       ├── index.css
│       ├── main.tsx
│       ├── api/                            # Axios API client & interceptors
│       ├── components/                     # UI components & modals
│       │   ├── common/                     # NotificationDropdown, etc.
│       │   ├── layout/                     # Navbar, Sidebar, DashboardLayout
│       │   ├── map-configuration/          # ParishMarker, ParishSettingsPanel, SaveToolbar, UnsavedChangesBanner, PreviewDialog, ImageUploader
│       │   ├── modals/                     # AboutModal, HelpModal, SessionWarningModal
│       │   ├── parish-management/          # NewParishWizard, ParishTable
│       │   └── ui/                         # PageHeader, Card, Button, Input, Modal, Badge
│       ├── contexts/                       # AuthContext, NotificationContext, SubmissionProtectionContext
│       ├── hooks/                          # useAuth, useUnsavedChanges, useNotificationHub
│       ├── layouts/                        # DashboardLayout, AuthLayout
│       ├── pages/                          # Admin View-Layer Screens
│       │   ├── ActivityLogPage.tsx
│       │   ├── AnalyticsPage.tsx
│       │   ├── CalendarPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── DocumentRequestsPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── MapConfigurationPage.tsx
│       │   ├── MassSchedulePage.tsx
│       │   ├── NotificationsPage.tsx
│       │   ├── ParishManagementPage.tsx
│       │   ├── ProfilePage.tsx
│       │   ├── ScheduleRequestsPage.tsx
│       │   ├── SettingsPage.tsx            # Multi-tab Parish Settings (Docs, Scheduling, Capacity, Hours, QR)
│       │   ├── StaffAvailabilityPage.tsx
│       │   ├── UnauthorizedPage.tsx
│       │   └── UserManagementPage.tsx
│       ├── providers/                      # Data Provider Architecture (ApiParishProvider, DemoParishProvider, etc.)
│       └── services/                       # Client business logic (ParishManagementService, etc.)
├── testimonium-backend/                    # Backend API Service
│   ├── server.js                           # Express entry point
│   ├── DEVELOPER_GUIDE.md                  # Developer & Troubleshooting Manual
│   ├── package.json
│   ├── config/                             # App configurations (Firebase, DB, R2, env)
│   │   ├── db.js
│   │   ├── env.js
│   │   ├── firebase.js
│   │   └── r2.js
│   ├── controllers/                        # Express API route controllers
│   ├── middlewares/                        # Auth, RBAC, Upload, Rate Limiting guards
│   ├── prisma/
│   │   ├── schema.prisma                   # Database Schema Definitions
│   │   ├── seed.js                         # Idempotent database seeder
│   │   └── migrations/                     # Prisma migration records
│   ├── repositories/                       # Prisma DB query layer
│   ├── routes/                             # Express route endpoints
│   ├── services/                           # Backend business logic (ScheduleService, ParishService, etc.)
│   └── validators/                         # Zod request validators
├── testimonium-parishioner-web/            # Parishioner Web Portal
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── src/
│       ├── index.css
│       ├── main.tsx
│       ├── App.tsx
│       ├── firebaseConfig.ts               # Firebase web client configuration
│       ├── api/                            # Axios API client
│       ├── components/                     # Reusable UI widgets
│       │   ├── maps/                       # MapContainer, MapMarker, ParishDrawer
│       │   ├── layout/                     # Navbar, Footer, PageContainer
│       │   ├── modals/                     # CertificatePreviewModal, CorrectionModal
│       │   └── ui/                         # Button, Card, Stepper, Skeleton, ErrorState, Input
│       ├── contexts/                       # AuthContext, NotificationContext, SubmissionProtectionContext
│       ├── features/
│       │   ├── documents/                  # PaymentInstructionsCard, DocumentUploadForm
│       │   └── scheduler/                  # DatePickerCalendar, TimeSlotGrid
│       ├── hooks/                          # useAuth, useService, useParishes, useRequests
│       ├── pages/
│       │   ├── public/                     # LandingPage, LoginPage, SignupPage
│       │   └── dashboard/                  # HomePage, SacramentalRequestPage, RequestTrackingPage, EventSchedulerPage, ProfilePage, NotificationsPage, ParishDirectoryPage
│       ├── providers/                      # Data Provider Architecture (API / Demo)
│       ├── services/                       # Client business logic
│       └── utils/                          # date.ts, cn.ts, formatters.ts
└── testimonium-parishioner-app/            # Parishioner Mobile App (Scaffold)
    ├── App.js
    ├── app.json
    └── src/
```

---

## 3. 🗄️ DATABASE & SCHEMATIC ALIGNMENT

The PostgreSQL database is managed via Prisma 7.8.0. Database schema changes are tracked via migration history.

### Core Active Models & Relations
*   **`Role`**: Authorization roles (`PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`).
*   **`Parish`**: Details parish structures (`PARISH`, `QUASI_PARISH`, `MISSION_STATION`). Includes settings (`documentSettings`, `eventSettings`, `officeHours`, `availableDocuments`), physical church `venueCapacity`, GCash/Maya QR payments (`paymentQrImage`, `paymentQrEnabled`), map display metadata (`mapZoom`, `pinColor`, `showLabel`), location update audits, directory details, coordinates, and Cover/Logo/Gallery links.
*   **`User`**: Core user accounts. Links to a single `Role` and optionally to an assigned `Parish` (staff roles). Tracks color preferences, assistant flags, and legal acceptance timestamps (`termsAcceptedAt`, `privacyAcceptedAt`).
*   **`DocumentRequest`**: Sacrament certificate requests. Snapshots immutable `fee Decimal(10,2)` upon creation. Supports tracking, drafts, payment status, correction notes, and re-upload requirement IDs.
*   **`RequestAttachment`**: Uploaded attachments supporting a document request. Points to keys in Cloudflare R2.
*   **`PaymentTransaction`**: Manages payment verification metadata for GCash/Maya transfers.
*   **`ReceiptUpload`**: Represents individual receipt image references stored in R2.
*   **`OcrResult`**: Contains raw text, extracted reference data, multi-tiered confidence metrics (`ocrConfidence`, `parserConfidence`, `finalConfidence`), normalized values (`normalizedAmount`, `normalizedDate`), engine parameters, and performance telemetry.
*   **`RequestHistory`**: Audit trail of statuses, updates, and reasons for Document Requests.
*   **`Schedule`**: Event requests (weddings, baptisms, etc.) with dates and calendar allocations. Tracks rescheduling states (`PROPOSED_RESCHEDULE`, `WAITING_PARISHIONER_RESPONSE`), priest assignments, priest response status, and conflict flags.
*   **`ParishAvailability`**: Tracks unavailability ranges, office closures, and leaves for staff.
*   **`Notification`**: Broadcasts/individual triggers (`PUSH`, `IN_APP`, `EMAIL`) with link details.
*   **`FaqKnowledgeBase`**: Questions and answers utilized for Caloy FAQ chatbot.
*   **`ChatbotLog`**: Interaction transcripts between parishioners and the AI chatbot.
*   **`ActivityLog`**: Audit tracking system logging staff database changes, capturing old/new values (`previousValues`, `newValues`), system flags, archiving state, and metadata JSON snapshots.
*   **`MassScheduleTemplate`**: Templates for recurring Masses with priest assignment and acceptance tracking.
*   **`ParishEvent`**: Custom parish activities like Masses, Fiestas, or blessings.

### Enums Enforced
*   **`RoleName`**: `PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`
*   **`UserStatus`**: `ACTIVE`, `INACTIVE`
*   **`ParishType`**: `PARISH`, `QUASI_PARISH`, `MISSION_STATION`
*   **`DocumentType`**: `BAPTISMAL_CERTIFICATE`, `CONFIRMATION_CERTIFICATE`, `MARRIAGE_CERTIFICATE`, `FIRST_COMMUNION_CERTIFICATE`, `MARRIAGE_BANNS`, `PERMIT_TO_MARRY`, `STATUS_OF_LIBERTY`
*   **`DocumentRequestStatus`**: `PENDING`, `UNDER_REVIEW`, `NEEDS_CORRECTION`, `PAYMENT_PENDING`, `PAYMENT_UNDER_REVIEW`, `PAYMENT_NEEDS_CORRECTION`, `PAYMENT_VERIFIED`, `PROCESSING`, `READY_FOR_PICKUP`, `COMPLETED`, `REJECTED`, `CANCELLED`
*   **`PaymentStatus`**: `UNPAID`, `PROOF_SUBMITTED`, `CONFIRMED`
*   **`PaymentVerificationStatus`**: `PENDING`, `VERIFIED`, `REJECTED`
*   **`ScheduleEventType`**: `WEDDING`, `BAPTISM`, `CONFIRMATION`, `PRIVATE_MASS`, `MASS_INTENTION`, `MARRIAGE_SPECIAL`, `WAKE_MASS`, `FUNERAL`, `ANOINTING_OF_THE_SICK`, `FIESTA`, `BLESSING`, `DELIVERANCE`, `THANKSGIVING`, `FIRST_COMMUNION`, `MASS_OF_HOLY_SPIRIT`, `CONFESSION`
*   **`ScheduleStatus`**: `PENDING`, `REQUESTED`, `PROPOSED_RESCHEDULE`, `WAITING_PARISHIONER_RESPONSE`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`
*   **`AvailabilityType`**: `PARISH_CLOSED`, `SECRETARY_LEAVE`, `PRIEST_LEAVE`, `FULLY_BOOKED`
*   **`NotificationType`**: `PUSH`, `IN_APP`, `EMAIL`
*   **`NotificationReferenceType`**: `DOCUMENT_REQUEST`, `SCHEDULE_REQUEST`, `GENERAL`
*   **`OcrStatus`**: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`

---

## 4. 🏛️ CANONICAL CANLAON VICARIATE PARISHES

The `prisma/seed.js` script seeds the 7 official parish entities of the Canlaon Vicariate (Diocese of San Carlos):
1.  **Our Lady of the Mountains Quasi-Parish** (QUASI_PARISH) - San Carlos City, Negros Occidental
2.  **St. Joseph Parish** (PARISH) - Canlaon City, Negros Oriental
3.  **Our Lady of the Miraculous Medal Parish** (PARISH) - Don Salvador Benedicto, Negros Occidental
4.  **Nuestra Señora De Las Flores Mission Station** (MISSION_STATION) - Canlaon City, Negros Oriental
5.  **Our Lady of Peace and Good Voyage Quasi-Parish** (QUASI_PARISH) - San Carlos City, Negros Occidental
6.  **Holy Child Parish** (PARISH) - San Carlos City, Negros Occidental
7.  **Our Lady of Guadalupe Parish** (PARISH) - Vallehermoso, Negros Oriental

---

## 5. 🛡️ RECENT ARCHITECTURAL ACCOMPLISHMENTS (PHASE 4.3 — 4.3.2)

1. **Historical Fee Snapshotting**:
   - `DocumentRequest.fee` snapshots authoritative price at the moment of request creation. Subsequent changes to parish pricing will never corrupt past requests.
   - Parishioner tracking and payment instruction UI displays the persisted snapshot fee.
2. **Events Banner Normalization & Mass Consolidation**:
   - Date and time logic standardized in `Asia/Manila` (UTC+8).
   - Past events and expired Mass times are filtered out from the featured banner.
   - Multiple masses on the same date for a parish are consolidated into unified carousel items.
3. **HomePage Hook Ordering Invariant**:
   - All `useMemo` and state hooks hoisted above early conditional returns, preventing Rules of Hooks violations.
4. **Sacramental Scheduling Configuration Synchronization**:
   - Dynamic derivation of offered sacraments based on parish `eventSettings.availableEvents`.
   - Canonical default time slots for weekdays and Saturdays.
   - Explicit empty slot `[]` handling without silent restoration of defaults.
   - Concurrency limits enforced via Serializable Prisma transactions (`capacitySettings.slotCapacity` and `capacitySettings.dailyLimit`).
5. **Separation of Venue Capacity vs Booking Slot Capacity**:
   - Added `venueCapacity Int?` to PostgreSQL for physical church capacity.
   - Displayed as an informational badge on Parishioner Web scheduler without constraining appointment concurrency.
6. **Unsaved Changes Management**:
   - Interactive dirty checking (`isDirty`), browser close guards (`useUnsavedChanges`), modal confirmation on switching parishes or navigating away.
7. **Visual Harmonization**:
   - Standardized on Testimonium Crimson (`#7B1C2A`, `crimson-700`, `bg-red-50`) across Admin Map Configuration, Markers, and Web Portals.

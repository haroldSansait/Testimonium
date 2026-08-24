# TESTIMONIUM Parishioner Mobile — Decisions & Change Control

**Purpose:** Prevent stale architectural assumptions as mobile and backend evolve.
**Last reconciled:** 24 August 2026

## 1. Baseline snapshot

As of 24 August 2026:
- **Backend:** Express 5, Prisma 7, PostgreSQL (18 models), Firebase Admin, Cloudflare R2, Automated OCR, `IdempotencyService`, `SchedulingConfiguration`, `BookingValidator`.
- **Parishioner Web:** React 19 / Vite 8 / Firebase Auth.
- **Admin Portal:** React 19 / Vite 8 / Firebase Auth.
- **Parishioner Mobile App:** Expo SDK 57, React Native 0.86, React 19, TypeScript 6, `@react-native-firebase/auth`, `@react-native-google-signin/google-signin`, TanStack Query, Expo Router.
- **Target Role:** `PARISHIONER` only.

## 2. Decision status labels

- `ACCEPTED`
- `SUPERSEDED`
- `REJECTED`
- `DEFERRED`

## 3. Decision log

### M-001 — Existing backend is the mobile backend
**Status:** ACCEPTED
Mobile consumes `/api/v1`; it does not get a separate business backend.

### M-002 — Mobile is parishioner-only
**Status:** ACCEPTED
Staff remains in admin portal. Non-parishioner roles are rejected with `ACCOUNT_UNAVAILABLE` session error.

### M-003 — API and business rules remain authoritative
**Status:** ACCEPTED
Mobile does not duplicate fee, status, tenancy, schedule conflict, payment verification, or profile-completion rules.

### M-004 — Native mobile UX, not pixel web port
**Status:** ACCEPTED
Use mobile navigation and touch controls while preserving capability and brand parity.

### M-005 — RAG assistant deferred
**Status:** ACCEPTED
No production chatbot until knowledge governance and retrieval corpus are established.

### M-006 — Native push deferred until backend token infrastructure
**Status:** ACCEPTED
In-app notifications implemented first. Native device push deferred pending backend device registration endpoints.

### M-007 — Direct R2 upload prohibited
**Status:** ACCEPTED
All uploads flow through backend Express multipart endpoints.

### M-008 — Offline mutations deferred
**Status:** ACCEPTED
No silent background queues for transactional workflows in v1.

### M-009 — Navigation library
**Status:** ACCEPTED
Expo Router SDK 57 with `Stack.Protected` state gates.

### M-010 — Server-state library
**Status:** ACCEPTED
TanStack Query with user-isolated query keys and immediate cache purging on sign-out.

### M-011 — Firebase mobile integration
**Status:** ACCEPTED
Native `@react-native-firebase/app` and `@react-native-firebase/auth` with platform-managed keychain/keystore persistence. Custom development build required (`expo-dev-client`); Expo Go unsupported.

### M-012 — Map library
**Status:** DEFERRED
Mobile-native map integration evaluated post-v1; directory list and detail views are authoritative.

### M-013 — E2E tool
**Status:** DEFERRED
Evaluate Maestro or Detox once native release build pipelines are established.

### M-014 — Ambiguous registration error recovery
**Status:** ACCEPTED
Never execute `firebaseUser.delete()` upon backend failure during registration. Ambiguous errors reconcile against `GET /auth/profile`.

### M-015 — Typed interactive operation mutex
**Status:** ACCEPTED
Synchronous in-flight ref `interactiveOperationRef` (`LOGIN | REGISTER | GOOGLE_LOGIN | GOOGLE_JIT_LEGAL`) suppresses passive `onAuthStateChanged` listeners while an interactive operation owns the session.

### M-016 — Google JIT legal challenge handling
**Status:** ACCEPTED
First-time Google users encounter `400 LEGAL_ACCEPTANCE_REQUIRED` on `POST /auth/login`. Acceptance is submitted via `POST /auth/login` with `legalAcceptance` payload.

### M-017 — Direct commitment of profile PUT responses
**Status:** ACCEPTED
`PUT /auth/profile` returns updated `BackendUserProfile`, which is committed directly without follow-up `GET`, eliminating navigation loops.

### M-019 — Authenticated Route Stack & Tab Navigator Hierarchy
**Status:** ACCEPTED
Authenticated `(app)` route group uses a root `Stack` owning modal and drill-down destinations above a 5-tab bottom navigator `(tabs)`.

### M-020 — Notification Badge Deferral & Bell Destination Shell
**Status:** SUPERSEDED by M-025
Replaced by full in-app notification inbox implementation with mark-as-read actions and reference routing.

### M-021 — Shared Monthly Public Event Query Discovery
**Status:** ACCEPTED
Discovery events reuse `GET /api/v1/parish-events/all?year=YYYY&month=M` across Home and Parish Detail screens to maximize cache sharing.

### M-022 — Multi-step Document Request Wizard & Step Structure
**Status:** ACCEPTED
Document request creation uses a 5-step wizard (Parish, Document Type & Requirements, Applicant Details, Attachments, Review) with client validation and backend draft persistence.

### M-023 — Client-side HEIC conversion & Payment QR Zoom Modal
**Status:** ACCEPTED
iOS HEIC receipts are converted to JPEG via `src/services/media/heicConverter.ts` before upload. Payment QR card incorporates a tap-to-enlarge modal and textual merchant details for single-device parishioners.

### M-024 — Scheduling Wizard Parity & Idempotency Keys
**Status:** ACCEPTED
Scheduling wizard dynamically consumes `GET /schedule-requests/configuration` and `GET /schedule-requests/available-slots`. Bookings submit an `Idempotency-Key` header matching backend database constraints to prevent duplicate bookings.

### M-025 — In-App Notification Inbox & Reference Deep-Linking
**Status:** ACCEPTED
In-app notifications inbox renders alerts categorized by reference type (`DOCUMENT_REQUEST`, `SCHEDULE_REQUEST`, `GENERAL`) and routes directly to target request or schedule screens.

### M-026 — Profile Edit, Settings Architecture, and Sectional Error Isolation
**Status:** ACCEPTED
Profile editing synchronizes with the backend via `PUT /auth/profile`. Settings screen embeds canonical terms and privacy policy viewers. Screen sections incorporate `ErrorBoundary` and `InlineError` retry primitives.

## 4. Implementation reconciliation snapshot — 24 August 2026

- **Backend & Database:**
  - 18 Prisma models (including `idempotency_keys`).
  - Strict `SchedulingConfiguration` and `BookingValidator` service layers.
  - All 28 backend unit/integration tests passing.
- **Mobile Application:**
  - `STATIC VERIFIED` — PASS
  - `TYPECHECK` — PASS (`npm run typecheck`, 0 errors)
  - `AUTOMATED TESTS` — PASS (22 suites, 161 tests passing)
  - `LINT` — PASS (`eslint . --max-warnings=0`, 0 errors, 0 warnings)
  - `JS/METRO ANDROID EXPORT` — PASS (`npx expo export --platform android`)
  - `PHYSICAL ANDROID RUNTIME QA` — ACTIVE (supported via `npm run dev:mobile`)

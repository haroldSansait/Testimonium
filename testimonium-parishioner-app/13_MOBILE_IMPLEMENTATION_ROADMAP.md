# TESTIMONIUM Parishioner Mobile — Implementation Roadmap

## 0. Phase 0 — Scaffold Audit & Foundations (STATUS: COMPLETED)
- Audited repository and scaffold structure.
- Initialized theme tokens, core API client with single-flight 401 retry, normalized `AppError`.
- Configured native `@react-native-firebase/app` and `@react-native-firebase/auth`.
- Base navigation shell with Expo Router and `Stack.Protected` state gates.

---

## 1. Phase 1 — Authentication & Onboarding (STATUS: COMPLETED)
### Scope Implemented
- **1A:** Configured `@react-native-google-signin/google-signin`, `expo-dev-client`, `react-hook-form`, `zod`, `eas.json` (dev and preview profiles), `environment.ts`, `legal.ts`.
- **1B:** Email Registration (`app/(auth)/register.tsx`), typed `interactiveOperationRef` guard, partial-failure reconciliation (`GET /auth/profile`, never deleting Firebase user), initial verification dispatch.
- **1C:** Email Verification (`app/(onboarding)/verify-email.tsx`), single-flight verification recheck, AppState foreground listener, 60s resend cooldown.
- **1D:** Canonical Legal Acceptance (`LegalModal.tsx`, `TermsContent.tsx`, `PrivacyContent.tsx`) and Profile Completion (`app/(onboarding)/profile-completion.tsx`) with direct PUT response commit.
- **1E:** Native Google Sign-In Adapter (`src/services/auth/googleAuth.ts`), Google JIT legal challenge (`POST /auth/login` with legal payload), cross-provider account collision handling.

---

## 2. Phase 2 — Mobile Shell, Home & Parish Directory (STATUS: COMPLETED - STATIC VERIFIED; PHYSICAL RUNTIME PENDING)
### Scope Implemented
- **2A:** Authenticated shell with root `Stack` above five-tab navigator (`Home`, `Requests`, `Schedule`, `Parishes`, `Profile`), warm ecclesiastical design tokens (`#7B1C2A` canonical primary), `@expo/vector-icons`, and reusable UI foundation (`AppHeader`, `Card`, `IconButton`, `Badge`, `SectionHeader`, `Skeleton`, `EmptyState`, `InlineError`).
- **2B:** Parish directory with debounced search, server-supported type filtering (`Parish`, `Quasi-Parish`, `Mission Station`), pagination, and pull-to-refresh. Parish detail screen with safe contact actions (`tel:`, `mailto:`, `geo:`/Maps), structured office hours, and safe back navigation fallback.
- **2C:** Home screen with personalized parishioner greeting from authenticated profile, Explore Parishes entry, and current-month public event preview (`GET /api/v1/parish-events/all?year=YYYY&month=M`) with date-only parsing, 12-hour chronological sorting, and section-local error retry. Shared upcoming event preview on parish detail.
- **2D:** Header notification bell with accessible label and dedicated `/notifications` destination shell.
- **2E:** Intentional deferred tab shells for Requests, Schedule, and Profile (with safe sign-out and cache clearing). Comprehensive automated test suites (14 suites, 75 tests passing), lint, typecheck, and static Expo Android bundle export.


---

## 3. Phase 3 — Document Request Core (STATUS: PENDING)
### Scope
- Request list & detail views.
- Multi-step sacrament certificate request wizard (Baptismal, Confirmation, First Communion, Marriage, Death/Burial).
- Canonical requirements checklists, applicant/purpose form validation, draft persistence.

---

## 4. Phase 4 — Payment & Receipt Capture (STATUS: PENDING)
### Scope
- GCash / Maya reference input and payment instructions.
- Camera and photo gallery receipt picker with client-side image compression.
- Multipart/form-data upload to backend (`/api/v1/requests/:id/receipt`).

---

## 5. Phase 5 — Scheduling & Parish Appointments (STATUS: PENDING)
### Scope
- Appointment booking for canonical interviews, counseling, and document release.
- Real-time slot availability checking, reschedule response flows.

---

## 6. Phase 6 — Notifications & Event Calendar (STATUS: PENDING)
### Scope
- Notification inbox with read/unread tracking and deep links.
- Diocesan liturgical events calendar.

---

## 7. Phase 7 — Profile, Settings & Polish (STATUS: PENDING)
### Scope
- Profile edit, security settings, legal terms viewer, full accessibility compliance, reduced-motion polish.

---

## 8. Phase 8 — Device QA & Release Engineering (STATUS: PENDING)
### Scope
- Physical Android & iOS QA verification, EAS release builds, store privacy declarations.

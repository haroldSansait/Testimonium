# TESTIMONIUM Parishioner Mobile — Implementation Roadmap

**Last reconciled:** 24 August 2026
**Implementation Summary:** Phases 0 through 7 fully completed and statically verified (22 test suites, 161 tests passing). Phase 8 physical runtime QA actively supported via `npm run dev:mobile`.

---

## Phase 0 — Scaffold Audit & Foundations (STATUS: COMPLETED)
- Audited repository and scaffold structure.
- Initialized theme tokens, core API client with single-flight 401 retry, and normalized `AppError`.
- Configured native `@react-native-firebase/app` and `@react-native-firebase/auth`.
- Base navigation shell with Expo Router and `Stack.Protected` state gates.

---

## Phase 1 — Authentication & Onboarding (STATUS: COMPLETED)
- **1A:** Configured `@react-native-google-signin/google-signin`, `expo-dev-client`, `react-hook-form`, `zod`, `eas.json`, `environment.ts`, and `legal.ts`.
- **1B:** Email Registration (`app/(auth)/register.tsx`), typed `interactiveOperationRef` guard, partial-failure reconciliation (`GET /auth/profile`), initial verification dispatch.
- **1C:** Email Verification (`app/(onboarding)/verify-email.tsx`), single-flight verification recheck, AppState foreground listener, 60s resend cooldown.
- **1D:** Canonical Legal Acceptance (`LegalModal.tsx`, `TermsContent.tsx`, `PrivacyContent.tsx`) and Profile Completion (`app/(onboarding)/profile-completion.tsx`) with direct PUT response commit.
- **1E:** Native Google Sign-In Adapter (`src/services/auth/googleAuth.ts`), Google JIT legal challenge (`POST /auth/login` with legal payload), cross-provider account collision handling.

---

## Phase 2 — Shell, Home & Parish Directory (STATUS: COMPLETED)
- **2A:** Authenticated shell with root `Stack` above five-tab navigator (`Home`, `Requests`, `Schedule`, `Parishes`, `Profile`), warm ecclesiastical design tokens (`#7B1C2A` canonical primary), and reusable UI foundation (`AppHeader`, `Card`, `IconButton`, `Badge`, `SectionHeader`, `Skeleton`, `EmptyState`, `InlineError`).
- **2B:** Parish directory with debounced search, server-supported type filtering (`Parish`, `Quasi-Parish`, `Mission Station`), pagination, and pull-to-refresh. Parish detail screen with safe contact actions (`tel:`, `mailto:`, `geo:`/Maps), office hours, and safe back navigation fallback.
- **2C:** Home screen with personalized parishioner greeting from authenticated profile, Explore Parishes entry, and current-month public event preview (`GET /api/v1/parish-events/all?year=YYYY&month=M`).
- **2D:** Header notification bell with accessible label and dedicated `/notifications` destination shell.

---

## Phase 3 — Document Request Core (STATUS: COMPLETED)
- **3A:** Multi-step Document Request Wizard (`app/(app)/requests/new.tsx`) supporting all canonical sacramental certificate types with step-by-step validation.
- **3B:** Request list screen (`app/(app)/(tabs)/(requests)/index.tsx`) with status filtering (All, Pending, Action Required, Completed), pull-to-refresh, and empty states.
- **3C:** Request detail screen (`app/(app)/requests/[requestId]/index.tsx`) with tracking number header, fee snapshot, status badge, attachment viewer, and immutable history timeline.
- **3D:** Correction resubmission workflow for requests requiring updates and safe cancellation for eligible pending requests.

---

## Phase 4 — Payment & Receipt Capture (STATUS: COMPLETED)
- **4A:** Authoritative payment configuration resolution (`GET /payment/configuration`) displaying GCash/Maya instructions and fee snapshots.
- **4B:** Interactive payment QR card (`PaymentQrCard.tsx`) with tap-to-enlarge modal and textual merchant details for single-device parishioners.
- **4C:** Media acquisition service (`mediaService.ts`) supporting Camera, Photo Gallery, and Files with client-side HEIC-to-JPEG conversion (`heicConverter.ts`).
- **4D:** Multipart receipt upload (`POST /requests/:id/receipt`) with rate-limiting tolerance, double-submit button locking, and truthful "Payment Under Review" copy.

---

## Phase 5 — Scheduling & Parish Appointments (STATUS: COMPLETED)
- **5A:** Authoritative backend parish scheduling configuration resolution (`GET /schedule-requests/configuration`) enforcing enabled canonical services, time slots, and daily/per-slot capacities without fallback invention.
- **5B:** Live 5-step Scheduling Wizard (`app/(app)/schedule/new.tsx`) with dynamic slot calculation (`GET /schedule-requests/available-slots`), 90-day booking horizon validation, and database-backed `Idempotency-Key` headers.
- **5C:** Schedule list screen (`app/(app)/(tabs)/(schedule)/index.tsx`) categorizing upcoming vs past appointments.
- **5D:** Schedule detail screen (`app/(app)/schedule/[id].tsx`) and reschedule response flow allowing parishioners to accept or decline staff proposals (`POST /schedule-requests/:id/respond-reschedule`).

---

## Phase 6 — Notifications & Event Calendar (STATUS: COMPLETED)
- **6A:** In-app notifications inbox (`app/(app)/notifications.tsx`) with unread indicators, mark-as-read, and mark-all-read actions.
- **6B:** Notification reference-based routing to specific document requests (`DOCUMENT_REQUEST`) and schedule bookings (`SCHEDULE_REQUEST`).
- **6C:** Public liturgical events calendar list screen (`app/(app)/events/index.tsx`) and event detail screen (`app/(app)/events/[id].tsx`) consuming `GET /parish-events/all`.

---

## Phase 7 — Profile, Settings & Polish (STATUS: COMPLETED)
- **7A:** Profile view (`app/(app)/(tabs)/(profile)/index.tsx`) with account status and verification badges.
- **7B:** Edit Profile screen (`app/(app)/profile/edit.tsx`) with input validation and backend profile synchronization.
- **7C:** Settings screen (`app/(app)/profile/settings.tsx`), Terms of Service viewer (`terms.tsx`), and Privacy Policy viewer (`privacy.tsx`).
- **7D:** Full-screen error boundaries, localized inline retry components, and WCAG touch target compliance (44×44 pt).

---

## Phase 8 — Device QA & Release Engineering (STATUS: IN PROGRESS)
- **8A:** Local physical Android testing via root launcher (`npm run dev:mobile` using Cloudflare Quick Tunnel).
- **8B:** EAS build profile configuration for preview APKs and production builds.
- **8C:** Physical device test checklist execution.

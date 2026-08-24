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

## Phase 8 — Mobile UI/UX Enhancement & Release Validation (STATUS: COMPLETED)
- **8A:** Design tokens synchronized with Parishioner Web (`src/theme/tokens.ts` - colors, typography, radii, spacing, shadows).
- **8B:** Safe area foundation (`Screen.tsx`, `app/(app)/(tabs)/_layout.tsx`) preventing overlap with Android 3-button and gesture bars.
- **8C:** Shared UI primitives (`BottomActionBar.tsx`, `FilterChip.tsx`, updated `AppHeader.tsx` & `Badge.tsx` status variants).
- **8D:** Welcome, Auth & Recovery (`welcome.tsx`, `login.tsx`, `forgot-password.tsx`, `register.tsx`, `verify-email.tsx`, `legal.tsx`, `profile-completion.tsx`).
- **8E:** App shell, Tab navigation, and Home dashboard (`HomeScreen.tsx`) with 6-service quick access grid, active requests, schedule summary, and event previews.
- **8F:** Document requests & wizard (`RequestListScreen.tsx`, `RequestCard.tsx`, `RequestWizardScreen.tsx`, `RequestDetailScreen.tsx`).
- **8G:** Payment & receipt capture (`PaymentScreen.tsx`, `PaymentQrCard.tsx`, `ReceiptCapturePicker.tsx`).
- **8H:** Scheduling & appointments (`ScheduleListScreen.tsx`, `ScheduleWizardScreen.tsx`, `ScheduleDetailScreen.tsx`).
- **8I:** Parish directory & detail (`ParishDirectoryScreen.tsx`, `ParishCard.tsx`, `ParishDetailScreen.tsx`).
- **8J:** Events & notifications (`EventsListScreen.tsx`, `EventDetailScreen.tsx`, `UpcomingEventsSection.tsx`, `NotificationListScreen.tsx`).
- **8K:** Profile, settings & legal (`ProfileScreen.tsx`, `EditProfileScreen.tsx`, `SettingsScreen.tsx`, `TermsOfServiceScreen.tsx`, `PrivacyPolicyScreen.tsx`).
- **8L:** Accessibility, responsiveness, and safe-area insets sweep across all screens.
- **8M:** Static regression and bundle validation (`npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npx expo export --platform android`).

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

## 2. Phase 2 — Mobile Shell, Home & Parish Directory (STATUS: READY FOR EXECUTION)
### Scope
- Bottom tabs navigation (`Home`, `Parishes`, `Requests`, `Appointments`, `Profile`).
- Home screen: Parishioner welcome banner, active sacrament requests quick tracker, upcoming appointments card, parish announcements carousel.
- Parish directory: Browse parishes within Diocese of San Carlos, search by municipality/name, view parish details, contact information, mass schedules, and sacraments offered.
- Events preview: Diocese calendar highlights.
- Notification shell: Header notification bell with unread badge.

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

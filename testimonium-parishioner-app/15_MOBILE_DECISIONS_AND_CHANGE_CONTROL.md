# TESTIMONIUM Parishioner Mobile — Decisions & Change Control

**Purpose:** Prevent stale architecture assumptions as mobile and backend evolve.

## 1. Baseline Snapshot

As of 20 August 2026:
- Backend: Express 5, Prisma 7, PostgreSQL, Firebase Admin, Cloudflare R2, Automated OCR.
- Parishioner web: React/Vite/Firebase Auth.
- Admin portal: React/Vite/Firebase Auth.
- Mobile app: Expo SDK 57, React Native 0.86.2, React 19.2.3, TypeScript 6.0.3, @react-native-firebase/auth, @react-native-google-signin/google-signin.
- Target role: PARISHIONER only.

## 2. Decision Status Labels

- `PROPOSED`
- `ACCEPTED`
- `SUPERSEDED`
- `REJECTED`
- `DEFERRED`

## 3. Decision Log

### M-001 — Existing backend is the mobile backend
**Status:** ACCEPTED
Mobile consumes `/api/v1`; it does not get a separate business backend.

### M-002 — Mobile is parishioner-only
**Status:** ACCEPTED
Staff remains in admin portal. Non-parishioner roles rejected with `ACCOUNT_UNAVAILABLE` session issue.

### M-003 — API/business rules remain authoritative
**Status:** ACCEPTED
Mobile does not duplicate fee, status, tenancy, schedule conflict, payment verification, or profile-completion rules.

### M-004 — Native mobile UX, not pixel web port
**Status:** ACCEPTED
Use mobile navigation and touch controls while preserving capability/brand parity.

### M-005 — RAG assistant deferred
**Status:** ACCEPTED
No production chatbot until knowledge governance/corpus exists.

### M-006 — Native push deferred until backend support
**Status:** ACCEPTED
Implement in-app notifications first. Native device push deferred pending backend token infrastructure.

### M-007 — Direct R2 upload prohibited
**Status:** ACCEPTED
All uploads remain through backend endpoints.

### M-008 — Offline mutations deferred
**Status:** ACCEPTED
No background queue for transactional workflows in v1.

### M-009 — Navigation library
**Status:** ACCEPTED
Expo Router SDK 57 with `Stack.Protected` state gates.

### M-010 — Server-state library
**Status:** ACCEPTED
TanStack Query with conservative retries and UID-isolated query keys.

### M-011 — Firebase mobile integration
**Status:** ACCEPTED
Native `@react-native-firebase/app` and `@react-native-firebase/auth` with platform-managed keychain/keystore persistence. Custom development build required (`expo-dev-client`); Expo Go unsupported.

### M-012 — Map library
**Status:** PROPOSED / DEFERRED
Evaluate mobile-native map solution only after parish list/detail is stable.

### M-013 — E2E tool
**Status:** PROPOSED / DEFERRED
Evaluate Maestro or Detox once native release build pipelines are established.

### M-014 — Ambiguous registration error recovery
**Status:** ACCEPTED
- **Decision:** Never execute `firebaseUser.delete()` upon backend failure during registration.
- **Rationale:** Prevents race conditions and unintended account destruction. Ambiguous errors reconcile against `GET /auth/profile`.

### M-015 — Typed interactive operation mutex
**Status:** ACCEPTED
- **Decision:** Synchronous in-flight ref `interactiveOperationRef` (`LOGIN | REGISTER | GOOGLE_LOGIN | GOOGLE_JIT_LEGAL`).
- **Rationale:** Suppresses passive `onAuthStateChanged` bootstrap while an interactive operation owns the session.

### M-016 — Google JIT legal challenge handling
**Status:** ACCEPTED
- **Decision:** First-time Google users encounter `400 LEGAL_ACCEPTANCE_REQUIRED` on `POST /auth/login`. Acceptance is submitted via `POST /auth/login` with `legalAcceptance` payload (not `POST /auth/legal-acceptance`).
- **Rationale:** First-time Google user identity is JIT-provisioned inside the `POST /auth/login` endpoint itself.

### M-017 — Direct commitment of profile PUT responses
**Status:** ACCEPTED
- **Decision:** `PUT /auth/profile` returns updated `BackendUserProfile`, which is committed directly without follow-up `GET`.
- **Rationale:** Prevents redirect loops on profile completion.

### M-018 — Native Google Sign-In local session sign-out
**Status:** ACCEPTED
- **Decision:** Use `@react-native-google-signin/google-signin` adapter. Execute local `GoogleSignin.signOut()` before an explicit Google login attempt to avoid retaining previous local SDK session state. `revokeAccess()` is NOT used.
- **Verification Status:** Actual Google account-chooser behavior remains PENDING NATIVE RUNTIME VERIFICATION.

## 4. Phase 1 Implementation Reconciliation - 20 August 2026

- **Static & Build Verification:**
  - `STATIC VERIFIED` — PASS
  - `TYPECHECK` — PASS
  - `UNIT/INTEGRATION TESTS` — PASS (8 suites, 31 tests)
  - `LINT` — PASS (0 errors, 0 warnings)
  - `EXPO DOCTOR` — PASS (21/21 checks)
  - `JS/METRO ANDROID BUNDLE` — PASS (`npx expo export --platform android`)
  - `GIT DIFF CHECK` — PASS
- **Runtime Verification (Pending Device/Native Environment):**
  - `ANDROID NATIVE COMPILE` — PENDING (Requires Gradle / EAS Build)
  - `EMULATOR` — PENDING
  - `PHYSICAL DEVICE` — PENDING
  - `REAL FIREBASE/BACKEND` — PENDING
  - `GOOGLE SIGN-IN RUNTIME` — PENDING (Requires Android OAuth client with SHA-1 in Firebase Console)
  - `iOS` — PENDING
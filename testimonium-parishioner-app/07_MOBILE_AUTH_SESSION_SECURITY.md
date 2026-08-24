# TESTIMONIUM Parishioner Mobile — Auth, Session & Security

**Last reconciled:** 24 August 2026
**Status:** Native Firebase authentication and session security fully implemented and verified.

## 1. Security architecture

- **Identity Provider:** Native Firebase Client Authentication (`@react-native-firebase/app` and `@react-native-firebase/auth`) utilizing platform-managed keychain (iOS) and keystore (Android) storage.
- **Application Authority:** TESTIMONIUM Express backend enforces application roles and permissions (`PARISHIONER` role required).
- **Session Boundary:** Mobile client obtains Firebase ID tokens and attaches them as bearer tokens. Token refreshing is managed by the native SDK.
- **Cache Isolation:** Sign-out immediately purges all TanStack query caches and cancels in-flight requests to prevent cross-user data leakage.

## 2. Authentication state machine

```text
[App Launch]
    │
    ▼
[NO_FIREBASE_USER] ──> Render (auth)/welcome or login
    │
    ▼ (User authenticated in Firebase)
[BOOTSTRAP_CHECK] ──> GET /auth/profile
    │
    ├─> User role != PARISHIONER ──> SESSION_ERROR (ACCOUNT_UNAVAILABLE)
    ├─> !isVerified              ──> (onboarding)/verify-email
    ├─> !termsAcceptedAt         ──> (onboarding)/legal
    ├─> needsProfileCompletion   ──> (onboarding)/profile-completion
    │
    ▼
[AUTHENTICATED_READY] ──> Render (app)/(tabs)
```

## 3. Interactive authentication and mutex protection

To prevent race conditions where passive `onAuthStateChanged` listeners overwrite active in-flight operations, the app uses a synchronous mutex `interactiveOperationRef` (`LOGIN`, `REGISTER`, `GOOGLE_LOGIN`, `GOOGLE_JIT_LEGAL`):

1. User triggers login/registration.
2. Mutex is acquired (`interactiveOperationRef.current = "LOGIN"`).
3. Firebase SDK authenticates user.
4. Backend `POST /auth/login` or `POST /auth/register` executes with the bearer token.
5. Returned authoritative `BackendUserProfile` is committed directly to state.
6. Navigation routes to the destination.
7. Mutex is released.

## 4. Google Sign-In and JIT legal compliance

- **Adapter:** `src/services/auth/googleAuth.ts` wraps `@react-native-google-signin/google-signin`.
- **Local Session Reset:** `GoogleSignin.signOut()` executes before sign-in to ensure clean account selection without retaining stale local sessions.
- **JIT Legal Challenge:** When a first-time Google user logs in, backend returns `400 LEGAL_ACCEPTANCE_REQUIRED`. The mobile app routes to `(onboarding)/legal`, and upon acceptance, resubmits `POST /auth/login` with `{ legalAcceptance: { termsVersion, privacyVersion } }`.
- **Account Collisions:** If `409 ACCOUNT_EXISTS_WITH_PASSWORD` is encountered, temporary sessions are cleared and the user is directed to sign in with their existing password.

## 5. Registration and partial-failure reconciliation

- **Prohibition:** The app strictly **never deletes Firebase users (`firebaseUser.delete()` is prohibited)** upon ambiguous network or backend errors.
- **Reconciliation:** If backend registration encounters a network timeout after Firebase account creation, the client reconciles state by calling `GET /auth/profile`. If the user record exists on the backend, onboarding proceeds; otherwise, the user is offered a safe retry.

## 6. Email verification lifecycle

- **Single-Flight Recheck:** Foreground rechecks triggered by `AppState` transitions to `active` are debounced to prevent concurrent token refresh races.
- **Resend Policy:** Calls `POST /auth/resend-verification` (enforcing 60-second cooldown, 5/day account limit) before invoking client `sendEmailVerification(currentUser)`.

## 7. Profile completion and direct commit

- `needsProfileCompletion` is evaluated server-side (`!fullName || !contactNumber`).
- Saving profile updates via `PUT /auth/profile` returns the updated `BackendUserProfile`, which is committed directly to client state without a redundant `GET` call, eliminating navigation loops.

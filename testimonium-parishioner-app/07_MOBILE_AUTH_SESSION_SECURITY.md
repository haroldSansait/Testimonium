# TESTIMONIUM Parishioner Mobile — Auth, Session & Security

## 1. Security Model

Identity:
- Native Firebase client authentication (`@react-native-firebase/auth`).

Application authorization:
- TESTIMONIUM backend profile/role and endpoint guards (`PARISHIONER` role required).

Database/storage:
- Backend and cloud infrastructure only.

The mobile app is not a trusted authorization boundary.

## 2. Firebase Mobile Integration

- Native Firebase SDK: `@react-native-firebase/app` and `@react-native-firebase/auth` with platform-managed keychain/keystore persistence.
- Development build via `expo-dev-client` is required for live native authentication.
- Expo Go is intentionally unsupported for native Firebase runtime authentication.
- Tokens are never manually stored in AsyncStorage or JavaScript storage.

## 3. App Bootstrap State Machine

App launch states:

```text
START
-> load Firebase auth state
-> if no user: NO_FIREBASE_USER (Auth group)
-> if user: evaluate bootstrap state (GET /auth/profile)
-> evaluate verification/legal/profile completion:
   - EMAIL_VERIFICATION_REQUIRED
   - LEGAL_REQUIRED
   - PROFILE_COMPLETION_REQUIRED
   - AUTHENTICATED_READY (App tabs)
   - SESSION_ERROR (Transient or Account Unavailable)
```

Expo Router `Stack.Protected` gates render auth, onboarding, or app tabs deterministically without flashing protected screens.

## 4. Interactive Email Login

Sequence:
1. Acquire `interactiveOperationRef = "LOGIN"`.
2. Firebase `signInWithEmailAndPassword`.
3. `POST /auth/login` with Firebase bearer token.
4. Authoritative `BackendUserProfile` received and committed.
5. Transition to appropriate route via central gate.
6. Release ownership mutex.

## 5. Google Sign-In & JIT Resolution

- **Package:** `@react-native-google-signin/google-signin` (public npm package compatible with Expo SDK 57).
- **Adapter:** `src/services/auth/googleAuth.ts` isolates native SDK calls.
- **Feature Gate:** `EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED` (disabled by default until Firebase Console Android OAuth client is configured with development SHA-1).
- **Credential Exchange:** Google ID token → `GoogleAuthProvider.credential(idToken)` → `signInWithCredential` → `POST /auth/login`.
- **Account Selection & Local Session Handling:**
  - Local Google SDK sign-out (`GoogleSignin.signOut()`) occurs before an explicit Google login attempt to avoid intentionally retaining the previous local SDK session state.
  - `revokeAccess()` is NOT used so existing server authorization grants remain valid.
  - Actual Google account-chooser presentation and UX behavior remains **PENDING NATIVE RUNTIME VERIFICATION** on physical devices / emulator.
- **First-time Google JIT User:** On `400 LEGAL_ACCEPTANCE_REQUIRED`, sets `pendingLegalAction = "GOOGLE_JIT_LOGIN"` and routes to Legal screen. Accepting legal resubmits `POST /auth/login` with `legalAcceptance` payload.
- **Cross-Provider Conflict:** On `409 ACCOUNT_EXISTS_WITH_PASSWORD`, cleans up temporary Firebase and local Google sessions, and directs user to sign in with their password.

## 6. Email Registration & Partial-Failure Reconciliation

Sequence:
1. Validate structured names, password rules, and legal acceptance.
2. Acquire `interactiveOperationRef = "REGISTER"`.
3. Firebase `createUserWithEmailAndPassword`.
4. `POST /auth/register` with `registrationProfile` and legal compliance payload.
5. Commit returned `BackendUserProfile`.
6. Dispatch initial verification email via native `sendEmailVerification`.
7. Transition to `EMAIL_VERIFICATION_REQUIRED`.

### Ambiguous Failure Recovery Rule:
- **NEVER delete Firebase user (`firebaseUser.delete()` prohibited)** upon ambiguous network/timeout/5xx errors during registration.
- Reconcile via `GET /auth/profile`. If profile exists, commit and continue; otherwise, allow safe retry or sign out.

## 7. Email Verification Lifecycle

- **Full Single-Flight Check:** Debounces concurrent checks (`user.reload()` → verify current generation → `getIdToken(true)` → `refreshProfile()` → `commitProfile`).
- **AppState Integration:** Debounced single-flight verification recheck occurs on transition to `active` when in `EMAIL_VERIFICATION_REQUIRED` state.
- **Resend Flow:** Calls backend `POST /auth/resend-verification` (enforcing 60s cooldown, 5/day account limit, 3/hr IP limit) → upon 200, calls client `sendEmailVerification(currentUser)`.

## 8. Legal Acceptance Architecture

- **Normal Legal Acceptance:** `POST /auth/legal-acceptance` updates existing profile.
- **Google JIT Legal Challenge:** Re-submits `POST /auth/login` with legal payload.
- **Canonical Content:** Embedded native viewer (`LegalModal.tsx`) using canonical text from `testimonium-parishioner-web` (`TermsContent.tsx`, `PrivacyContent.tsx`) and version constants (`v1.0`).

## 9. Profile Completion Architecture

- **Backend Authority:** `needsProfileCompletion` is calculated solely by backend (`!fullName || !contactNumber`).
- **Save Flow:** `PUT /auth/profile` returns updated `BackendUserProfile`. The returned profile is committed directly without a redundant `GET` call, eliminating redirect loops.

## 10. Role Safety & Cache Isolation

- Mobile app is strictly for `PARISHIONER` role. Any other role immediately triggers `SESSION_ERROR` (`ACCOUNT_UNAVAILABLE`, non-retryable) with Sign Out action.
- On logout / account switch: Invalidate monotonic `generationRef`, cancel in-flight queries, clear TanStack Query cache, sign out Firebase, sign out local Google session.

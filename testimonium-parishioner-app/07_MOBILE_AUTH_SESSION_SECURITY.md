# TESTIMONIUM Parishioner Mobile — Auth, Session & Security

## 1. Security model

Identity:
- Firebase client authentication.

Application authorization:
- TESTIMONIUM backend profile/role and endpoint guards.

Database/storage:
- backend only.

The mobile app is not a trusted authorization boundary.

## 2. Firebase mobile integration

The repository currently has an Expo mobile scaffold, but the exact Firebase package/persistence setup must be audited before implementation.

If using Firebase JS SDK in React Native:
- use the supported React Native persistence integration;
- let Firebase own auth persistence;
- do not manually copy ID/refresh tokens into AsyncStorage/SecureStore.

If the scaffold uses a native Firebase library:
- follow that library's persistence/session model;
- preserve the same higher-level TESTIMONIUM bootstrap rules.

Do not switch Firebase stacks during an unrelated feature.

## 3. App bootstrap

App launch states:

```text
START
-> load Firebase auth state
-> if no user: AUTH
-> if user: fetch GET /auth/profile
-> evaluate verification/legal/profile completion
-> MAIN APP or onboarding state
```

Display a dedicated bootstrap/splash state while this is unresolved. Do not briefly flash protected screens.

## 4. Interactive email login

Conceptual sequence:

```text
user submits credentials
-> disable all login methods
-> Firebase sign-in
-> POST /auth/login with Firebase bearer token
-> receive authoritative BackendUserProfile
-> store profile
-> enter correct onboarding/main route
-> re-enable/reset loading state
```

A failed backend bootstrap after Firebase sign-in must not be silently treated as a completed TESTIMONIUM login.

## 5. Google login

Mobile account chooser behavior depends on the chosen Expo/Firebase integration. Preserve the product requirement:

> The user must be able to intentionally choose a different Google account rather than being permanently trapped in the last-used identity.

Do not assume the web-only `prompt: "select_account"` behavior maps identically to a native Google provider. During auth implementation, verify the actual provider options supported on Android/iOS.

## 6. Registration

Registration must preserve:
- Firebase identity;
- backend `/auth/register`;
- email verification policy;
- legal acceptance;
- structured profile/name data;
- profile-completion routing.

Do not locally set `needsProfileCompletion=false`. Backend profile remains authoritative.

## 7. Auth observer race rule

Do not allow:

```text
Firebase sign-in succeeds
-> auth observer starts GET /auth/profile
-> POST /auth/login bootstrap still pending
-> GET failure/stale profile overwrites successful login state
```

Use one of:
- explicit interactive-auth in-flight ref;
- shared bootstrap promise;
- reducer/state machine that gives interactive flow ownership.

Pick the smallest solution compatible with scaffold.

## 8. Profile refresh

`refreshProfile()` should:
1. call `GET /auth/profile`;
2. normalize;
3. store;
4. return the same fresh profile.

Do not return stale closure state.

## 9. Session persistence

Mobile differs from browser "Remember Me".

Native apps normally preserve auth across launches unless the user explicitly logs out or session policy invalidates it.

Do not add a web-style "Keep me signed in" checkbox to mobile by default.

Instead:
- persist auth according to supported Firebase native behavior;
- respect TESTIMONIUM session-expiration/security policy;
- provide explicit Logout;
- reauthenticate when backend/Firebase state requires it.

If product later requires a "shared device" mode, design it separately.

## 10. Idle/absolute session policy

The existing system has application-level session/security behavior in addition to Firebase persistence.

Mobile must preserve equivalent policy, but do not duplicate magic timeout values in multiple clients if the source can be centralized.

During implementation:
- inspect current parishioner web session rules;
- identify exact idle/absolute timeout source;
- decide whether mobile needs identical behavior or a documented mobile variant;
- ensure persistent Firebase auth does not bypass application session policy.

## 11. Secure local storage

Do not manually store:
- password;
- Firebase ID token;
- Firebase refresh token;
- Google OAuth access token;
- backend credentials.

If app-specific sensitive small values require local secure storage, use platform secure storage (for example Expo SecureStore if compatible) rather than plain AsyncStorage.

Non-sensitive preferences may use AsyncStorage.

## 12. Cache clearing on logout

On logout:
- clear server query cache for user-specific data;
- clear local profile/request/schedule state;
- cancel protected in-flight requests;
- clear app-specific secure/session markers;
- sign out Firebase;
- reset navigation.

Do not leave a previous user's request cards visible to the next user.

## 13. App switcher/privacy

Consider whether highly sensitive screens (receipt/document preview) require obscuring in app switcher. This is optional for v1 and should be decided deliberately rather than applied globally.

Do not prevent screenshots globally unless product/legal requirements demand it; that can harm usability and accessibility.

## 14. Network security

Production:
- HTTPS only;
- no cleartext API endpoints;
- environment-specific API base URL;
- validate production build config.

Certificate pinning is not required for initial v1 unless threat model/product policy requires it. Do not add fragile pinning without an operational rotation plan.

## 15. PII logging

Never log:
- full applicant data;
- addresses;
- phone numbers;
- auth tokens;
- receipt OCR raw text;
- document attachment URLs;
- legal payload contents beyond necessary debug-safe metadata.

Production error reporting should redact user data.

## 16. Rate limiting

Handle backend rate limits gracefully.

Do not retry aggressively.

Verification resend and receipt upload are specifically rate-sensitive flows.

## 17. Authorization failures

A 403 must not trigger token-refresh loops.

403 means:
- wrong role/scope/ownership;
- stale UI;
- endpoint mismatch;
- backend policy.

Show a safe user message and investigate the client contract.

## 18. Security regression checklist

Before auth release:
- fresh email registration;
- verified existing email login;
- Google existing user;
- Google new/JIT user if supported;
- logout;
- account switching;
- restored session;
- expired token;
- disabled/inactive account if backend enforces;
- profile completion;
- legal acceptance;
- 401 retry maximum one;
- 403 no retry loop;
- logout while query in flight;
- user A logout → user B login does not show user A data.

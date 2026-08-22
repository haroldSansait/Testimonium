# TESTIMONIUM Parishioner Mobile
# PHASE 1 — Authentication & Onboarding Implementation
# 1A → 1B → 1C → 1D → 1E

Implement Phase 1 in:

testimonium-parishioner-app

Work from the TESTIMONIUM repository root.

Read and use:

testimonium-parishioner-app/MOBILE_PHASE1.md

the completed Phase 1 implementation plan,

and all relevant mobile documentation.

IMPORTANT:

The existing Phase 0 IMPLEMENTATION is authoritative over older planning text.

Do not redesign Phase 0 architecture.

This prompt contains corrections to the Phase 1 implementation plan and
SUPERSEDES conflicting details in that plan.

---

# CURRENT PHASE 0 BASELINE — PRESERVE

Current implemented architecture:

- Expo SDK 57
- React 19.2.3
- React Native 0.86.2
- TypeScript
- Expo Router
- Stack.Protected route gates
- native Firebase:
  - @react-native-firebase/app
  - @react-native-firebase/auth
- platform-managed Firebase session persistence
- TanStack Query
- private query-key user isolation
- centralized API client
- normalized AppError
- timeout vs cancellation
- bearer token injection
- exactly one retry after 401
- single-flight forced token refresh
- auth-generation stale-response protection
- interactive auth ownership
- failed backend-bootstrap rollback
- parishioner-only role gate
- protected cache cancellation/clearing on logout
- five mobile app tabs
- #7B1C2A TESTIMONIUM parishioner primary brand color

DO NOT:

- revert to Firebase JS SDK
- manually store Firebase tokens
- replace Expo Router
- replace TanStack Query
- introduce Redux/Zustand/Jotai
- weaken cache isolation
- weaken auth generation checks
- remove the one-401-retry rule

---

# EXECUTION STRATEGY

Implement as ONE controlled pass with internal checkpoints:

Phase 1A
Native development-build readiness

Phase 1B
Email registration + verification

Phase 1C
Legal acceptance + profile completion

Phase 1D
Google Sign-In integration + JIT handling

Phase 1E
UX/accessibility/regression hardening

After each subphase:

- typecheck the touched architecture where practical
- fix errors before continuing
- do not wait until the end to resolve structural issues

Do not commit automatically.

---

# =============================================
# PHASE 1A — NATIVE DEVELOPMENT BUILD READINESS
# =============================================

## expo-dev-client

Add:

expo-dev-client

using the Expo-compatible installation method:

npx expo install expo-dev-client

This is required because native Firebase and future native Google Sign-In cannot
run in Expo Go.

---

# DEVELOPMENT BUILD WORKFLOW

Preserve Continuous Native Generation.

Do not permanently commit generated:

android/
ios/

unless the repository intentionally changes strategy.

Add practical package scripts for:

- development build/prebuild
- Android local development where environment supports it

Use existing naming conventions.

Possible scripts:

prebuild
android:dev
ios:dev

but inspect current package.json first.

Do not overwrite existing useful scripts.

---

# EAS

A minimal eas.json is acceptable now because native development builds are part of
Phase 1.

Keep it small.

Development profile:
- developmentClient true
- internal distribution

Preview:
- internal distribution

Production:
- minimal placeholder only if useful

Do not add secrets to eas.json.

Do not require an authenticated EAS remote build to declare Phase 1 complete.

---

# NATIVE VERIFICATION TERMINOLOGY

Use these terms accurately:

STATIC VERIFIED
NATIVE CONFIG VERIFIED
JS/METRO BUNDLE VERIFIED
ANDROID NATIVE COMPILE VERIFIED
EMULATOR VERIFIED
PHYSICAL DEVICE VERIFIED
REAL FIREBASE/BACKEND VERIFIED

IMPORTANT:

npx expo export --platform android

is:

JS/METRO BUNDLE VERIFIED

It is NOT:

ANDROID NATIVE COMPILE VERIFIED.

A native compile requires generated Android native project + Gradle compilation,
such as assembleDebug, when the environment supports it.

If Android SDK/Gradle is unavailable:

mark:

ANDROID NATIVE COMPILE — NOT VERIFIED

Do not fail all of Phase 1 solely for missing local Android tooling.

---

# CNG / PREBUILD SAFETY

If running:

npx expo prebuild --clean

or platform-specific prebuild for configuration validation:

- ensure generated native directories remain ignored if CNG is the chosen strategy
- do not accidentally commit generated native folders
- report exactly what was generated and cleaned

Do not run destructive prebuild against unrelated repository work.

---

# ===============================
# PHASE 1B — EMAIL REGISTRATION
# ===============================

Trace actual backend implementation again before modifying orchestration.

Current known endpoint:

POST /auth/register

requires:

termsAccepted: true
privacyAccepted: true
legal versions
registration profile

Do not change backend contract.

---

# FORM STACK

Phase 1 now has enough forms to justify:

react-hook-form
zod

If using:

zodResolver

also add:

@hookform/resolvers

Use current compatible versions.

Do NOT pin stale:

zod ^3.24

from the planning document.

Use the currently supported package release compatible with the project.

Backend validation remains authoritative.

Zod is client UX validation only.

Do not duplicate every backend refinement.

---

# REGISTRATION FIELDS

Use actual backend/web contract.

Expected current fields:

First Name — required
Middle Name — optional
Last Name — required
Suffix — optional
Email
Password
Confirm Password
Terms acceptance
Privacy acceptance

Do not add unrelated profile fields to initial registration unless the backend
currently requires them.

---

# PASSWORD VALIDATION

Inspect current parishioner-web and Firebase/backend policy.

Do NOT invent stricter password rules for mobile.

Do NOT implement fake password-strength security.

At minimum:
- valid email UX
- password according to current policy
- confirm password matches

Use Firebase/backend errors as authoritative.

---

# DOUBLE SUBMISSION

Do NOT implement a fixed:

2.5 second debounce

or arbitrary timeout.

Use:

- synchronous in-flight ref / interactive auth operation guard
- disabled button
- loading state

The first invocation must synchronously acquire ownership before asynchronous work
begins.

A second invocation while owned must return immediately.

---

# INTERACTIVE AUTH OWNERSHIP

Generalize the existing Phase 0 mechanism cleanly.

Conceptually:

interactiveOperationRef:

null
LOGIN
REGISTER
GOOGLE_LOGIN
GOOGLE_JIT_LEGAL

or equivalent typed representation.

Set ownership BEFORE the Firebase operation that can trigger onAuthStateChanged.

Observer behavior:

if an interactive operation owns auth bootstrap:
    do NOT start competing passive GET /auth/profile

Do not create separate unrelated mutexes for every auth method.

---

# REGISTRATION SEQUENCE — CORRECTED

Preferred sequence:

1. Validate form.
2. Acquire REGISTER interactive ownership.
3. Increment/capture auth generation as appropriate.
4. Set bootstrap state pending.
5. Firebase createUserWithEmailAndPassword.
6. Verify Firebase UID/current generation.
7. POST /auth/register with:
   - registrationProfile
   - Terms acceptance
   - Privacy acceptance
   - current supported legal versions
8. Receive authoritative BackendUserProfile.
9. Commit that profile.
10. Attempt INITIAL Firebase email verification send.
11. Transition to EMAIL_VERIFICATION_REQUIRED.
12. Release operation ownership.

IMPORTANT:

The initial verification email should normally be sent AFTER the backend
registration has been established.

Do not send a verification email for an application registration that has not yet
successfully established/reconciled backend state.

If repository/backend behavior makes this sequence impossible:
report why before changing it.

---

# USE CURRENT RNFIREBASE MODULAR API

Preserve the Phase 0 modular React Native Firebase style.

Prefer current exported functions such as:

createUserWithEmailAndPassword(...)
sendEmailVerification(...)
reload(...)
getIdToken(...)
signOut(...)

rather than introducing inconsistent legacy namespaced syntax.

Use the actual API exposed by installed @react-native-firebase/auth.

Do not mix architectural styles unnecessarily.

---

# ====================================================
# CRITICAL — PARTIAL REGISTRATION FAILURE RECOVERY
# ====================================================

DO NOT implement the plan's:

firebaseUser.delete()

cleanup after POST /auth/register failure.

This is prohibited for ambiguous backend failures.

Why:

POST /auth/register may have:
- reached authenticateFirebaseToken
- created/resolved a PostgreSQL user
- committed registration/legal state
- completed on the server
while the mobile client only experienced:
- timeout
- dropped connection
- lost response
- 5xx at a later stage

Deleting the Firebase identity afterward could leave an orphaned PostgreSQL
identity and make future recovery worse.

---

# REGISTRATION FAILURE CLASSIFICATION

Handle separately:

## A. Firebase creation fails

Examples:
- email already in use
- weak password
- invalid email

Behavior:
- no backend request
- release interactive ownership
- show safe mapped error
- no Firebase deletion is needed

## B. Firebase succeeds, backend returns deterministic validation/business error

Do not delete the Firebase identity automatically.

Attempt safe reconciliation where appropriate.

Provide:
- retry setup
- sign out/use another account
- safe explanation

## C. Firebase succeeds, backend result is AMBIGUOUS

Examples:
- NETWORK
- TIMEOUT
- SERVER/5xx after request may have reached backend

NEVER delete Firebase user.

Attempt reconciliation:

GET /auth/profile

using the same Firebase identity.

If a BackendUserProfile exists:
- commit it
- evaluate normal onboarding gates

If backend registration clearly completed:
- continue normally

If a profile exists but onboarding is incomplete:
- route according to backend-authoritative state

If backend profile truly does not exist and current backend behavior provides no
safe automatic recovery:
- remain outside protected app
- expose Retry Setup / Sign Out
- do not invent a database user locally

If current backend safely supports retrying POST /auth/register for the same
Firebase UID:
reuse the SAME Firebase user and same current form payload.

Do NOT call createUserWithEmailAndPassword again.

---

# COLD-START PARTIAL REGISTRATION

Explicitly inspect current backend behavior for:

Firebase password user exists
but registration process was interrupted before mobile received success.

On next launch:

Firebase restores identity
→ passive GET /auth/profile

Determine actual backend result from current middleware.

Implement deterministic behavior based on CURRENT code.

Do not blindly claim:

"authenticateFirebaseToken will JIT provision it"

unless the actual GET /auth/profile path does that.

If backend profile is recovered:
evaluate normal gates.

If not:
use a safe setup/session recovery state with Logout.

Do not crash or loop.

---

# INITIAL VERIFICATION EMAIL FAILURE

If:

POST /auth/register succeeds
but
sendEmailVerification fails

DO NOT roll back registration.

The account/backend profile already exists.

Route to Verify Email with a clear warning:

verification email could not be sent

and allow:

Resend Verification Email

through the normal backend-controlled resend path.

---

# ==============================
# EMAIL VERIFICATION FLOW
# ==============================

Verify Email screen must support:

- destination email display
- manual "I've verified my email" action
- resend
- backend rate-limit/cooldown feedback
- AppState foreground recheck
- Logout / Use Different Account

---

# VERIFICATION CHECK MUST BE FULL SINGLE-FLIGHT

Do NOT single-flight only refreshProfile().

Single-flight the ENTIRE verification check:

reload Firebase user
→ verify generation/current UID
→ inspect emailVerified
→ if verified:
     force fresh Firebase ID token
     → refresh backend profile
     → commit profile
     → evaluate next gate

Only one verification-check promise may run at once.

This protects:

AppState foreground event
+
manual "I've verified" tap

from performing duplicate reload/token/profile calls.

---

# VERIFICATION GENERATION SAFETY

Every verification check captures:

uid
authGeneration

Before each important state commit:

verify:
- generation is still current
- Firebase currentUser UID still matches

If user logs out during verification:

late reload/profile results must be ignored.

---

# APPSTATE

Do not poll.

When app transitions from:

background/inactive
→ active

and current bootstrap state is:

EMAIL_VERIFICATION_REQUIRED

perform at most one controlled verification check.

Debounce rapid lifecycle transitions if necessary.

Do not refetch profile on every foreground event globally.

---

# RESEND FLOW

Current backend behavior:

POST /auth/resend-verification

performs server/account rate-limit bookkeeping.

Only after backend allows the resend:

call Firebase:

sendEmailVerification(currentUser)

Do not bypass the backend limiter.

Backend 429:
- honor retryAfter if returned
- show countdown

Backend 200:
- attempt Firebase send
- start local UX cooldown

Local countdown is ADVISORY UX only.

It does not replace backend rate limiting.

If user restarts app and local timer disappears:
backend remains authoritative.

---

# RESEND DOUBLE TAP

Use synchronous in-flight protection.

Do not let two backend resend requests race.

---

# ==============================
# PHASE 1C — LEGAL ACCEPTANCE
# ==============================

Centralize legal configuration.

Create one source for current mobile legal versions, for example:

src/config/legal.ts

Do not repeat:

"v1.0"

throughout screens/providers.

---

# LEGAL VERSION COMPATIBILITY NOTE

The backend currently validates supported Terms/Privacy versions.

Mobile must send the current supported version.

However:

installed mobile clients may outlive backend legal-version changes.

Document this as an API compatibility watch item.

Do not attempt to solve it by inventing a new backend endpoint in this phase.

Do not silently hardcode versions in multiple files.

---

# CANONICAL LEGAL CONTENT

Do NOT write new legal clauses.

Inspect:

testimonium-parishioner-web

and locate the currently canonical:

Terms
Privacy

content.

Mobile may adapt PRESENTATION for React Native, but:

- wording must remain exact
- sections must remain complete
- no semantic rewriting
- no new claims

Prefer one mobile legal-content source per document.

Add a clear source/version comment such as:

Source: testimonium-parishioner-web/... as reconciled YYYY-MM-DD
Legal version: v1.0

This does not make mobile the canonical legal authority; it documents the snapshot.

---

# LEGAL VIEWER

Provide an accessible React Native viewer/modal/screen for Terms and Privacy.

Requirements:

- scrollable
- readable at larger system font sizes
- close/dismiss action
- semantic headings where feasible
- no tiny fixed-height text
- acceptance controls remain outside/clearly separated from content

Do not require the user to scroll to the bottom merely to enable acceptance unless
the existing product explicitly requires that behavior.

---

# NORMAL LEGAL ACCEPTANCE

For a backend profile that already exists and requires updated/missing legal
acceptance:

POST /auth/legal-acceptance

with current versions.

Use returned fresh BackendUserProfile.

Commit directly.

Do not optimistically set:

termsAccepted = true
privacyAccepted = true

before backend response.

---

# =================================================
# GOOGLE JIT LEGAL ≠ NORMAL LEGAL ACCEPTANCE
# =================================================

This distinction is CRITICAL.

A first-time Google user may receive:

400 LEGAL_ACCEPTANCE_REQUIRED

from:

POST /auth/login

BEFORE a final BackendUserProfile has been provisioned.

Therefore normal:

POST /auth/legal-acceptance

is NOT automatically the correct action.

Add explicit pending legal context.

Conceptually:

pendingLegalAction:
  null
  |
  {
    kind: "EXISTING_PROFILE_LEGAL";
    uid;
    generation;
  }
  |
  {
    kind: "GOOGLE_JIT_LOGIN";
    uid;
    generation;
  }

Adapt to existing architecture.

---

# LEGAL SUBMIT ROUTING

If:

pendingLegalAction.kind === EXISTING_PROFILE_LEGAL

→ POST /auth/legal-acceptance
→ commit returned profile

If:

pendingLegalAction.kind === GOOGLE_JIT_LOGIN

→ re-submit POST /auth/login
   with legalAcceptance payload
→ backend performs JIT provisioning
→ receive profile
→ commit profile

Do not call the wrong endpoint.

---

# GOOGLE LEGAL CANCEL

If first-time Google JIT user is on Legal and chooses:

Cancel
Use another account
Sign out

then:

- invalidate current auth generation
- clear pending legal state
- sign out Firebase
- sign out local Google SDK session where applicable
- clear protected query/cache state
- return to auth

Do not leave Firebase authenticated in an unresolved JIT state.

---

# ======================================
# PROFILE COMPLETION
# ======================================

Backend is authoritative.

Current backend:

needsProfileCompletion

must decide whether onboarding is complete.

Do not recreate that rule in mobile.

---

# PROFILE FIELDS

Use fields supported by actual PUT /auth/profile.

Expected:

firstName
middleName
lastName
suffix
contactNumber
address

Inspect current backend validator before finalizing client schema.

---

# PHONE VALIDATION

Do NOT blindly enforce:

09XXXXXXXXX

or:

+639XXXXXXXXX

unless that matches the current backend/web policy.

Use the actual current validation rule.

If backend only requires a non-empty contact value:
mobile may provide helpful normalization but must not impose a stricter unsupported
rule.

Backend remains authoritative.

---

# PROFILE SAVE — CORRECTED

Do:

PUT /auth/profile
→ receive fresh BackendUserProfile
→ verify current UID/auth generation
→ commit THAT SAME returned profile
→ evaluate needsProfileCompletion

Do NOT automatically follow successful PUT with:

GET /auth/profile

when PUT already returns the authoritative fresh profile.

This eliminates:
- redundant request
- stale GET race
- "save succeeded but refresh failed" false failure

Only use GET fallback if actual backend response contract lacks a complete profile.

---

# PROFILE COMPLETION RESULT

If returned profile:

needsProfileCompletion === false

central gate transitions to AUTHENTICATED_READY.

If true:
- remain on profile completion
- show a useful message
- do not duplicate backend completion logic to guess which hidden rule failed

Preserve form values.

---

# PROFILE SAVE RACES

Protect against:

- double submit
- logout during save
- account switch during save
- stale response after new generation

No late old-generation PUT response may enter app tabs.

---

# ==============================
# CENTRAL GATE ORDER
# ==============================

Preserve centralized destination evaluation.

Order:

1. Backend role/status safety
2. Firebase/backend email verification
3. Legal requirement
4. Profile completion
5. Authenticated app

Do not implement competing useEffect redirects on every screen.

Screens perform actions.
AuthProvider/bootstrap determines destination.

---

# ROLE / ACCOUNT SAFETY

Mobile is parishioner-only.

If:

role !== PARISHIONER

or:

status !== ACTIVE

never expose `(app)` tabs.

Do not classify every such case as a retryable transient session error.

Represent session/access error metadata clearly.

Example concept:

sessionIssue:
{
  kind:
    "TRANSIENT_BOOTSTRAP"
    | "ACCOUNT_UNAVAILABLE"
    | "SESSION_EXPIRED";
  message;
  retryable;
}

For non-parishioner or inactive account:

retryable = false

Offer:

Sign Out / Use Different Account

Do not show a useless Retry loop.

For transient network/profile bootstrap failure:

retryable = true

Offer Retry + Sign Out.

---

# =============================================
# PHASE 1D — GOOGLE SIGN-IN
# =============================================

Current external blocker:

Android Firebase OAuth configuration is incomplete.

google-services.json currently has no usable OAuth client entries for Google
Sign-In.

Google runtime verification therefore remains PENDING.

---

# GOOGLE PACKAGE POLICY

Evaluate the CURRENT package before installation.

Preferred package family:

@react-native-google-signin/google-signin

BUT:

Do not silently introduce a paid/private-registry Universal Sign-In license.

Current public/free package and licensed Universal implementation have different
Android internals/APIs.

If the repository does NOT already have licensed Universal access:

- use the public package available through the normal npm registry
- isolate all package-specific behavior behind a Google auth service/adapter
- document that the public Android implementation relies on Google's legacy
  Sign-In SDK and may require future migration

If licensed Universal access is already explicitly configured:

- you may use the Universal API
- document the licensed dependency
- use its supported explicit account-selection capability where appropriate

DO NOT create:
- .npmrc with private package token
- paid registry requirement
- license dependency

without existing project authorization.

---

# GOOGLE ADAPTER

Do not put Google SDK calls directly throughout AuthProvider/screens.

Create a small adapter such as:

src/services/auth/googleAuth.ts

Responsibilities:

- configure Google SDK exactly once
- check whether Google auth is intentionally enabled
- begin Google authentication
- normalize cancellation
- obtain ID token
- local Google sign-out
- expose safe configuration status

AuthProvider owns TESTIMONIUM orchestration.

Google adapter owns package-specific details.

---

# GOOGLE FEATURE GATING

Do NOT use only:

Boolean(EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)

as proof that Google is configured.

A web client ID alone does not prove:

- Android OAuth client exists
- SHA-1 matches
- package name matches
- Firebase config is current

Use an explicit public configuration switch such as:

EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED=false

defaulting to false.

Google UI is shown only when:

- feature flag is true
- required public client configuration exists

External Firebase/Google console setup remains a documented prerequisite.

Runtime SDK errors must still be handled even when enabled.

---

# GOOGLE WEB CLIENT ID

The Google Sign-In SDK must be configured with the correct WEB OAuth client ID
when required to obtain an ID token for Firebase credential exchange.

Do not confuse:

Android OAuth client ID

with:

Web OAuth client ID.

Do not hardcode client IDs into source.

Use public environment/config.

These are client identifiers, not backend secrets.

---

# GOOGLE CONFIG PLUGIN

For Expo + Firebase:

configure the Google Sign-In config plugin correctly.

Keep:

android.googleServicesFile

consistent with existing Firebase setup.

Do not add iOS plist path unless the file actually exists.

If iOS config is absent:
do not break Android builds merely to reference a nonexistent plist.

Document iOS as pending.

---

# GOOGLE AUTH FLOW

Conceptually:

1. User explicitly chooses Continue with Google.
2. Acquire GOOGLE_LOGIN interactive ownership.
3. Capture/increment auth generation.
4. Invoke Google adapter.
5. If cancelled:
   - release ownership
   - no scary error
6. Obtain Google ID token.
7. Exchange for Firebase Google credential.
8. Firebase signInWithCredential.
9. Observer is suppressed because interactive operation owns bootstrap.
10. POST /auth/login without fabricated profile state.
11. Handle:
    - success
    - LEGAL_ACCEPTANCE_REQUIRED
    - ACCOUNT_EXISTS_WITH_PASSWORD
    - role/status failure
    - network/server failure

---

# FIREBASE GOOGLE CREDENTIAL

Use the current modular @react-native-firebase/auth API compatible with Phase 0.

Do not use web:

signInWithPopup

Do not use web:

setCustomParameters({ prompt: "select_account" })

unless the actual selected native Google package explicitly exposes an equivalent
supported option.

---

# GOOGLE CANCELLATION

Native account chooser cancellation is NORMAL user behavior.

Return to Login/Welcome.

Do not show:
"Authentication failed"

unless an actual failure occurred.

---

# =====================================================
# GOOGLE ACCOUNT CHOOSER — DO NOT OVERCLAIM
# =====================================================

The Phase 1 plan claimed:

GoogleSignin.signOut()
→ GoogleSignin.signIn()
→ guaranteed chooser

Do NOT treat that as a guaranteed package contract.

If using the free/original GoogleSignin API:

- local Google signOut before a fresh user-initiated login may be used where
  appropriate
- do NOT call revokeAccess
- treat "choose different account" behavior as RUNTIME VERIFICATION PENDING
- do not document it as guaranteed until tested

If using Universal Sign-In with explicit supported account-selection options:
use the documented API instead.

Do not revoke Google authorization merely to show account selection.

---

# TESTIMONIUM LOGOUT WITH GOOGLE

When current Firebase identity used Google:

normal TESTIMONIUM logout should:

- clear TESTIMONIUM state/cache
- Firebase signOut
- perform local Google SDK signOut where appropriate

Do NOT revoke Google authorization.

This helps prevent unintended silent reuse on the next explicit Google login.

Still mark actual chooser behavior as runtime pending until tested.

---

# =====================================
# GOOGLE BACKEND RESULT MATRIX
# =====================================

## Existing Google user

POST /auth/login
→ profile
→ central gates

## First-time Google user

POST /auth/login
→ LEGAL_ACCEPTANCE_REQUIRED
→ pendingLegalAction = GOOGLE_JIT_LOGIN
→ Legal screen
→ accept
→ POST /auth/login WITH legal payload
→ JIT BackendUserProfile
→ central gates

## Existing password account with same email

Backend:
409 ACCOUNT_EXISTS_WITH_PASSWORD

CRITICAL CLEANUP:

Firebase Google authentication may already have succeeded.

Before telling the user to use password login:

- invalidate current auth generation
- clear pending auth/JIT state
- Firebase signOut
- local Google SDK signOut
- clear any protected cache created during attempt

Then display safe guidance:

"This email is already registered with a password. Sign in using your email and
password."

Do not leave Google Firebase identity active.

## Non-parishioner / inactive account

Never enter app tabs.

Use non-retryable account-unavailable state.

Allow Sign Out / Use Different Account.

## Backend/network failure after Firebase Google login

This is an authenticated Firebase identity with unresolved TESTIMONIUM bootstrap.

Do not expose app tabs.

For NETWORK/TIMEOUT/5xx:
- keep deterministic safe state
- allow Retry Bootstrap
- allow Sign Out

Use current generation checks.

Do not create another Firebase Google account/auth attempt for retry.

---

# GOOGLE PENDING LEGAL + PROCESS RESTART

Explicitly inspect actual backend behavior for:

Firebase Google identity exists
but JIT legal acceptance was not completed
and app process is killed.

On restore:

passive GET /auth/profile

may or may not find a profile depending on current backend middleware.

Do NOT guess.

If current backend provides a specific recoverable missing-profile condition for a
Google provider:
perform one controlled bootstrap recovery using POST /auth/login so the
LEGAL_ACCEPTANCE_REQUIRED challenge can be rediscovered.

Do not run POST /auth/login on every passive restore.

Only use provider-specific recovery when the actual backend response proves it is
needed/safe.

If no safe contract exists:
show recoverable session/setup state + Sign Out and document the limitation.

Do not add a backend contract silently.

---

# ===============================
# GOOGLE CONFIGURATION FAILURE
# ===============================

Map configuration problems safely.

Examples:

- missing OAuth client
- DEVELOPER_ERROR
- Play Services unavailable
- invalid webClientId

Do not expose raw native exception dumps.

A development configuration problem may show a development-friendly message under
__DEV__, but production user copy should be generic and safe.

Google UI should remain hidden while the explicit feature flag is disabled.

---

# ===============================
# PHASE 1E — AUTH UI
# ===============================

Implement polished:

Welcome
Login
Register
Verify Email
Legal
Profile Completion

using existing mobile design foundations.

Do not port desktop layouts.

---

# BRANDING

Use established parishioner primary:

#7B1C2A

and existing semantic mobile tokens.

Do not invent new brand colors.

Use current TESTIMONIUM logo/assets only if existing suitable assets are available.

Do not generate placeholder logos.

---

# WELCOME

Provide:

Sign In
Create an Account

Google action:
only when Google feature/config gate is enabled.

Do not show a broken Google button.

Do not necessarily show "Coming Soon" when disabled.

---

# LOGIN

Email
Password
Show/Hide password

Accessible password toggle labels:

Show password
Hide password

No tooltip needed.

Do NOT add:

Keep me signed in

Native Firebase persistence owns session persistence.

---

# REGISTER

Structured names
Email
Password
Confirm Password
Terms checkbox/link
Privacy checkbox/link

No fake password-strength claims.

No fixed submission debounce.

---

# VERIFY EMAIL

Email destination
I've Verified My Email
Resend Verification Email
countdown
Sign Out / Use Different Account

Make state changes accessible.

Do not poll.

---

# LEGAL

Terms viewer
Privacy viewer
explicit acceptance controls
Accept & Continue

Must support both:

existing-profile legal acceptance
Google-JIT legal challenge

without UI duplication.

---

# PROFILE COMPLETION

Structured name fields as supported
Contact number
Address if supported

Use authoritative profile return.

No redirect loop.

---

# UI ACCESSIBILITY

All controls:

- practical 44x44 touch targets
- accessible labels
- readable at system font scaling
- no color-only meaning
- clear error association
- safe-area aware
- keyboard-friendly
- scrollable on small phones

Use the existing Screen abstraction where appropriate.

Do not introduce a second layout system.

---

# REDUCED MOTION

Do not use an invented:

accessibilityPreferences.isReduceMotionEnabled

API.

If animations are introduced:
use the actual React Native AccessibilityInfo API supported by the installed
version.

If no meaningful animation is needed:
keep auth screens simple and avoid unnecessary motion.

---

# KEYBOARD

Ensure:

- inputs remain reachable with keyboard open
- submit button does not become permanently hidden
- appropriate keyboard types
- email auto-capitalization off
- secureTextEntry for password
- Return/Next behavior sensible

Do not overfit a single hardcoded KeyboardAvoidingView behavior if the existing
Screen component already handles forms correctly.

---

# AUTH ERROR MAPPING

Expand AppError/Firebase mapping for Phase 1.

Cover:

invalid email
incorrect credential
email already in use
weak password/current password-policy error
too many attempts
network
timeout
backend unavailable
email not verified
legal acceptance required
account exists with password
account unavailable
session expired
Google cancelled
Google configuration error

Do not expose raw:

auth/...
Firebase stack
native SDK stack
Prisma
SQL
R2
backend internals

Do not leak account existence where current backend intentionally protects against
enumeration.

---

# DTO RULE

Do not replace current working auth types with guessed Prisma-shaped DTOs from the
plan.

Inspect the ACTUAL Phase 0:

src/types/auth.ts

and actual backend response.

Extend only fields needed by Phase 1.

Do not mirror complete User/Role Prisma models.

---

# API ENDPOINTS

Add only endpoints used in Phase 1:

POST /auth/login
GET /auth/profile
POST /auth/register
PUT /auth/profile
POST /auth/legal-acceptance
POST /auth/resend-verification

Preserve existing wrappers.

No mobile-only backend endpoints.

---

# AUTH PROVIDER RESPONSIBILITIES

AuthProvider may orchestrate:

signInWithEmail
signUpWithEmail
signInWithGoogle
refreshProfile
checkEmailVerification
acceptLegal
updateProfile
resendVerification
logout
retryBootstrap

But:

do NOT put:
- form state
- UI copy
- modal state unrelated to authentication
inside AuthProvider.

Pending JIT/legal bootstrap state is appropriate because it affects auth
orchestration.

---

# QUERY CACHE

Preserve private query identity isolation.

On every auth termination/account change:

- invalidate generation first
- stop protected commits
- cancel protected queries
- clear protected query cache
- clear app profile
- Firebase sign out
- Google local sign out where applicable

Ensure late responses cannot repopulate user data.

---

# SESSION ERROR RECOVERY

Transient backend problem:

Retry
Sign Out

Terminal account/role problem:

Sign Out / Use Different Account

No infinite retry button for non-parishioner roles.

---

# ===============================
# TESTS — REQUIRED
# ===============================

Expand tests substantially.

## Registration

Test:

1. Firebase create failure
2. Firebase success + backend success
3. Firebase success + backend deterministic failure
4. Firebase success + backend NETWORK failure
5. Firebase success + backend TIMEOUT
6. ambiguous backend outcome reconciliation via GET profile
7. Firebase identity is NOT deleted on ambiguous backend failure
8. initial verification email is attempted only after/reconciled backend setup
9. verification send failure does not delete valid registration
10. double register call blocked
11. observer suppressed during REGISTER
12. stale generation registration result discarded

---

# Verification tests

Test:

1. manual verification check
2. foreground check
3. manual + foreground concurrently share ONE verification operation
4. Firebase reload
5. force token refresh only after verified
6. profile refresh after verification
7. logout during verification discards late result
8. resend backend 200 then Firebase email send
9. resend backend 429 honors retryAfter
10. resend double tap blocked

---

# Legal tests

Test:

1. existing-profile legal acceptance uses /auth/legal-acceptance
2. Google JIT legal acceptance resumes /auth/login instead
3. legal double submit blocked
4. failed legal request does not optimistically alter profile
5. stale generation legal result ignored
6. Google JIT legal cancel logs out safely

---

# Profile tests

Test:

1. PUT returns completed profile → enter app
2. PUT returns needsProfileCompletion true → remain
3. no unnecessary GET after successful complete PUT
4. error preserves form
5. logout during PUT ignores late result
6. double save blocked

---

# Google tests

Static/mock tests even while runtime config is unavailable:

1. feature disabled → Google UI unavailable
2. Google cancel → no error alert
3. missing token → mapped safe error
4. Firebase Google credential success
5. backend existing Google user success
6. LEGAL_ACCEPTANCE_REQUIRED → pending GOOGLE_JIT_LOGIN
7. accepting JIT legal reissues POST /auth/login
8. ACCOUNT_EXISTS_WITH_PASSWORD signs out Firebase + Google state
9. role mismatch blocks app
10. backend network failure never exposes app tabs
11. stale Google result after logout is ignored
12. local Google signOut does NOT call revokeAccess

Do not write tests that assert account chooser behavior is guaranteed without
runtime evidence.

---

# ROUTING TESTS

Verify bootstrap gate:

NO_FIREBASE_USER
→ auth

EMAIL_VERIFICATION_REQUIRED
→ verify email

LEGAL_REQUIRED
→ legal

PROFILE_COMPLETION_REQUIRED
→ profile completion

AUTHENTICATED_READY
→ app

SESSION/ACCOUNT error
→ safe recovery UI

No protected-screen flash.

---

# ===================================
# GOOGLE PACKAGE CURRENTNESS CHECK
# ===================================

Before installing Google Sign-In:

inspect current package documentation/version compatibility with:

Expo SDK 57
React Native 0.86.2

Do not hardcode the plan's old:

^13.x

version.

Install current supported package.

If package/license/API differs from the plan:
adapt code to the actual installed package and report it.

Do not silently use a licensed private version.

---

# NATIVE BUILD CONFIG TEST

After adding native packages:

run:

npx expo-doctor

Run Expo config validation.

Run Android prebuild/config validation if environment permits.

If generated Android project is available and Android SDK works:

run actual Gradle debug compile.

Otherwise:

mark native compile NOT VERIFIED.

Also run:

npx expo export --platform android

but label this only as JS/Metro bundle verification.

---

# ===================================
# DOCUMENTATION
# ===================================

Update implementation-relevant docs:

07_MOBILE_AUTH_SESSION_SECURITY.md
12_MOBILE_ENV_BUILD_RELEASE.md
13_MOBILE_IMPLEMENTATION_ROADMAP.md
15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md

Also update:

MOBILE_PHASE1.md

ONLY if that file is intended as a living phase record.

If MOBILE_PHASE1.md is being kept as the original planning specification:
do not rewrite it; instead record final decisions in the decision/change-control
documentation.

Preserve history.

Document:

- native Firebase remains authoritative
- Phase 1 auth operation architecture
- partial-registration reconciliation
- no Firebase deletion after ambiguous register failure
- legal/JIT distinction
- Google package/API actually selected
- Google runtime external blocker
- account chooser runtime status
- development-build workflow
- legal-version compatibility watch item

---

# ===================================
# NO BACKEND CHANGES BY DEFAULT
# ===================================

Do NOT modify:

testimonium-backend
Prisma schema
database migrations
parishioner web
admin portal

unless execution discovers that current mobile Phase 1 correctness is impossible
without a backend change.

If such a blocker is discovered:

STOP that specific subfeature.

Report:

- exact missing contract
- affected endpoint/code
- smallest recommended backend change
- compatibility impact on web

Do not silently alter server behavior.

Continue other independent Phase 1 work when safe.

---

# ===================================
# VERIFICATION COMMANDS
# ===================================

At minimum run from testimonium-parishioner-app:

npm run typecheck
npm test -- --runInBand
npm run lint
npx expo-doctor
npx expo export --platform android
git diff --check

Also:

npm ls --depth=0

Review direct dependency inventory.

If package scripts differ, use actual equivalent commands and report them.

---

# NATIVE CONFIG

Where feasible:

npx expo prebuild --platform android --clean

or current safe equivalent.

Verify config plugins can generate Android native configuration.

Do not leave generated native folders tracked if CNG remains authoritative.

If Android toolchain exists:
compile debug Android native project.

If not:
state:

ANDROID NATIVE COMPILE NOT VERIFIED

Do not call Metro export a native compile.

---

# RUNTIME

Because runtime hardware may not be available:

DO NOT block implementation solely on:

- emulator
- physical phone
- real Firebase login
- real verification email
- Google chooser

But never call those VERIFIED.

Use:

PENDING RUNTIME VERIFICATION

where appropriate.

---

# DO NOT IMPLEMENT

Do not implement:

- document requests
- payments
- receipt upload
- scheduling
- parish directory data
- map
- native push
- RAG/chatbot
- staff/admin functions

Keep scope strictly Phase 1.

---

# COMPLETION REPORT

Return a detailed walkthrough grouped by:

## Phase 1A
- packages added
- dev-build setup
- Expo/CNG config
- native config verification level

## Phase 1B
- registration orchestration
- partial-success recovery
- verification flow
- resend behavior
- registration/verification tests

## Phase 1C
- canonical legal source
- normal legal acceptance
- Google JIT legal distinction
- profile completion
- gate behavior
- tests

## Phase 1D
- exact Google package/version/API selected
- public vs licensed implementation
- adapter architecture
- config plugin
- web client ID handling
- feature gating
- Google/Firebase credential flow
- JIT handling
- cross-provider conflict cleanup
- account selection behavior status
- remaining Firebase Console blockers
- iOS blockers
- tests

## Phase 1E
- screen UX
- accessibility
- keyboard/safe areas
- error mapping
- role safety

Then report:

1. Files created
2. Files modified
3. Files removed
4. Direct dependencies after implementation
5. Backend changes — expected NONE
6. Database changes — expected NONE
7. Phase 0 architecture preserved?
8. Auth-generation protection preserved?
9. Exactly-one 401 retry preserved?
10. Firebase user deletion after ambiguous register failure? MUST be NO
11. Registration reconciliation behavior
12. Verification single-flight behavior
13. Profile PUT direct-response behavior
14. Google pending-JIT legal behavior
15. Google account chooser runtime status
16. Non-parishioner behavior
17. Typecheck result
18. Test result and total tests
19. Lint result
20. expo-doctor result
21. Metro/Expo Android export result
22. Native config/prebuild result
23. Native Android compile result, if actually performed
24. Emulator status
25. Physical-device status
26. Real Firebase/backend status
27. Google runtime status
28. git diff --check
29. Documentation updated
30. Remaining blockers/risks for Phase 2

---

# FINAL SUCCESS CONDITIONS

Phase 1 is successful if:

- email login remains functional
- registration is implemented
- registration partial failures are recoverable without destructive Firebase deletion
- verification flow works architecturally
- resend uses backend rate-limit path
- legal acceptance is backend-authoritative
- first-time Google JIT legal is distinguished from normal legal acceptance
- profile completion uses backend-authoritative returned profile
- profile redirect loop cannot recur due redundant stale GET
- centralized auth gate controls navigation
- old-user async responses cannot update new-user state
- non-parishioners cannot access app tabs
- Google integration is compile/config ready behind a disabled-by-default external config gate
- Google account switching is not falsely claimed as verified
- Google cross-provider conflict cleans up temporary auth state
- no server secrets are introduced
- no staff functionality is exposed
- static/tests/build checks pass
- runtime tests not performed are explicitly marked pending

Do not expand scope beyond Phase 1.
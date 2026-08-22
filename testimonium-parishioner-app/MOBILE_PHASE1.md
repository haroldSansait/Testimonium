# TESTIMONIUM Parishioner Mobile
# PHASE 1 — Authentication & Onboarding
# COMPLETE IMPLEMENTATION PLAN ONLY

## MODE

READ-ONLY AUDIT / PLANNING ONLY.

DO NOT modify files.
DO NOT install packages.
DO NOT change Firebase Console configuration.
DO NOT generate native builds.
DO NOT implement screens.
DO NOT alter backend contracts.

Produce the complete implementation plan for Phase 1 of:

testimonium-parishioner-app

Work from the TESTIMONIUM repository ROOT.

The resulting plan will be independently reviewed before implementation.

---

# CURRENT AUTHORITATIVE MOBILE BASELINE

Phase 0 has already been implemented successfully.

DO NOT redesign or replace the Phase 0 architecture unless you find a concrete
correctness/security blocker.

Current mobile foundation:

- Expo SDK 57
- React 19.2.3
- React Native 0.86.2
- TypeScript
- Expo Router
- Expo Router protected routes
- five placeholder application tabs
- theme tokens derived from parishioner web primary crimson `#7B1C2A`
- native Firebase authentication
- platform-managed Firebase session persistence
- development build required for real Firebase authentication testing
- TanStack Query
- centralized API client
- normalized AppError architecture
- timeout vs cancellation distinction
- bearer token injection
- single-flight forced Firebase token refresh
- exactly one retry after HTTP 401
- passive `GET /auth/profile` bootstrap
- interactive `POST /auth/login` bootstrap
- auth-generation stale-response protection
- failed backend-bootstrap rollback/logout
- parishioner-only role gate
- protected cache clearing on logout

Validation from Phase 0:

- typecheck passed
- unit tests passed
- lint passed
- expo-doctor passed 21/21
- Android Metro bundle/export compiled
- git diff --check passed

NOT runtime verified:

- physical device
- emulator
- real Firebase email/password login
- backend authenticated login
- persisted native Firebase session
- iOS native build

Treat that distinction accurately.

---

# PHASE 1 STRUCTURE

Plan Phase 1 as five controlled subphases:

## Phase 1A
Native development build readiness + Firebase/backend smoke-test readiness

## Phase 1B
Email registration + email verification

## Phase 1C
Legal acceptance + profile completion

## Phase 1D
Google Sign-In + account selection + existing/new JIT users

## Phase 1E
Authentication/onboarding polish + regression hardening

Do NOT collapse everything into one uncontrolled implementation step.

The final implementation may still be performed from one execution prompt, but
the plan must preserve these internal boundaries and exit criteria.

---

# REQUIRED DOCUMENTATION

Read the mobile documentation in:

testimonium-parishioner-app/

especially:

00_MOBILE_DOCS_INDEX.md
01_MOBILE_PRODUCT_SCOPE.md
02_MOBILE_ARCHITECTURE.md
03_MOBILE_ENGINEERING_RULES.md
04_MOBILE_DESIGN_SYSTEM.md
05_MOBILE_NAVIGATION_AND_SCREEN_MAP.md
06_MOBILE_BACKEND_API_CONTRACT.md
07_MOBILE_AUTH_SESSION_SECURITY.md
08_MOBILE_STATE_DATA_OFFLINE.md
11_MOBILE_TESTING_QA.md
12_MOBILE_ENV_BUILD_RELEASE.md
13_MOBILE_IMPLEMENTATION_ROADMAP.md
15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md

Also inspect the ACTUAL implemented Phase 0 mobile code.

The implementation is authoritative over stale planning text.

If Phase 0 implementation differs from older docs:
report the difference and recommend documentation reconciliation.

---

# ALSO AUDIT

Relevant portions of:

testimonium-backend/
testimonium-parishioner-web/
testimonium-admin-portal/

Focus especially on:

- Firebase authentication
- email/password login
- registration
- email verification
- verification resend
- Google login
- Google account chooser behavior
- JIT user provisioning
- `/auth/login`
- `/auth/register`
- `/auth/profile`
- `/auth/legal-acceptance`
- `/auth/resend-verification`
- legal version handling
- Terms/Privacy UI
- profile completion
- AuthContext
- auth error mapper
- session handling
- ProtectedRoute behavior
- current User/profile DTO
- current backend auth validators
- AuthService
- role assignment
- Firebase Admin verification
- onboarding tests

Do not blindly port web code.

Use it to understand CURRENT implemented contracts and lessons.

---

# PRIMARY OBJECTIVE

Produce a precise implementation plan that allows a parishioner to go from:

NEW USER:

Launch
→ Register with email/password
→ backend registration
→ email verification
→ legal acceptance if required
→ profile completion if required
→ authenticated mobile app

EXISTING USER:

Launch
→ Login
→ backend login
→ correct onboarding gate if necessary
→ authenticated app

RESTORED USER:

Relaunch
→ native Firebase restores identity
→ GET /auth/profile
→ correct route

GOOGLE USER:

Choose Google account
→ native Google authentication
→ Firebase authentication
→ existing or new backend/JIT user resolution
→ legal/profile onboarding where required
→ app

while preserving Phase 0 race/security guarantees.

---

# =========================================
# PHASE 1A — NATIVE BUILD & SMOKE READINESS
# =========================================

Audit the current native Firebase setup.

Report the exact packages and configuration implemented during Phase 0.

Determine:

- native Firebase package names and versions
- config plugins
- Android Firebase integration
- `google-services.json`
- Android package name
- whether `expo-dev-client` exists
- whether `eas.json` exists
- whether development build scripts exist
- whether Android native folders are generated/committed
- current Expo prebuild strategy
- whether Continuous Native Generation is being used
- whether Expo Go is intentionally unsupported for auth
- current app scheme/deep-link configuration

Do not assume package names from the Phase 0 summary.

Inspect them.

---

# PHASE 1A GOAL

The implementation should make the app DEVELOPMENT-BUILD READY.

Because the product owner may not currently be able to run a physical device or
emulator test:

DO NOT make physical runtime verification a blocker for implementing Phase 1.

Instead define verification levels:

STATIC VERIFIED
NATIVE CONFIG VERIFIED
ANDROID BUILD/COMPILE VERIFIED
EMULATOR VERIFIED
PHYSICAL DEVICE VERIFIED
REAL FIREBASE/BACKEND VERIFIED

Never claim a higher level than actually performed.

---

# DEVELOPMENT BUILD

Determine the smallest correct setup for the current Expo SDK/native Firebase stack.

Evaluate:

- expo-dev-client
- EAS development build
- local `expo run:android`
- prebuild requirements

Recommend the approach compatible with the existing Phase 0 architecture.

Do NOT create both EAS and local-native workflows unless both are genuinely useful.

Do not commit generated native folders if the project is intentionally using
Continuous Native Generation.

Explicitly state the intended native workflow.

---

# ANDROID FIREBASE

Audit:

google-services.json

Current known issue from Phase 0:

Android Firebase OAuth clients are absent.

Determine whether:

- email/password native Firebase auth works without those OAuth clients
- Google Sign-In specifically requires them
- SHA-1 and/or SHA-256 fingerprints are needed
- development-build signing fingerprint differs from production
- Firebase Console configuration is required before Phase 1D

Classify each issue as:

BLOCKS 1A
BLOCKS 1B
BLOCKS 1D ONLY
DOES NOT BLOCK

---

# iOS

Current known state:

GoogleService-Info.plist is not configured.

Do not block Android-first development because of this unless current project scope
requires iOS immediately.

Define exact iOS prerequisites for later testing:

- Firebase iOS app
- bundle identifier
- GoogleService-Info.plist
- URL schemes
- Google OAuth configuration
- development build

Do not claim iOS support was tested.

---

# ====================================
# PHASE 1B — EMAIL REGISTRATION
# ====================================

Trace the ACTUAL current backend and web registration flow.

Determine exact sequencing.

Do NOT assume this sequence without verifying it:

createUserWithEmailAndPassword
→ POST /auth/register
→ send verification
→ verification screen

Inspect:

- backend validator
- controller/service
- parishioner web signup
- current legal payload behavior
- current structured name fields
- current profile requirements

Report the actual contract.

---

# REGISTRATION OWNERSHIP RACE

Registration is an interactive auth operation just like login.

Explicitly analyze:

createUserWithEmailAndPassword
→ Firebase onAuthStateChanged fires
→ mobile observer might start GET /auth/profile
→ POST /auth/register has not completed

The existing Phase 0 interactive ownership mechanism MUST be generalized/reused.

Do NOT create a second unrelated mutex.

The plan should define one concept such as:

interactiveAuthOperation

covering:

LOGIN
REGISTER
GOOGLE_LOGIN

Observer must not compete with backend bootstrap/provisioning.

---

# REGISTRATION FAILURE MODES

Plan deterministic handling for:

Firebase account created
BUT
backend `/auth/register` fails.

This is a critical partial-success condition.

Determine current backend idempotency/retry behavior.

Possible recovery must be based on actual backend semantics.

Do not simply sign out and forget that a Firebase account may now exist.

Analyze scenarios:

1. Firebase registration fails
2. Firebase succeeds, backend succeeds
3. Firebase succeeds, network fails before backend response
4. Firebase succeeds, backend validation rejects
5. Firebase succeeds, backend server error
6. user closes app mid-registration
7. app relaunchs with Firebase identity but backend user is incomplete/missing

Recommend the safest recoverable behavior.

Do not create duplicate PostgreSQL users.

---

# EMAIL VERIFICATION

Audit actual current policy.

Determine:

- whether backend requires verified Firebase email before app access
- when verification email is initially sent
- whether Firebase SDK sends initial email
- what `/auth/resend-verification` does
- resend rate limits/cooldowns
- current web copy/behavior
- whether backend stores resend metadata

Do not create a client-only resend bypass.

---

# VERIFICATION SCREEN

Plan:

- display destination email safely
- resend action
- cooldown/rate-limit feedback
- "I've verified my email" / refresh action
- app foreground re-check
- logout/change-account action

Do NOT poll Firebase continuously.

Recommended behavior should evaluate:

user opens email externally
→ verifies
→ returns to app
→ AppState becomes active
→ controlled Firebase user reload/token refresh
→ emailVerified becomes current
→ backend/profile bootstrap continues

Also retain explicit manual refresh.

---

# VERIFICATION RACES

Analyze:

- resend double tap
- app foreground + manual refresh simultaneously
- stale Firebase user.emailVerified
- Firebase reload while logout happens
- verification succeeds while registration backend state is incomplete

Use Phase 0 auth generation protection.

---

# PASSWORD REQUIREMENTS

Inspect actual Firebase/backend/web policy.

Do not invent stricter password rules merely for a strength meter.

If a password-strength indicator is proposed:
only use it if it adds real UX value and does not claim policy enforcement that the
backend/Firebase does not enforce.

Do not add fake security theater.

---

# ====================================
# PHASE 1C — LEGAL + PROFILE
# ====================================

Trace actual current legal system.

Inspect:

- current Terms page/content
- current Privacy page/content
- current legal version constants/configuration
- backend legal acceptance schema
- User legal metadata
- login/register legal payload behavior

Determine whether legal acceptance is:

- part of registration
- separate POST `/auth/legal-acceptance`
- supported by both
- required again when versions change

Do not assume.

---

# LEGAL CONTENT

Critical:

The mobile app must not create its own divergent Terms/Privacy text.

Determine where canonical legal content currently lives.

Recommend whether mobile should:

- render shared/reused text copied from current canonical docs
- open canonical web legal pages
- use a backend-provided version/source

based on actual repository architecture.

Do not invent legal clauses.

---

# LEGAL ACCEPTANCE UX

Plan accessible mobile UI for:

- Terms
- Privacy
- version disclosure if useful
- acceptance checkbox/button
- links/opening documents
- loading/error states

Legal acceptance must not be optimistically marked complete.

Backend response/profile refresh remains authoritative.

Prevent double submit.

---

# LEGAL VERSION RACE

Analyze:

user opens legal screen for version X
→ backend/current version changes to Y
→ user submits X

If backend currently handles version validation:
rely on it.

If not:
report the limitation rather than inventing client authority.

---

# PROFILE COMPLETION

Audit current profile fields and backend completion logic.

Determine exact fields currently required.

Do NOT duplicate completion rules in mobile.

The backend's:

needsProfileCompletion

or equivalent current field remains authoritative.

Mobile may perform field validation for UX but must not decide completion itself.

---

# PROFILE SAVE FLOW

Required conceptual behavior:

capture whether onboarding completion is active
→ PUT /auth/profile
→ use authoritative returned profile if response provides it
OR GET /auth/profile
→ receive exact fresh profile
→ if needsProfileCompletion == false:
      enter app
→ otherwise:
      stay on profile completion with clear remaining requirements

Do not navigate based on stale context state.

This must preserve the web profile-loop fix already learned.

---

# PROFILE UPDATE RACES

Analyze:

- double submit
- PUT succeeds but GET refresh fails
- stale GET resolves after PUT
- logout during profile save
- app background during save
- profile response belongs to old auth generation

Use auth generation protection.

---

# ONBOARDING ROUTE ORDER

Determine authoritative gate order based on backend/web policy.

For example:

Firebase user exists
→ registration/backend user resolved
→ email verification
→ legal
→ profile completion
→ app

BUT verify exact current policy.

Do not create conflicting redirect effects on each screen.

One centralized bootstrap/gate function should decide destination.

Screens should submit state changes then ask central auth state to reevaluate.

---

# ====================================
# PHASE 1D — GOOGLE SIGN-IN
# ====================================

This section requires especially careful audit.

Current known blocker:

google-services.json currently has no Android OAuth client entries.

Do NOT pretend Google login can work until configuration supports it.

---

# GOOGLE PACKAGE DECISION

Inspect Phase 0 native Firebase package architecture.

Evaluate current compatible approaches for Expo SDK 57:

- @react-native-google-signin/google-signin
- any officially supported native Google auth path compatible with current Firebase
- other current approach only if materially better

Do NOT use web-only:

signInWithPopup

Do NOT assume:

provider.setCustomParameters({ prompt: 'select_account' })

applies to native.

Recommend exactly ONE Google authentication approach.

Explain:

- package
- why
- native configuration
- Expo config plugin
- dev-build requirement
- Android requirements
- iOS requirements
- credential handoff to Firebase
- cancellation behavior
- account switching behavior

---

# ACCOUNT CHOOSER REQUIREMENT

Product requirement:

The user must be able to intentionally sign in with a different Google account.

Audit the chosen native Google SDK's actual supported behavior.

Determine how to reliably expose account selection.

Do not use hacks that:

- revoke Google authorization unnecessarily
- delete application access
- clear global Google account data
- create confusing silent sign-in behavior

Distinguish:

sign out of TESTIMONIUM
vs
disconnect/revoke Google access
vs
choose another Google account

The implementation plan must define these separately.

---

# GOOGLE CONFIGURATION BLOCKER POLICY

If Firebase Console OAuth configuration is still missing during execution:

DO NOT render a functional-looking Google button that always fails.

Choose one:

A. omit Google button until configuration is complete
B. clearly gate it behind a development feature flag
C. implement code but keep UI unavailable until config is verified

Recommend the safest option.

Do not show "Coming soon" unless product owner explicitly wants that UI.

---

# GOOGLE FIREBASE FLOW

Plan exact sequence.

Conceptually:

native Google Sign-In
→ receive Google credential/token
→ Firebase native signInWithCredential
→ interactive auth ownership suppresses observer GET
→ POST /auth/login
→ existing user OR backend JIT user
→ authoritative backend profile
→ legal/profile onboarding if required

Verify against actual backend implementation.

---

# EXISTING VS NEW GOOGLE USERS

Trace current web/backend JIT logic.

Determine what happens for:

1. existing Firebase Google identity + existing PostgreSQL user
2. existing email/password PostgreSQL user using Google with same email
3. first-time Google Firebase identity
4. Firebase user exists but PostgreSQL user does not
5. inactive/disabled user
6. wrong/non-parishioner role
7. backend provisioning failure after Google succeeds

Do not guess account-linking behavior.

Report exactly what current backend supports.

If same-email provider linking is not safely supported:
state it.

---

# GOOGLE LEGAL ACCEPTANCE

Current parishioner web previously passes legal information through Google signup/login
flows.

Audit the CURRENT implementation.

Determine whether a brand-new Google user must accept legal terms:

before launching Google provider
or
after Firebase login but before backend JIT provisioning
or
during a backend legal payload
or
after JIT through `/auth/legal-acceptance`.

Recommend flow based on current backend contract.

Do not fabricate.

---

# GOOGLE FAILURE/CANCELLATION

Handle distinctly:

- user cancels account chooser
- no credential returned
- native Google SDK error
- Firebase credential rejection
- Firebase succeeds / backend fails
- non-parishioner backend role
- network loss
- configuration error

Cancellation should not be shown as a scary application error.

Backend-bootstrap partial success must recover deterministically.

---

# ====================================
# PHASE 1E — UX & REGRESSION
# ====================================

Audit existing parishioner web authentication design for useful brand language.

Mobile must remain:

- parishioner-first
- warm/light
- crimson `#7B1C2A` based
- native-mobile
- distinct from admin portal

Do NOT port desktop layouts.

---

# AUTH SCREEN DESIGN

Plan polished screens for:

Welcome
Login
Register
Verify Email
Legal
Profile Completion

Potential Google button only when configuration allows it.

Requirements:

- SafeArea
- keyboard avoiding
- scrolling on small screens
- text scaling
- accessible labels
- 44x44 practical touch targets
- password visibility
- loading state
- disabled duplicate submit
- inline validation
- clear recovery
- reduced motion
- no repeated branding clutter

---

# LOGIN MOBILE SESSION UX

DO NOT add:

"Keep me signed in"

Platform-managed Firebase persistence remains the mobile behavior.

Explicit Logout remains the user control.

---

# PASSWORD VISIBILITY

Use icon-only accessible toggle:

Show password
Hide password

Accessible label must update with state.

No tooltip dependency is needed on native mobile.

---

# AUTH ERROR COPY

Map Firebase/backend errors to safe actionable messages.

Examples of categories:

- incorrect email/password
- email already in use
- invalid email
- weak password
- rate limit
- offline
- timeout
- server unavailable
- account inactive
- session expired

Do not expose raw Firebase codes/messages.

Do not tell users whether an arbitrary account exists if current security policy
intentionally avoids enumeration.

Inspect existing backend/web behavior before deciding wording.

---

# ROLE SAFETY

The mobile app is PARISHIONER ONLY.

After backend bootstrap:

if backend role != PARISHIONER:

DO NOT enter the app tabs.

Use a clear safe message such as:

"This account is not available in the parishioner mobile app."

Allow Logout / switch account.

Do not expose staff role names/actions unnecessarily unless current product UX
already does.

Backend authorization remains authoritative.

---

# SESSION / CACHE SECURITY

Preserve Phase 0:

- auth generation
- user-specific private query keys
- cancel protected queries before logout
- cache clearing
- no old-user state after account switch
- exactly one 401 refresh retry

Phase 1 must not weaken any of these.

---

# TESTING PLAN

Create a complete test matrix by subphase.

## 1A
- native configuration
- Android compile/development build readiness
- Firebase module startup
- no runtime claim without device/emulator

## 1B
- registration Firebase failure
- backend register failure
- partial Firebase-only account recovery
- observer suppression
- email verification refresh
- resend cooldown/rate limit
- logout from verification
- relaunch while unverified

## 1C
- legal success/failure
- stale legal version if applicable
- profile update
- profile completion remains true
- completion becomes false
- refresh failure
- logout during save
- stale generation

## 1D
- Google cancel
- existing user
- new/JIT user
- different account selection
- backend failure
- same-email/provider edge case
- role mismatch
- logout then different Google account

## 1E
- font scaling
- keyboard
- small Android screen
- accessibility labels
- loading/error states
- no protected-screen flash
- Back button
- process death/relaunch where feasible

---

# NO PHYSICAL DEVICE AVAILABLE

The product owner may not personally perform device testing now.

Therefore the implementation plan must distinguish:

MUST PASS AUTOMATICALLY
- TypeScript
- lint
- unit/integration tests
- expo-doctor
- Android compile/export/build where environment permits
- git diff --check

DESIRABLE RUNTIME
- emulator
- development build
- real Firebase
- real backend

If runtime is unavailable:

mark it PENDING.

Do NOT block all Phase 1 implementation solely because runtime hardware isn't
available.

BUT:

Google Sign-In must not be called VERIFIED until actual native runtime testing has
occurred.

---

# DEPENDENCY REVIEW

Determine packages Phase 1 genuinely needs.

Possible categories:

- form management
- schema validation
- native Google Sign-In
- expo-dev-client
- Firebase/native packages already present

Do not add speculative Phase 2+ packages.

For every proposed package provide:

- exact purpose
- whether required now
- Expo SDK 57 compatibility
- native rebuild requirement
- current maintenance status if knowable from installed/current docs

Prefer `npx expo install` for Expo-managed packages.

Do not pin stale versions copied from older planning files.

---

# FORM LIBRARY DECISION

Phase 1 now has enough non-trivial forms that a shared form architecture may be
appropriate.

Evaluate:

React Hook Form

and optionally:

Zod

against existing current mobile dependencies.

If recommending Zod:

- client validation is UX only
- backend remains authoritative
- do not manually duplicate every backend refinement
- avoid version-dependent Zod APIs copied blindly from backend

Resolve whether Phase 1 should introduce these now.

---

# LEGAL/PROFILE TYPES

Do not copy entire Prisma models into mobile.

Define DTOs only for fields returned/accepted by actual auth/profile endpoints.

Avoid creating permanent duplicate database types.

---

# AUTH PROVIDER RESPONSIBILITY

Keep AuthProvider focused on:

- Firebase identity
- backend profile
- bootstrap state
- interactive auth ownership
- refreshProfile
- logout
- login/register/Google orchestration where appropriate

Do not make AuthProvider own all form field state or UI copy.

---

# API ENDPOINT LAYER

Phase 1 may add only required wrappers such as:

auth.login
auth.profile
auth.register
auth.updateProfile
auth.acceptLegal
auth.resendVerification

based on actual backend routes.

Do not create fake mobile-only endpoints.

---

# RATE LIMITING

Audit current backend rate limiting for:

- login if relevant
- resend verification
- registration if relevant
- auth/profile

Mobile must:

- not spam retries
- display safe cooldown information where available
- honor Retry-After if returned

Do not create local cooldown as a substitute for backend enforcement.

Local countdown may supplement backend UX only.

---

# APPSTATE

Use the existing minimal Phase 0 AppState integration where appropriate.

Verification recheck on foreground should:

- be debounced/single-flight
- respect auth generation
- not cause profile/bootstrap refetch storms

Do not create global polling.

---

# DEEP LINKS

Do not overbuild email verification deep linking unless current Firebase email
action configuration already supports it.

A valid Phase 1 flow may use:

verification email opens browser
→ user returns to app
→ app foreground/manual refresh verifies state

If deep links are already configured and safe:
plan them.

Do not expand scope solely to make verification links open the app.

---

# BACKEND CHANGES

Default expectation:

NO backend changes.

However, if audit proves mobile cannot implement a correct auth/onboarding flow
because a backend contract is missing:

report the smallest required backend change.

Do NOT implement it in this planning task.

Classify it:

REQUIRED BLOCKER
RECOMMENDED
OPTIONAL

Explain effects on existing web clients.

---

# DATABASE CHANGES

Default:

NO Prisma schema changes.

If the plan proposes one:
justify why current models cannot support the flow.

Do not use a schema change merely for mobile convenience.

---

# ROOT WORKSPACE

Determine whether Phase 1 needs any root script changes.

Do not alter web/admin tooling unnecessarily.

---

# DOCUMENTATION

Plan updates to:

07_MOBILE_AUTH_SESSION_SECURITY.md
12_MOBILE_ENV_BUILD_RELEASE.md
13_MOBILE_IMPLEMENTATION_ROADMAP.md
15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md

and other mobile docs only where implementation materially changes them.

If native Firebase architecture from Phase 0 made older JS-SDK references stale,
explicitly include reconciliation.

---

# REQUIRED OUTPUT

Return:

## 1. Executive Verdict

- Is Phase 1 implementable on current foundation?
- Any hard blockers?
- Overall risk: Low / Medium / High
- Which subphase is highest risk?

---

## 2. Current Phase 0 Auth Architecture

Describe actual implemented mobile auth foundation with exact files/packages.

---

## 3. Backend/Web Auth Contract Audit

Table:

| Concern | Backend Behavior | Web Behavior | Mobile Recommendation |

Include:

login
register
verification
legal
profile completion
Google/JIT
logout
role handling

---

## 4. Phase 1A Plan

Native build/dev-client readiness.

Include exact files/packages/config changes.

---

## 5. Phase 1B Plan

Email registration + verification.

Include exact sequencing and recovery.

---

## 6. Phase 1C Plan

Legal + profile completion.

Include gate order.

---

## 7. Phase 1D Plan

Google Sign-In.

Include:

- package decision
- config blockers
- Firebase Console tasks
- Android requirements
- iOS requirements
- account chooser behavior
- existing/new/JIT behavior
- failure/cancellation behavior

---

## 8. Phase 1E Plan

UI/accessibility/polish/regression.

---

## 9. Auth State Machine

Provide the complete proposed state-transition model.

Include:

restored session
email login
registration
verification
legal
profile
Google
logout
session error

---

## 10. Race-Condition Matrix

Table:

| Race | Sequence | Severity | Mitigation |

Include all races identified above.

---

## 11. Partial-Success Recovery Matrix

Especially:

Firebase succeeded / backend failed.

Table:

| Operation | Partial State | Risk | Recovery |

---

## 12. Security Review

Table:

| Severity | Finding | Evidence | Required Action |

Do not misclassify Firebase client config as a secret.

---

## 13. Dependency Plan

ADD
KEEP
REMOVE
DEFER

Explain every addition.

---

## 14. API/DTO Plan

Exact endpoints/types required.

---

## 15. Screen/UX Plan

For every auth/onboarding screen:

- purpose
- fields
- states
- actions
- validation
- accessibility
- navigation behavior

---

## 16. File-by-File Implementation Plan

For every:

NEW
MODIFY
REMOVE

file.

Do not implement.

---

## 17. Test Plan

Unit
integration
native compile
runtime

Clearly mark what can be automated.

---

## 18. Phase-by-Phase Exit Criteria

1A
1B
1C
1D
1E

---

## 19. Backend/Console Blockers

Separate:

CODE BLOCKER
FIREBASE CONSOLE BLOCKER
iOS BLOCKER
RUNTIME-ONLY VERIFICATION

---

## 20. Documentation Updates

Exact files/sections.

---

## 21. Questions for Product Owner

Ask only questions repository inspection cannot answer.

Do not ask things that have an obvious engineering answer.

---

## 22. Recommended Execution Strategy

Should Phase 1 be:

- one implementation pass with internal checkpoints
or
- separate implementations for 1A–1E?

Recommend based on actual risk.

---

## 23. Final Readiness

Return one:

READY FOR PHASE 1 IMPLEMENTATION
READY WITH EXTERNAL BLOCKERS
NOT READY

Explain exactly why.

---

# NON-NEGOTIABLE RULES

- Planning only.
- Do not modify files.
- Preserve Phase 0 architecture.
- Native Firebase is the current chosen auth architecture.
- Do not revert to Firebase JS SDK without a demonstrated blocker.
- Do not add Keep Me Signed In.
- Do not duplicate backend profile-completion rules.
- Do not let auth observer race interactive auth.
- Do not let old-user async responses update new-user state.
- Do not expose staff app functionality.
- Do not invent legal text.
- Do not pretend Google works without OAuth configuration.
- Do not claim runtime testing not performed.
- Do not implement RAG.
- Do not implement push notifications.
- Do not implement document/payment/scheduling features.
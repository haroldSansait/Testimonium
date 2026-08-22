# TESTIMONIUM Parishioner Mobile — Phase 2 Planning Prompt

## Purpose

Produce a **planning-only implementation plan** for **Phase 2 — Mobile Shell, Home & Parish Directory** of the TESTIMONIUM parishioner mobile app.

Do **not** implement code in this task.
Do **not** modify files.
Do **not** run EAS builds, Expo prebuild, Gradle, Android Studio, or native build commands.

The output must be a concrete, repo-grounded implementation plan that I can review before giving a separate execution prompt.

## Repository

Repository root:

```text
C:\Users\me\Documents\testimonium
```

Mobile app:

```text
C:\Users\me\Documents\testimonium\testimonium-parishioner-app
```

Relevant apps/services:

```text
testimonium-backend
testimonium-admin-portal
testimonium-parishioner-web
testimonium-parishioner-app
```

The mobile app is **parishioner-facing only**. Staff roles and staff mutation workflows remain in the admin portal.

# 1. Read These Documents First

Before proposing the plan, inspect the actual current repository and read the current versions of:

```text
00_MOBILE_DOCS_INDEX.md
01_MOBILE_PRODUCT_SCOPE.md
02_MOBILE_ARCHITECTURE.md
03_MOBILE_ENGINEERING_RULES.md
04_MOBILE_DESIGN_SYSTEM.md
05_MOBILE_NAVIGATION_AND_SCREEN_MAP.md
06_MOBILE_BACKEND_API_CONTRACT.md
07_MOBILE_AUTH_SESSION_SECURITY.md
08_MOBILE_STATE_DATA_OFFLINE.md
10_MOBILE_NOTIFICATIONS_DEEPLINKING.md
11_MOBILE_TESTING_QA.md
12_MOBILE_ENV_BUILD_RELEASE.md
13_MOBILE_IMPLEMENTATION_ROADMAP.md
15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md
```

Also inspect the backend implementation, API documentation, Prisma schema, existing parishioner web implementation, and current mobile source wherever relevant.

Treat actual current source and confirmed backend behavior as authoritative when they supersede older documentation. Do not silently preserve obsolete assumptions.

# 2. Current Verified State

Phase 0 and Phase 1 are implemented.

Current mobile stack includes:

```text
Expo SDK 57
React Native 0.86.x
React 19.2.x
TypeScript
Expo Router
TanStack Query
Native Firebase Auth
@react-native-google-signin/google-signin
expo-dev-client
React Hook Form
Zod
EAS Cloud Android builds
```

The app already has:

- centralized bearer-token API client;
- timeout/cancellation;
- normalized errors;
- one forced token refresh + one 401 retry;
- auth-generation stale-operation protection;
- private query/cache clearing on logout;
- parishioner-only role enforcement;
- protected routing;
- email/password login;
- registration;
- email verification;
- legal acceptance;
- profile completion;
- Google Sign-In;
- Google JIT legal acceptance;
- password-account collision cleanup;
- session restore;
- logout.

Physical Android runtime verification has succeeded for:

```text
Email/password login       PASS
Google Sign-In             PASS
Google logout              PASS
Email/password logout      PASS
Backend auth bootstrap     PASS
Profile commit             PASS
AUTHENTICATED_READY route  PASS
```

For an existing complete account, login correctly routes directly to Home.

The authenticated UI is intentionally rough/incomplete because it was deferred to Phase 2.

# 3. Current Development Workflow

Physical Android development is centralized behind:

```powershell
cd C:\Users\me\Documents\testimonium
npm run dev:mobile
```

That launcher:

1. checks/reuses or starts the TESTIMONIUM backend;
2. verifies `GET /api/v1/health`;
3. starts a temporary Cloudflare Quick Tunnel;
4. verifies public backend health;
5. updates only `EXPO_PUBLIC_API_BASE_URL` in mobile `.env`;
6. preserves Google Sign-In environment values;
7. starts Metro with `--dev-client --tunnel`;
8. cleans up launcher-owned processes.

Do not redesign this workflow during Phase 2 unless a real defect is proven.

Normal Phase 2 JS/TS/UI/API work should use the already-installed dev client and Fast Refresh. Do not plan a new EAS build unless a genuinely necessary native dependency/config change is introduced.

# 4. Canonical Phase 2 Scope

The roadmap defines:

## Phase 2 — Mobile Shell, Home & Parish Directory

### Scope

- bottom tabs;
- Home;
- parish directory;
- parish detail;
- events preview;
- notifications badge shell.

### Optional

- mobile-native map **only after the list view is stable**.

### Exit criteria

- parishioner can browse parishes/events;
- no admin controls are exposed;
- shell/accessibility is stable.

This scope is binding unless the repo audit reveals a justified constraint.

Do **not** start Phase 3+ implementation.

# 5. Explicitly Out of Scope

Do not plan full implementation of:

- document request lifecycle — Phase 3;
- payment/receipt — Phase 4;
- scheduling workflow — Phase 5;
- full notifications feature — Phase 6;
- native push notifications;
- full profile/settings feature set — Phase 7;
- RAG/chatbot;
- iOS;
- production/staging deployment;
- store publication;
- admin/staff functionality.

Requests, Schedule, and Profile may remain top-level tabs because the navigation architecture reserves them, but Phase 2 must not silently implement later-phase business workflows.

If placeholder/tab-shell behavior is needed, design it intentionally and explain how it avoids misleading or dead-end UX.

# 6. Required Top-Level Navigation

Existing mobile navigation proposes five tabs:

```text
Home
Requests
Schedule
Parishes
Profile
```

Notifications should be reachable from a top-bar bell/action rather than consuming a permanent tab.

Events may appear:

- on Home;
- inside parish discovery/detail;
- through an event detail route if supported by the actual app/API.

Audit the current Expo Router structure before finalizing routes.

Do not replace or weaken Phase 0/1 protected routing.

# 7. Auth and Route Safety — Preserve

Preserve the working gate model:

```text
No Firebase user
→ auth routes

Firebase/backend bootstrap unresolved
→ do not flash protected shell

Verification required
→ verification

Legal acceptance required
→ legal

Profile incomplete
→ profile completion

PARISHIONER + ACTIVE + complete
→ authenticated app shell
```

Do not add screen-local auth redirects that race with centralized auth state.

A previous `GO_BACK` race was fixed. Do not reintroduce unconditional `router.back()` behavior.

Plan deterministic navigation/back behavior for:

- tab roots;
- parish detail;
- event detail if included;
- notification shell;
- missing/deep-linked resources.

# 8. Parishioner Product Boundary

Important domain rule:

**Parishioners are NOT tied to a home parish.**

Do not introduce:

- `homeParishId`;
- preferred-parish assumptions;
- automatic tenant scoping by parish;
- “your parish” wording unless a real preference feature exists.

Parishioners browse across permitted parishes.

Never expose staff/admin actions such as:

- parish mutation;
- map editing;
- event creation/editing;
- mass-template mutation;
- staff availability mutation;
- priest assignment;
- coordinator controls.

# 9. Phase 2 Backend/API Surface

Audit actual current routes/controllers/validators/DTOs before proposing models.

Expected parishioner-safe baseline:

```http
GET /api/v1/parishes
GET /api/v1/parishes/:id
GET /api/v1/parish-events/all
```

Current docs describe:

```text
GET /parishes
→ active/visible parish directory

GET /parishes/:id
→ parish details

GET /parish-events/all
→ sanitized active/month-filtered discovery feed
```

Do not invent response fields.

Inspect actual backend DTOs and/or parishioner web consumers for:

- parish name;
- type/category;
- address/location;
- contact information;
- office schedule;
- coordinates/map metadata;
- images/logo/cover fields;
- active/visible flags;
- event fields;
- mass/public-event fields;
- dates/times;
- venue/location;
- parish references.

If a field is absent, the plan must not design UI that depends on it without identifying a backend gap.

Do not modify backend contracts in this planning task.

# 10. Home Screen Planning

The design docs recommend a Home hierarchy broadly like:

1. concise greeting;
2. actionable status / next appointment where appropriate;
3. quick actions;
4. recent requests;
5. upcoming events;
6. notifications/reminders.

However, Phase 2 does **not** include full Requests or Scheduling.

Reconcile this deliberately.

Do not prematurely build Phase 3/5 business logic just to fill Home.

Plan a useful Phase 2 Home using in-scope data.

Likely safe candidates:

- greeting from existing profile;
- parish discovery entry;
- upcoming public events preview;
- clear quick-entry cards;
- notification bell/badge shell;
- intentional loading/empty/error states.

If request/schedule summaries are proposed, prove they are already safe read-only endpoints and do not materially expand Phase 2.

# 11. Parish Directory Planning

The parish directory must be fully usable as a **list first**.

Plan:

- data fetching;
- query key;
- caching/freshness;
- pull-to-refresh;
- search/filter only if supported/useful;
- list/card information hierarchy;
- navigation to detail;
- skeletons;
- meaningful empty state;
- retryable error state;
- accessibility;
- large-font behavior.

Do not display internal IDs.

Do not expose admin editing.

If parish type/category exists, inspect actual values and plan user-facing labels instead of raw enums.

# 12. Parish Detail Planning

Plan the parish detail based only on actual DTO fields.

Potential information to evaluate after source audit:

- parish name/type;
- address;
- contact details;
- office hours;
- description;
- location/map preview;
- public events/masses;
- safe call/message/map actions if actual data supports them.

Do not fabricate schedules, hours, contacts, or event data.

If URLs/phone numbers exist, plan safe native linking.

Location permission must not be required for ordinary browsing.

# 13. Events Preview Planning

Use the existing discovery endpoint where appropriate:

```http
GET /api/v1/parish-events/all
```

Audit real filters and response shape.

Plan:

- Home upcoming-events preview;
- optional parish-filtered events on parish detail;
- user-friendly date/time formatting;
- timezone handling;
- loading/empty/error states;
- event navigation if safe detail behavior exists.

Do not expose draft/private/staff-only events.

Do not implement the full Phase 6 calendar.

# 14. Notifications Badge Shell

Phase 2 includes a **notifications badge shell**, not the full Phase 6 notifications feature.

Inspect:

```http
GET /api/v1/notifications
```

Determine the smallest useful implementation.

Evaluate:

- bell only with future route;
- bell + unread count if current API exposes a cheap/reliable count;
- lightweight notification destination shell without full read/unread functionality.

Do not add aggressive polling.
Do not add native push.
Do not pretend unread state exists if it is not in the API.

Clearly separate Phase 2 shell work from Phase 6.

# 15. State Management

TanStack Query is the established server-state solution.

Preserve:

```text
Server state → TanStack Query
Auth bootstrap → AuthProvider
Local UI state → useState/useReducer
```

Relevant conceptual query keys:

```text
['parishes', filters]
['parish', parishId]
['events', ...]
['notifications', firebaseUid, ...]
```

Inspect existing query-key helpers before creating conventions.

Phase 2 recommendations to evaluate:

- parish directory: longer freshness + pull-to-refresh;
- events: moderate freshness;
- notification badge: short freshness only if implemented, no polling abuse.

Do not add Redux, Zustand, Jotai, or another server-state library.

# 16. Design Direction

Phase 2 is the first phase where the authenticated UI becomes visually meaningful.

The current UI works but is intentionally rough.

Include a deliberate **mobile shell and reusable UI foundation refinement** without turning Phase 2 into an uncontrolled redesign.

Direction:

**Parishioner-first, welcoming, ecclesiastical, modern, distinct from admin.**

Use:

- warm/light surfaces;
- TESTIMONIUM crimson/maroon;
- soft cards/separators;
- generous spacing;
- clean mobile typography;
- restrained branding moments;
- parish/event imagery only where real assets/data exist.

Avoid:

- dark admin-style navigation;
- desktop tables;
- sidebars;
- dense layouts;
- heavy shadows everywhere;
- repeated TESTIMONIUM branding;
- fake placeholder logos;
- unsupported trust/security claims.

Canonical current primary:

```text
#7B1C2A
```

Inspect actual theme tokens before proposing changes. Do not resurrect stale token values from older docs if source is already reconciled.

# 17. Accessibility & Mobile UX

Plan for:

- practical 44×44 touch targets;
- safe areas;
- system font scaling;
- no clipping fixed-height text containers;
- readable line height;
- TalkBack labels for icon-only actions;
- accessible selected-tab state;
- status meaning not conveyed by color alone;
- keyboard-safe search if used;
- accessible pull-to-refresh;
- meaningful loading/empty/error states;
- reduced-motion awareness if animation is proposed.

# 18. Bottom-Tab Shell Requirements

Audit current placeholder tabs and Expo Router layouts.

Specify:

- exact route/file structure;
- which existing files are kept/renamed/replaced;
- tab icon strategy using existing dependencies if possible;
- selected/unselected states;
- labels;
- safe-area behavior;
- badge support;
- header behavior;
- active-tab reset/pop-to-root behavior;
- Android back behavior;
- how parish/event detail sits above tab roots.

Do not add a new native navigation dependency if Expo Router/current deps already solve it.

# 19. Optional Map

Roadmap rule:

**mobile-native map only after list view is stable.**

Do not automatically include map in main Phase 2 execution.

Audit:

- coordinate coverage;
- existing web map;
- dependency implications;
- whether a native module/EAS rebuild is required;
- privacy/location permission implications.

Recommend one:

```text
A. Defer map entirely to Phase 2B/later
B. Add non-native map after list/detail stability
C. Add native map only if strongly justified
```

If native config/deps are needed, explicitly state that a new EAS build would be required.

No location permission should be needed for ordinary parish browsing.

# 20. Existing APK / EAS

Assume the current Google-enabled Android dev APK is valid.

Prefer Phase 2 to remain JS/TS-only.

Do not propose a new EAS build just because screens/components/API queries change.

Do not run:

```text
expo prebuild
expo run:android
gradlew
Android Studio
```

EAS Cloud is used for native builds.

iOS remains deferred.

# 21. Testing Strategy Required

Plan automated tests for:

- parish DTO/display helpers;
- query-key generation;
- event filtering/sorting/date formatting;
- route helpers;
- notification badge derivation if implemented;
- empty/error mapping;
- tab/shell behavior where practical;
- role-boundary regressions;
- auth-ready → tab-shell gating.

Define physical-device tests for:

- authenticated launch;
- bottom tabs;
- Android back;
- parish list;
- parish detail;
- events preview;
- pull-to-refresh;
- empty/loading/error states;
- larger font;
- logout/login regression;
- Google login regression;
- email login regression.

Do not claim physical-device PASS unless I actually perform it.

# 22. Security Review Required

Explicitly review:

- parishioner-only role boundary;
- no staff mutation endpoints;
- no tenant/home-parish assumptions;
- no user-controlled parish ID used to widen authorization;
- sanitized event discovery;
- safe external links;
- no token logging;
- no sensitive cache leakage;
- logout/account-switch cache safety;
- safe error messages.

If an authenticated endpoint appears staff-oriented, do not use it automatically.

# 23. Planning Method

This is **READ-ONLY PLANNING**.

Do not modify files.

Perform:

## Step A — Repository audit

Inspect:

- actual file tree;
- Expo Router layouts;
- placeholder tabs;
- shared UI;
- theme tokens;
- TanStack Query;
- API client;
- query-key helpers;
- auth gating;
- parish/event wrappers;
- tests;
- parishioner web implementations;
- backend DTOs/controllers/validators.

## Step B — Gap analysis

For every Phase 2 item classify:

```text
Already exists
Placeholder
Partially reusable
Needs implementation
Blocked by backend data
Deferred
```

## Step C — Architecture decisions

Specify:

- navigation hierarchy;
- Home composition;
- parish query architecture;
- event query architecture;
- notification badge strategy;
- reusable components;
- map recommendation;
- caching/freshness;
- loading/error/empty behavior.

## Step D — File-by-file plan

List concrete files to:

- create;
- modify;
- leave unchanged;
- delete only if clearly obsolete.

For every change explain responsibility and why.

## Step E — Execution order

Evaluate:

```text
Phase 2A — Shell & shared UI foundation
Phase 2B — Parish directory + detail
Phase 2C — Home + events preview
Phase 2D — Notifications badge shell
Phase 2E — polish/accessibility/regression
Optional Phase 2F — map only if justified
```

Propose a better order if repo evidence supports it.

## Step F — Verification plan

For every subphase specify:

- static checks;
- automated tests;
- Metro/device verification;
- exit criteria.

# 24. Required Planning Output

Return Markdown with:

```text
# TESTIMONIUM Parishioner Mobile — Phase 2 Implementation Plan

## 1. Executive Verdict
## 2. Current Repository Audit
## 3. Phase 0/1 Baseline That Must Be Preserved
## 4. Phase 2 Scope Reconciliation
## 5. Backend/API Audit
### Parish directory
### Parish detail
### Events
### Notifications badge
### Any safe read-only Home data
## 6. Current UI/Navigation Audit
## 7. Proposed Final Phase 2 Navigation Architecture
## 8. Proposed Design-System / Shared Component Refinement
## 9. Home Screen Plan
## 10. Parish Directory Plan
## 11. Parish Detail Plan
## 12. Events Preview Plan
## 13. Notifications Badge Shell Plan
## 14. State / TanStack Query Plan
## 15. Loading, Empty, Error & Offline Behavior
## 16. Accessibility Plan
## 17. Security & Role-Boundary Review
## 18. Optional Map Decision
## 19. File-by-File Change Plan
## 20. Proposed Phase 2A / 2B / 2C / ... Execution Order
## 21. Automated Test Plan
## 22. Physical Android Test Matrix
## 23. Native/EAS Impact
## 24. Documentation Updates
## 25. Risks / Open Questions / Backend Gaps
## 26. Phase 2 Exit Criteria
## 27. Recommended Execution Model / Reasoning Level
```

# 25. Plan Quality Requirements

The plan must be specific enough that a separate coding agent can implement it without re-deciding the architecture.

Avoid vague statements like:

```text
Create a nice Home page.
Add parish cards.
Improve navigation.
```

Specify:

- data source;
- query ownership;
- route hierarchy;
- reusable components;
- UI states;
- errors;
- accessibility;
- caching;
- exact file responsibilities.

Do not create hundreds of unnecessary files.
Prefer a small coherent structure.
Do not over-engineer hypothetical future requirements.

# 26. Critical Questions

Answer explicitly:

1. What exactly should Home contain in Phase 2 without stealing Phase 3/5 scope?
2. What are actual response shapes for `/parishes`, `/parishes/:id`, `/parish-events/all`?
3. Does backend provide everything needed for parish card/detail UI?
4. What placeholder navigation should be replaced?
5. What reusable UI primitives should improve now because current UI is rough?
6. How will UI quality improve without destabilizing Phase 1 auth?
7. Should Requests/Schedule/Profile remain placeholders, minimal shells, or something else?
8. What is the smallest correct notification badge implementation?
9. Should map be deferred?
10. Will any dependency require a new EAS build?
11. Are backend changes required?
12. What can be done entirely through Metro/Fast Refresh?
13. How will logout/account-switch cache safety remain intact?
14. What physical-device checks prove Phase 2 complete?

# 27. Current Project Context

The capstone is still under active development.

Do not plan production deployment as part of Phase 2.

The team expects possible workflow/requirement changes after an upcoming vicariate presentation, so prefer architecture that is:

- easy to modify;
- well-separated;
- backend-contract-driven;
- not prematurely deployed;
- not overfit to speculative requirements.

Continue using the centralized local backend and `npm run dev:mobile` during this phase.

# 28. Final Instruction

**Audit first. Plan only. Do not implement.**

Do not make code changes.
Do not begin Phase 3.
Do not build native Android binaries.
Do not alter working Phase 1 authentication unless a concrete Phase 2 integration regression is proven.

Return the complete Phase 2 implementation plan in Markdown so I can review it before execution.

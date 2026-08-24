# TESTIMONIUM Mobile Phase 5–7 Plan
## Scheduling, Notifications & Events, Profile & Settings

**Project:** TESTIMONIUM  
**Target:** Parishioner Mobile App  
**Phase Group:** Phase 5–7  
**Purpose:** Complete the remaining core mobile functionality before Phase 8 UI/UX redesign and Phase 9 full physical-device/cross-client QA.

---

# 1. Phase 5–7 Scope

Phase 5–7 is one implementation cycle with three internal milestones:

1. **Phase 5A — Scheduling**
2. **Phase 5B — Notifications & Event Calendar**
3. **Phase 5C — Profile & Settings**

Implementation order:

```text
5A Scheduling
→ targeted validation
→ 5B Notifications & Events
→ targeted validation
→ 5C Profile & Settings
→ full Phase 5–7 regression
```

This phase must preserve all working functionality from Phases 1–4:

- authentication and session handling;
- home and parish discovery;
- parish detail;
- document request creation/drafts;
- supporting-file uploads;
- payment QR;
- receipt upload;
- OCR verification;
- request tracking;
- Admin ↔ Mobile ↔ Parishioner Web consistency.

**Phase 5–7 is functionality-first.** Major visual redesign belongs to Phase 8.

---

# 2. Architecture Guardrails

Continue using the existing TESTIMONIUM architecture.

## Backend
- Node.js / Express 5
- Prisma 7
- PostgreSQL / Supabase
- Firebase Admin/Auth
- Cloudflare R2
- Pino logging
- API base `/api/v1`

## Mobile
- Expo / React Native
- Firebase Auth
- TanStack Query
- centralized API client
- existing navigation/auth/session architecture

## Shared clients
- Admin Portal
- Parishioner Web
- Parishioner Mobile

Any shared backend change must be treated as a possible cross-client change. If a backend contract used by Web/Admin changes, validate those consumers too.

---

# 3. Authorization Rules

## Parishioner
May:
- discover parishes;
- create/view/reschedule own schedules;
- view own notifications;
- view public parish events;
- view/edit own profile;
- manage own session/settings.

A parishioner is **not tied to a home parish**.

## Secretary / Priest
Parish-scoped. Existing parish availability, scheduling, event, and request-management boundaries must remain intact.

## Diocese Coordinator
Cross-parish role. Existing coordinator behavior must remain unchanged unless a targeted backend fix is genuinely necessary.

---

# 4. Canonical Scheduling Domain

Scheduling remains separate from document requests.

Authoritative `ScheduleEventType` values:

1. `WEDDING`
2. `MARRIAGE_SPECIAL`
3. `BAPTISM`
4. `CONFIRMATION`
5. `FIRST_COMMUNION`
6. `CONFESSION`
7. `ANOINTING_OF_THE_SICK`
8. `PRIVATE_MASS`
9. `MASS_INTENTION`
10. `WAKE_MASS`
11. `FUNERAL`
12. `MASS_OF_HOLY_SPIRIT`
13. `FIESTA`
14. `THANKSGIVING`
15. `BLESSING`
16. `DELIVERANCE`

Related backend concepts may include:
- parish availabilities;
- mass schedule templates;
- parish events;
- slot generation/capacity;
- priest/resource availability.

Do not create coupling between these event types and document request types.

---

# 5. Phase 5A — Scheduling

## 5.1 Goal

Enable:

```text
Choose service
→ Choose parish
→ Choose date
→ Load available slots
→ Select slot
→ Review
→ Submit
→ View schedule
→ Reschedule when eligible
```

The backend remains authoritative for:
- availability;
- capacity;
- conflicts;
- timezone;
- duplicate protection;
- priest/resource overlap;
- reschedule eligibility.

The client must never assume a previously loaded slot is still available at submit time.

---

## 5.2 Schedule List

Implement/complete a mobile schedule list with:

- upcoming schedules;
- past/completed schedules;
- cancelled state if supported;
- pull-to-refresh;
- loading state;
- error state;
- empty state;
- create-schedule CTA.

Each card should show available backend data such as:
- event/service;
- parish;
- date;
- time;
- status;
- priest/resource if supplied.

After create/reschedule, invalidate the correct schedule queries.

---

## 5.3 Service Selection

Use the 16 canonical event types.

Map enum values to readable labels without changing API values.

Examples:

```text
MARRIAGE_SPECIAL → Marriage Special
ANOINTING_OF_THE_SICK → Anointing of the Sick
MASS_OF_HOLY_SPIRIT → Mass of the Holy Spirit
```

If the backend exposes parish-specific service availability, use it. Do not hard-code a parish as supporting every service.

---

## 5.4 Parish Selection

Reuse current parish discovery/query infrastructure.

Show enough context to avoid ambiguity:
- parish name;
- location/address;
- service availability if returned.

Do not create another parish data source.

---

## 5.5 Date Selection

Dates must come from backend-supported availability.

Requirements:
- clear stale selected slot when parish/service/date changes;
- refetch availability as inputs change;
- prevent clearly unavailable dates;
- preserve backend timezone semantics;
- avoid treating device-local date math as authoritative.

Use the backend’s established Manila/Philippine timezone behavior.

---

## 5.6 Slot Selection

Slots must be backend-driven.

Potential slot fields:
- start;
- end;
- remaining capacity;
- priest/resource;
- availability state.

Never fabricate slots locally.

When date/service/parish changes:

```text
clear current selected slot
→ invalidate/refetch slots
→ render fresh backend results
```

If a slot becomes unavailable before submit:
- backend rejects;
- mobile shows a specific conflict message;
- refetch slots;
- clear stale selection;
- allow a new selection.

---

## 5.7 Review & Submit

Review step should show:
- service type;
- parish;
- date;
- slot;
- optional notes/purpose if backend supports them;
- backend-defined instructions.

Submit behavior:
- disable CTA while pending;
- avoid duplicate taps;
- rely on backend duplicate/idempotency protection where implemented;
- never treat disabled UI alone as race protection.

---

## 5.8 Concurrency & Race Safety

This is the highest-risk part of Phase 5–7.

### Double booking
If two users submit the same last slot concurrently:

```text
one succeeds
one gets a safe conflict
```

Capacity must never be exceeded.

### Stale slot
If a user waits after loading a slot and it becomes unavailable, submit must fail safely.

### Duplicate submit
Retries/double taps must not create duplicate bookings.

### Priest/resource overlap
Keep existing backend conflict protection authoritative.

### Transactions
Where schedule creation touches multiple related records, preserve atomicity where required.

---

## 5.9 Rescheduling

Flow:

```text
Schedule Detail
→ Reschedule
→ load valid dates
→ load fresh slots
→ select
→ review
→ confirm
```

Requirements:
- backend revalidates target slot;
- original booking remains intact if reschedule fails;
- old slot must not be irreversibly released before the new assignment is committed;
- stale target slot returns a conflict;
- client refetches list/detail/slot queries after success.

Do not implement reschedule as unsafe client-side delete + create unless the canonical backend explicitly does so transactionally.

---

## 5.10 Scheduling Error UX

Examples:

**Slot unavailable**
> That time is no longer available. Please choose another slot.

**Service unavailable**
> This service is currently unavailable at this parish.

**Network**
> Unable to load scheduling information. Check your connection and try again.

Use safe backend validation messages where appropriate.

---

## 5.11 Scheduling Query Keys

Follow current React Query conventions.

Conceptually:

```ts
scheduleKeys.all
scheduleKeys.lists(userId)
scheduleKeys.detail(userId, scheduleId)
scheduleKeys.availability(parishId, eventType, date)
scheduleKeys.slots(parishId, eventType, date)
```

Prefer targeted invalidation instead of broad cache clearing.

---

## 5.12 Scheduling Tests

### Mobile
Cover:
- enum label mapping;
- unavailable service;
- parish/date change clears stale slot;
- slot loading/error/empty states;
- submit pending state;
- list invalidation after create;
- stale-slot conflict handling;
- reschedule success/failure;
- correct event type payload;
- timezone-safe display helpers.

### Backend
Add only missing coverage for:
- concurrent double booking;
- capacity;
- stale-slot submission;
- duplicate submit;
- priest/resource overlap;
- reschedule race;
- atomic reschedule;
- wrong-user schedule access;
- wrong-parish access;
- invalid event type;
- timezone boundaries.

---

## 5.13 Phase 5A Acceptance Criteria

Complete when:
- valid schedule can be created;
- only server-available slots are selectable;
- stale slots are rejected safely;
- duplicate bookings are prevented;
- own schedule list/detail works;
- reschedule works safely;
- tenant/ownership rules hold;
- Admin scheduling behavior remains valid;
- Phases 1–4 remain unaffected.

---

# 6. Phase 5B — In-App Notifications

## 6.1 Scope

Implement in-app notifications only.

**Do not add native push notifications in this phase.**

---

## 6.2 Notification List

Each notification should support backend-provided:
- title;
- message/summary;
- timestamp;
- read/unread state;
- reference metadata.

Potential references:
- document request;
- payment/receipt;
- schedule;
- parish event.

Do not invent notification enums if backend types already exist.

---

## 6.3 Unread State

Support:
- unread visual state;
- unread count/badge where appropriate;
- mark read;
- mark all read only if backend already supports it or it is clearly required.

Unread status is server-authoritative.

---

## 6.4 Reference Navigation

Examples:

```text
Request update → Request Detail
Payment update → Request Detail / Payment
Schedule update → Schedule Detail
Event notice → Event Detail
```

Navigation must validate that the referenced entity is accessible.

Unknown/deleted references should fail safely instead of crashing.

---

## 6.5 Notification Refresh

Support:
- pull-to-refresh;
- query invalidation after mark-read;
- refetch on relevant screen focus if consistent with current app behavior.

Do not add background push behavior.

---

## 6.6 Notification Tests

Cover:
- list success;
- loading/error/empty;
- unread styling;
- unread count;
- mark read;
- failed mark-read recovery;
- request reference;
- schedule reference;
- event reference;
- stale/unknown reference;
- user isolation.

---

# 7. Phase 5B — Parish Events

## 7.1 Goal

Provide a mobile event list/calendar and detail experience using existing backend event discovery.

Parish events are public/discoverable content and are not the same as private parishioner schedules.

---

## 7.2 Event List / Calendar

Show backend-provided:
- title;
- parish;
- start/end;
- location;
- type/category;
- description preview.

Use a list-first, grouped-date, or simple calendar/list design that fits the existing app architecture.

Save major visual redesign for Phase 8.

---

## 7.3 Event Detail

Show:
- event title;
- parish;
- date/time;
- location;
- description;
- event type;
- optional image if already supported.

Do not expose staff-only metadata.

---

## 7.4 Event API

Preserve the canonical authenticated discovery behavior, including:

```text
GET /parish-events/all
```

if it remains the current route.

Do not reintroduce route-shadowing issues.

---

## 7.5 Event Tests

Cover:
- list success;
- empty;
- loading;
- error;
- date grouping/filter;
- detail;
- parish reference;
- malformed/stale event;
- authenticated access.

---

# 8. Native Push Explicitly Deferred

Do not add in Phase 5–7:
- `expo-notifications`;
- push-token registration;
- Firebase Messaging native setup;
- Android notification channels;
- background handlers;
- EAS rebuild requirements.

Native push becomes a later dedicated phase.

---

# 9. Phase 5C — Profile & Settings

## 9.1 Goal

Complete remaining parishioner account functionality without broad backend rewrites.

PostgreSQL remains the application-profile source of truth. Firebase remains the authentication identity/session layer.

---

## 9.2 Profile Screen

Display existing backend-supported fields such as:
- name;
- email;
- contact information;
- address;
- birthday;
- other current profile fields.

Do not invent fields absent from the current schema.

---

## 9.3 Edit Profile

Flow:

```text
Profile
→ Edit
→ Validate
→ Save
→ backend update
→ invalidate/refetch profile
→ show fresh profile
```

Do not create a second local profile source of truth.

Preserve the already-fixed profile-completion behavior:
- passive GET must not create/update profile;
- login/profile setup remains explicit;
- no completion-loop regression;
- saved profile refetches correctly.

---

## 9.4 Sensitive Account Fields

Treat Firebase-sensitive actions separately.

Examples:
- email change;
- password change;
- account deletion.

Do not fake these through ordinary PostgreSQL profile updates.

If a safe canonical flow is not implemented, do not expose a non-functional setting.

---

## 9.5 Settings

Recommended sections:

### Account
- edit profile;
- change password if supported;
- sign out.

### Preferences
Only real, functional preferences.

### Legal
- Terms;
- Privacy;
- existing legal pages.

### About
- app/version information if already available.

Do not add decorative toggles with no backend/app behavior.

---

## 9.6 Logout & Cache Safety

Logout must:

```text
Firebase sign out
→ clear authenticated state
→ remove/clear sensitive user-scoped query data
→ return to auth flow
```

Ensure a second user on the same device cannot see the previous user’s:
- requests;
- schedules;
- notifications;
- payment data;
- profile.

---

## 9.7 Profile/Settings Tests

Cover:
- profile render;
- profile update;
- validation;
- save error keeps form state;
- query invalidation;
- sensitive fields not incorrectly updated;
- logout;
- user-cache isolation;
- legal routes.

---

# 10. Accessibility & Functional UX Baseline

Before Phase 8 redesign, new Phase 5–7 screens should still have:
- reasonable touch targets;
- labels for icon-only controls;
- readable form labels;
- scrollable keyboard-safe forms;
- disabled button states;
- loading/empty/error states.

Do not spend Phase 5–7 on extensive animation or redesign.

---

# 11. Shared Backend Contract Discipline

Rule:

```text
shared backend change
→ identify all current consumers
→ validate Mobile
→ validate Parishioner Web
→ validate Admin if applicable
```

A passing Vite build does not prove runtime contract compatibility.

Whenever response shape/semantics change, add focused regression coverage where practical.

---

# 12. API Client Rules

Preserve the current centralized mobile API client.

Continue using:
- current Firebase token handling;
- existing one-refresh/one-retry behavior;
- existing timeout/error normalization;
- TanStack Query;
- existing multipart compatibility fix.

Do **not** disturb the now-proven Phase 3/4 file-upload transport for ordinary scheduling/notification/profile JSON calls.

---

# 13. Timezone Rules

Scheduling and events are timezone-sensitive.

Preserve backend Asia/Manila semantics.

Avoid:
- device-local assumptions as authority;
- accidental UTC date shifting;
- naive string concatenation;
- comparing date-only values at UTC midnight without checking backend meaning.

Add tests around:
- day boundaries;
- slot date matching;
- event display dates;
- reschedule date handling.

---

# 14. Offline / Network Behavior

No offline-first scheduling.

Rules:
- failed mutations never show success;
- do not silently queue schedule creation;
- cached read-only data may remain visible if current React Query behavior permits;
- refresh can recover stale state;
- schedule creation always requires current server validation.

---

# 15. Security Requirements

## Scheduling
Parishioner may only view/change own private schedules.

## Notifications
Parishioner may only access own notification records.

## Profile
Parishioner may only read/update own profile.

## Events
Only parishioner-visible event data may be exposed.

## IDs
All ownership must be server-validated.

## Staff boundaries
Secretary/Priest parish scope and Diocese Coordinator cross-parish behavior remain unchanged.

---

# 16. Backend Modification Policy

Do not broadly refactor backend code.

Change backend only if:
1. required endpoint is missing;
2. current endpoint has a real correctness issue;
3. race safety is incomplete;
4. authorization is incomplete;
5. shared response contract is inconsistent;
6. tests prove a defect.

Prefer small targeted fixes.

---

# 17. Implementation Sequence

## Step 1 — Repository Audit
Inspect actual current code for:
- scheduling routes/services/models/tests;
- availability and slot generation;
- reschedule logic;
- notifications routes/types/references;
- events endpoints;
- profile endpoints;
- existing mobile navigation/query conventions.

Treat current source as authoritative if stale docs differ.

## Step 2 — Implement 5A
Order:

```text
types
→ API
→ query keys/hooks
→ list/detail
→ service/parish/date/slot flow
→ create
→ reschedule
→ targeted tests
```

Do not proceed with a broken scheduling suite.

## Step 3 — Validate 5A
Run targeted mobile/backend scheduling checks.

## Step 4 — Implement Notifications
Order:

```text
types
→ API
→ list/unread
→ mark read
→ reference navigation
→ tests
```

## Step 5 — Implement Events
Order:

```text
API
→ event list/calendar
→ detail
→ navigation integrations
→ tests
```

## Step 6 — Validate 5B

## Step 7 — Implement 5C
Order:

```text
profile audit
→ profile view
→ edit
→ settings
→ legal/session
→ logout/cache safety
→ tests
```

## Step 8 — Full Phase 5–7 Regression

---

# 18. Full Regression Checklist

After implementation, validate:

## Authentication
- login;
- register;
- Google sign-in;
- profile completion;
- logout/session refresh.

## Home
- loads correctly;
- parish/event content works.

## Parish Discovery
- parish list/detail;
- contact/office data.

## Document Requests
- list;
- create;
- drafts;
- supporting upload;
- submit;
- detail;
- corrections.

## Payment
- QR;
- fee;
- receipt;
- OCR;
- status.

## Scheduling
- create;
- list;
- detail;
- conflict handling;
- reschedule.

## Notifications
- list;
- unread/read;
- reference navigation.

## Events
- list/calendar;
- detail.

## Profile/Settings
- view;
- edit;
- legal;
- logout/cache isolation.

---

# 19. Cross-Client Regression

If backend code changes:

## Admin
Check affected:
- availability;
- scheduling;
- parish events;
- staff workflows.

## Parishioner Web
Check every shared API whose contract changed.

At minimum use its existing:
- lint;
- typecheck if configured;
- production build;
- focused runtime regression for changed contracts.

---

# 20. Validation Commands

Use scripts actually present in each package.

Expected categories:

## Mobile

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo export --platform android
```

## Backend

```bash
npm test
```

and `node --check` for relevant changed JS files when useful.

## Web/Admin
Run existing lint/type/build/test scripts as available.

## Root

```bash
git diff --check
git status --short
```

Preserve unrelated worktree changes.

---

# 21. Native Build Policy

Expected:

```text
NEW EAS BUILD REQUIRED: NO
```

Do not add native packages without justification.

Do not run:
- `expo prebuild`;
- `expo run:android`;
- Gradle;
- Android Studio;
- EAS automatically.

If a genuinely required native dependency appears, stop and report the impact before proceeding.

---

# 22. Explicitly Out of Scope

## Phase 8
Full UI/UX redesign and polish.

## Phase 9
Comprehensive physical Android + Admin/Web integration QA.

## Phase 10
Optional native push notifications.

## Phase 11
RAG/future advanced functionality.

Also out of scope:
- deployment;
- second backend;
- native maps;
- unrelated backend refactors.

---

# 23. Phase 8 Handoff

At the end of Phase 5–7, the app should be functionally complete enough to redesign the real screens.

Phase 8 can then focus on:
- design system;
- typography;
- spacing;
- crimson/neutral palette;
- buttons/inputs/cards;
- auth redesign;
- home redesign;
- navigation polish;
- request/payment polish;
- scheduling polish;
- notifications/events polish;
- profile/settings polish;
- loading/error/empty states;
- accessibility.

Business logic should remain stable during Phase 8 wherever possible.

---

# 24. Phase 9 Handoff

After Phase 8, Phase 9 becomes the comprehensive real-device QA gate:

- physical Android;
- auth/session;
- app resume;
- network loss;
- camera/file picker;
- requests/payments/OCR;
- scheduling;
- notifications/events;
- profile/settings;
- keyboard/back behavior;
- small-screen layout;
- Admin ↔ Mobile;
- Web ↔ Mobile;
- final regression.

---

# 25. Completion Definition

Phase 5–7 is complete when:

### Scheduling
- creation works;
- server availability is authoritative;
- conflicts/double booking are safe;
- list/detail work;
- reschedule works.

### Notifications
- list works;
- unread/read state works;
- reference navigation works.

### Events
- discovery/list/calendar works;
- detail works.

### Profile/Settings
- profile view/edit works;
- session/settings/legal flows work;
- user cache isolation is correct.

### Regression
- Phases 1–4 remain working;
- shared backend changes do not regress Web/Admin;
- tests/static/build checks pass.

---

# 26. Final Implementation Report Format

Return:

```text
# TESTIMONIUM Phase 5–7 Implementation Report

## 1. Executive Summary

## 2. Phase 5A Scheduling
- screens
- API
- backend changes
- race safety
- rescheduling

## 3. Phase 5B Notifications
- list
- unread/read
- references

## 4. Events
- list/calendar
- detail

## 5. Phase 5C Profile & Settings
- profile
- editing
- settings/legal/session

## 6. Shared Backend Changes
- exact services/endpoints
- existing consumers affected

## 7. Security
- ownership
- user isolation
- parish boundaries

## 8. Test Results
- backend
- mobile
- Web/Admin where affected

## 9. Static Validation

## 10. Known Limitations

## 11. Native Impact
NEW EAS BUILD REQUIRED: YES / NO

## 12. Phase 8 Readiness
READY FOR UI/UX PHASE: YES / NO
```

---

# 27. Recommended Model Workflow

```text
Terra
→ audit current repo
→ create one detailed Phase 5–7 implementation plan

Flash
→ implement 5A
→ validate
→ implement 5B
→ validate
→ implement 5C
→ full regression

Terra
→ post-implementation audit only if shared backend contracts or scheduling race safety need review

Sol
→ only for difficult concurrency, auth/security, native Android, or low-level networking failures
```

---

# 28. Final Guardrails

1. Preserve the proven document request/payment/OCR workflow.
2. Do not touch multipart upload transport without a proven need.
3. Do not change payment QR semantics unless Phase 5–7 genuinely requires it.
4. Do not add native push.
5. Do not add native maps.
6. Do not run local Gradle/prebuild.
7. Do not deploy.
8. Do not create a second backend.
9. Do not make scheduling client-authoritative.
10. Treat backend availability/concurrency as authoritative.
11. Treat shared backend changes as cross-client changes.
12. Preserve all user/parish ownership boundaries.
13. Keep Phase 8 for redesign.
14. Keep Phase 9 for comprehensive physical QA.

---

# 29. Target End State

After Phase 5–7:

```text
Authentication
→ Home / Parish Discovery
→ Document Requests
→ Payments / OCR
→ Scheduling
→ Notifications
→ Events
→ Profile / Settings
```

Then:

```text
Phase 8 → Full UI/UX redesign
Phase 9 → Full physical Android + cross-client QA
Phase 10 → Optional native push
Phase 11 → Future RAG / advanced features
```

The end result should be a functionally complete TESTIMONIUM mobile app ready for a dedicated visual redesign instead of continued feature construction.

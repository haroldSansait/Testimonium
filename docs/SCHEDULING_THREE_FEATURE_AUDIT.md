# Scheduling feature audit — 15 November 2026

Scope: local implementation of secretary-recorded priest verbal approval, parishioner priest-change requests, and parish secretary profile contacts. Implementation reference supplied by the user: `2ffb2e2ff65f391b3c1baab41dba74d03ecd8212`.

## Confirmed defects and fixes

- Web Track Status replacement-priest lookups had no response ordering or selected-schedule guard. An older lookup could replace another parish's displayed choices or overwrite current loading/error state. Added request generation and committed-selection checks; choices clear when a lookup begins.
- Web submission used React state alone to prevent duplicates. Added an immediate ref guard and a test invoking the handler twice before a render.
- Web submission completion could close another schedule's form and display the previous schedule's success/error message. Scoped completion to the selected schedule while retaining updates to the original record.
- Web conflict recovery refreshed the list only, although searched details take precedence over the list. It now refreshes and synchronizes the specific detail record too.
- Android submission completion could clear another schedule's form or display an old error after selection changed. Added a committed-selection check. Existing mutation cache invalidation remains responsible for refreshing the original schedule.
- The existing Android detail render test failed because its API mock omitted the newly introduced `useRequestPriestChange` and `useEligiblePriests` hooks. Updated the mock and added screen interaction coverage.

Production changes are confined to `RequestTrackingPage.tsx` and `ScheduleDetailScreen.tsx`. Backend and Admin feature behavior required no production-code correction. Other changes are focused tests and this report.

## Workflow findings

**Verbal approval:** The existing modal defaults and resets the checkbox to false on closure, priest changes, and schedule changes. Its provider sends the flag through the existing assignment endpoint. The backend checks staff authorization twice, permits verbal approval only for the same-parish secretary, validates the priest's role, active status and parish, takes scheduling locks, checks conflicts, and applies an atomic expected-version update. It records `ACCEPTED`, the approval flag, secretary ID and timestamp. History and audit use the secretary's identity. Assignment does not confirm the schedule. The unchanged `requirePriestAccepted()` accepts this recorded acceptance and continues rejecting pending assignments. The priest receives an informational notice; the priest dashboard excludes accepted assignments from its pending-response list. Normal reassignment, priest rejection and Lay Minister conversion clear verbal-approval metadata.

**Priest changes:** Web and Android use `POST /schedule-requests/:id/request-priest-change` with `replacementPriestId`, optional note and `expectedVersion`. Both exclude the current priest and limit notes to 1,000 characters. The route requires PARISHIONER; service checks ownership before and inside the transaction. Replacement eligibility checks reject missing, inactive, non-priest and cross-parish accounts. Terminal and reschedule-negotiation states are rejected. The atomic update clears the active assignment, response/reason and approval metadata, records a pending change, and returns confirmed requests to pending. Original preferred priest, dates/times, venue, remarks and attachments are omitted from the write and preserved. Removed priests fail assignment ownership checks. History/audit identify the parishioner. Same-parish secretaries and authorized coordinators receive schedule-reference notifications, which resolve to the exact Admin request. Existing assignment resolves the pending change while retaining its replacement preference and note; the Admin displays pending and resolved records.

**Secretary contacts:** List, ID detail, tracking-reference detail and priest-change responses obtain contact data from current `User.fullName` and `User.contactNumber`. An active same-parish SECRETARY in `processedBy` is preferred; otherwise an active same-parish secretary is selected in ID order. Missing eligible staff yield null. Web renders the selected appointment's contact DTO; Android renders the detail response. Both show missing-detail states and offer telephone actions. Office contact is separate. The Admin profile editor was inspected at its existing persistence boundary and was not changed. Latest saved profile behavior is covered with mocked refreshed profile reads, not a live profile edit.

## Prisma compatibility — read-only live verification

The connected TESTIMONIUM database records migration `20261115203000_priest_verbal_approval_and_change_request` as successfully finished at **15 November 2026, 20:40:19 UTC+08**, with no rollback. Its stored SHA-256 checksum matches the local migration:

`65ed681dd1450c501fa620e0ba07793503e13f8b14da48323524d8f3738362a9`

Read-only catalog queries confirmed all eight schedule columns and the history approval flag, types, nullability, boolean defaults, millisecond timestamp precision, both indexes, and both user foreign keys with ON DELETE SET NULL / ON UPDATE CASCADE. Local Prisma schema validation passed. No migration or schema correction was required. No database records, schema, policies or permissions were modified.

## Targeted verification

Commands below run from the corresponding application directory.

| Check | Result |
| --- | --- |
| Backend: `node --test --test-isolation=none scripts/priest_verbal_approval_and_change_request.test.js scripts/phase4_scheduling_foundation.test.js scripts/phase4_blocker_corrections.test.js scripts/priest_assignment_availability.test.js` | 83 passed |
| Backend: `node --test --test-isolation=none --test-name-pattern="individual Lay Minister" scripts/lay_minister_fallback.test.js` | 1 passed, including stale approval cleanup |
| Admin: `node --test --test-isolation=none scripts/priest_verbal_approval_contract.test.mjs scripts/schedule_filters_and_notifications_nav.test.mjs` | 7 passed |
| Web: `node --test --test-isolation=none scripts/priest_change_tracking.test.js scripts/phase5_web_scheduler.test.js scripts/lay_minister_fallback.test.js` | 23 passed |
| Android: `npm test -- --runInBand src/__tests__/scheduleDetailCalendarRemoval.test.tsx src/__tests__/schedule.test.ts` | 24 passed |
| Admin and Web: `npm run build` | Both passed |
| Android: `npm run typecheck` | Passed |
| Changed Android screen/test ESLint; changed Web page/test Oxlint | Passed |
| Backend: `node node_modules/prisma/build/index.js validate` | Passed |

Initial sandbox restrictions blocked Node subprocess isolation and Vite build helpers. Tests ran with isolation disabled; local builds and Prisma validation passed with sandbox escalation. These were tooling failures, not application failures.

Additional existing tests exposed stale expectations:

- Admin `priest_assignment_availability.test.js`: one assertion still expects rejection through `handleAction('Cancelled')`; the current rejection button opens the required reason dialog through `openRejectModal`. The parent suite is also marked failed. Other tested availability and notification-navigation cases passed. Hydrogen's entire four-failure report was not independently reproduced through a full Admin suite.
- Backend `phase5_requested_priest.test.js`: three cases use September 2026 booking dates and now fail `DATE_IN_PAST`; another asserts exactly seven requested-priest select blocks although eleven exist. Every matched select still uses `fullName`, and the response-path behavior test passed. The initial combined run reported 108 passed and 5 failed, including the parent suite for these four assertions. These tests were left unchanged; booking rules and valid relation selections were preserved.

## Evidence limits and preservation

Backend tests mock persistence and notifications; frontend provider/handler tests use local mocks, and Android interaction tests render React Native components with mocked APIs. They do not prove production transactions, real concurrent database requests, notification delivery/clicks in a browser, profile editing against production, Android hardware behavior, or responsive visual appearance. Only migration metadata/catalog compatibility was checked live. No authenticated production mutation or end-to-end browser/device workflow was attempted.

No Git staging, commits, pushes, branch changes, merges, deployment, OTA publication, migration application or live database writes were performed. Existing parish-logo assets and unrelated features were preserved.

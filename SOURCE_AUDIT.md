# 1. AUDIT VERDICT

**B. READY WITH PRODUCT DECISIONS REQUIRED**

Phase 4 is committed, the worktree is clean, and its locking/conflict foundations are reusable. Phase 5 should add orchestration and recommendations, not replace the existing conflict engine.

Before implementation begins:

- Resolve the duration policy.
- Define whether ParishEvents/Masses block parish capacity or only their assigned priest.
- Confirm recommendation ranking/count semantics.
- Correct the Admin reschedule timestamp-offset regression described below.

# 2. BASELINE

- HEAD: `0203b005e577edb66dd6089fe099739f83c020b4`
- Commit: `0203b00 add emergency rescheduling, priest commitments, availability checks, and schedule tracking`
- Branch: `main`, aligned with `origin/main`.
- Worktree: clean.
- Staged files: none.
- Untracked files: none.
- `git diff --check`: passed.
- Phase 4 appears committed: yes; the commit contains the state machine, history/versioning, locks, five-source conflict engine, emergency rescheduling, personal schedules, calendar, preflight, and client UX.
- Existing changes requiring preservation: none currently.

Validation performed without shared-DB mutation:

- Backend focused mock/static scheduling suites: **103/103 passed**.
- Mobile scheduling Jest suite: **13/13 passed**.
- Admin scheduling helpers and priest-availability suites: passed.
- Web post-Phase-4 suite: **11/11 passed** after rerunning outside the sandbox because the first attempt hit `spawn EPERM`.
- Prisma schema validation: passed after the schema engine download was allowed.
- No live HTTP, browser automation, native-device, or database concurrency suite was run.

# 3. CURRENT SCHEDULING ARCHITECTURE

| Flow | Current chain |
|---|---|
| Web manual scheduling | `EventSchedulerPage` → `ApiSchedulerProvider` → `/schedule-requests/{configuration,availability-dates,available-slots}` → `ScheduleController` → `ScheduleService` → configuration/rule/booking helpers → Prisma |
| Mobile manual scheduling | `ScheduleWizardScreen` → TanStack hooks/API → same schedule routes and backend chain |
| Final create | Client → `POST /schedule-requests` → controller profile/tenant checks → `ScheduleService.create()` → parish row lock → validators/rules → Prisma Serializable transaction |
| Admin availability configuration | Admin editor → `/schedule-availability/parishes/:id/...` → controller tenant guard → `ScheduleAvailabilityService` → parish lock/version check → Prisma |
| Priest assignment/preflight | Admin → `/:id/priest-availability` or `/:id/assign-priest` → `ScheduleService` → priest eligibility/lock → `ConflictHelper` → Prisma |
| ParishEvent | routes/controller → `ParishEventService` → priest lock → `ConflictHelper` → Prisma |
| Recurring Mass | routes/controller → `MassScheduleService` → parish/priest locks → recurrence scan → `ConflictHelper` → Prisma |
| Personal commitment | priest route/controller → `PriestPersonalScheduleService` → priest lock → `ConflictHelper` → Prisma |
| PRIEST_LEAVE | availability route/controller → `ParishAvailabilityService` → priest lock → `ConflictHelper` → Prisma |
| Priest calendar | calendar route/controller → `CalendarService` → independent read projection over five sources → Prisma |

Core routing is visible in [scheduleRoutes.js](C:/Users/me/Documents/testimonium/testimonium-backend/routes/scheduleRoutes.js:33). Manual Web and Mobile contracts are in [scheduler.ts](C:/Users/me/Documents/testimonium/testimonium-parishioner-web/src/providers/api/scheduler.ts:135) and [api.ts](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/schedule/api.ts:90).

# 4. CENTRALIZATION STATUS

| Path | Classification | Finding |
|---|---|---|
| Normal Schedule creation | **PARTIALLY USES IT** | Reuses canonical parish/configuration/rule/capacity helpers, but orchestration and capacity loading remain in `ScheduleService`. No priest check is appropriate because creation is unassigned. |
| Availability dates | **PARTIALLY USES IT** | Reuses horizon, parish, block, and weekday rules; duplicates capacity counting. |
| Available slots | **PARTIALLY USES IT** | Same duplication as availability dates. |
| Priest assignment | **USES CANONICAL CONFLICT DOMAIN** | Stable priest lock plus `ConflictHelper.checkPriestConflict()`. |
| Priest acceptance | **USES CANONICAL CONFLICT DOMAIN** | Rechecks under the priest lock. |
| Accepted reschedule | **USES CANONICAL CONFLICT DOMAIN** | Rechecks parish capacity and retained-priest conflicts transactionally. |
| Emergency reschedule | **USES CANONICAL CONFLICT DOMAIN** | Parish lock, priest lock, capacity, and conflict recheck. |
| Personal schedule create/update | **USES CANONICAL CONFLICT DOMAIN** | Five-source check under stable priest lock. |
| PRIEST_LEAVE | **USES CANONICAL CONFLICT DOMAIN** | Checks each covered day before creation. |
| ParishEvent create/update/acceptance | **USES CANONICAL CONFLICT DOMAIN** | Eligibility, lock, and shared conflict helper. |
| Mass create/update/acceptance | **PARTIALLY USES IT** | Individual conflict decisions are canonical, but recurrence candidate enumeration is separate and bounded. |
| Priest availability preflight | **USES CANONICAL CONFLICT DOMAIN** | Calls the helper per priest but creates N+1 risk. |
| Priest calendar | **DOES NOT USE IT** | Independent projection, not an availability decision. |
| Recommendations | **DOES NOT EXIST** | No ranking, candidate, or recommendation endpoint exists. |

# 5. DUPLICATED RULES / DIVERGENCES

| Source | Rule | Canonical authority | Risk |
|---|---|---|---|
| `ScheduleService` availability-date, slot, create, accepted-reschedule, emergency paths | Active-booking query, remarks slot parsing, daily and slot counts | `BookingValidator.validateSlotAndCapacity()` plus a future shared snapshot evaluator | **High**: status, exclusion, or slot parsing can diverge. |
| `BookingValidator.validatePriestConflict()` | Same-slot Schedule-only priest check | `ConflictHelper.checkPriestConflict()` | **High**: obsolete, unused, and incomplete; should be removed or retired during Phase 5. |
| `ConflictHelper` and `PriestAssignmentHandler` | Blocking status arrays | Exported `BLOCKING_SCHEDULE_STATUSES` | **Medium**: currently identical but separately maintained. |
| Schedule, ParishEvent, Mass, and PRIEST_LEAVE services | PRIEST role, ACTIVE, same-parish eligibility | New shared priest-eligibility helper | **High** for requested-priest parity. |
| `ConflictHelper`, `ScheduleService`, `MassScheduleService`, calendar mapping | One-hour fallback | No authoritative product/configuration duration | **High**: consistent convention but not proven domain truth. |
| Backend plus Web/Admin/Mobile mappers | Extracting `Time Slot:` from `remarks` | A structured Schedule time-slot representation | **High**: system metadata and user notes share one text field. |
| Mass/Event/calendar services | Weekday/recurrence expansion | `massTemplateAppliesOnDate()` plus a shared occurrence loader | **Medium**. |
| Preflight endpoint | Catches every helper error as “unavailable” | Conflict-only classification | **Medium**: a database/calculation failure can be misclassified as genuine unavailability. |

The repeated capacity loops are visible in [ScheduleService.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/ScheduleService.js:670), while the canonical validator is in [BookingValidator.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/BookingValidator.js:212).

# 6. CURRENT PARISH AVAILABILITY DOMAIN

The current answer to “Can this parish accept this service on this date/time?” is:

1. Parish must exist and be active.
2. `eventSettings` must parse successfully.
3. Service must be one of the parish’s enabled services.
4. Slot must be one of the configured parish-wide start times.
5. Date/time must fall within today through Manila today + 90 days.
6. Office day must be open; the slot start must be before closing.
7. No `PARISH_CLOSED`, `SECRETARY_LEAVE`, or `FULLY_BOOKED` block may cover the date.
8. Persisted rule precedence is:
   - service-specific date override;
   - base date override;
   - service weekday override;
   - parish weekday rule.
9. Daily and per-slot capacity must remain.

Canonical sources:

- Configuration parsing: [SchedulingConfiguration.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/SchedulingConfiguration.js:43)
- Manila horizon, parish blocks, capacity: [BookingValidator.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/BookingValidator.js:28)
- Weekday/date-rule precedence: [SchedulingAvailability.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/SchedulingAvailability.js:140)

Limitations:

- Slots and capacities are parish-wide, not service-specific.
- ParishEvents and recurring Masses do not consume general parish slot/daily capacity.
- Venue capacity is informational only.
- `PRIEST_LEAVE` is person-specific and correctly does not close the parish.

# 7. CURRENT SLOT GENERATION

Endpoints:

- `GET /api/v1/schedule-requests/configuration?parishId=`
- `GET /api/v1/schedule-requests/availability-dates?parishId=&eventType=`
- `GET /api/v1/schedule-requests/available-slots?parishId=&date=&eventType=`

DTOs:

- Configuration: services, configured slot starts, daily/slot capacity, venue capacity, horizon, configuration version/update timestamp.
- Availability dates: `{ eventType, serviceAvailable, dates[] }`
- Slots: `string[]`

Behavior:

- Dates are generated across a 91-calendar-day Manila window.
- Slots are not synthesized from operating windows; configured slot strings are filtered for date, time, and capacity.
- Capacity includes all Schedules except `CANCELLED` and `REJECTED`.
- Priest availability does not affect returned dates or slots.
- Server responses use `no-cache, no-store`; Mobile uses `staleTime: 0`; Web manually reloads/revalidates.
- The slot endpoint is a suitable base for parish candidate generation, but its capacity loop should be centralized before recommendation logic is added.

# 8. FINAL BOOKING TRANSACTION

`ScheduleService.create()` currently provides:

- Firebase-authenticated route.
- Parishioner profile-completeness enforcement.
- Staff parish-scope validation.
- Canonical event-type and Manila horizon validation.
- Optional idempotency lookup and payload-hash enforcement.
- PostgreSQL `Serializable` transaction.
- Exclusive parish row lock before reading configuration.
- Transactional recheck of:
  - service enablement;
  - office hours;
  - parish-wide block;
  - weekday/date rules;
  - configured slot;
  - daily capacity;
  - slot capacity.
- Atomic Schedule creation, idempotency-key creation, and notification persistence.
- Serialization conflicts returned as `409 SCHEDULE_CONCURRENCY_CONFLICT`.
- Capacity exhaustion currently returns `409 FULLY_BOOKED` for both daily and slot limits.
- No automatic transaction retry, except lookup/replay handling around idempotency races.

Evidence: [ScheduleService.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/ScheduleService.js:836).

A recommended `{date,timeSlot}` can feed directly into this path. No reservation token or new booking mutation is required.

# 9. RECOMMENDATION CONCURRENCY READINESS

The current backend correctly supports:

```text
A and B receive the same recommendation
→ A submits
→ parish row lock + capacity recheck
→ A succeeds
→ B obtains the same lock and sees A's booking
→ B succeeds only if configured capacity remains
→ otherwise B receives controlled 409 FULLY_BOOKED
```

The parish lock is shared with scheduling configuration writes and is acquired at [ScheduleService.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/ScheduleService.js:907).

**New concurrency primitive required: NONE.**

Recommendations must remain read-only snapshots. Do not add holds.

# 10. CURRENT PRIEST CONFLICT DOMAIN

`ConflictHelper` checks five sources:

1. Inclusive date-range `PRIEST_LEAVE`.
2. Assigned Schedules in:
   - `PENDING`
   - `REQUESTED`
   - `PROPOSED_RESCHEDULE`
   - `WAITING_PARISHIONER_RESPONSE`
   - `CONFIRMED`
3. Active assigned ParishEvents.
4. Active assigned recurring Mass templates.
5. PriestPersonalSchedule intervals.

Interval semantics are half-open: `existing.start < candidate.end && existing.end > candidate.start`, so back-to-back intervals are allowed.

Schedule duration resolution:

- Explicit start/end: authoritative.
- Start only: one-hour estimated operational fallback.
- Recoverable legacy slot/remarks: one-hour estimated fallback.
- Unresolvable assigned Schedule: fail closed.

ParishEvent end times are authoritative when present; otherwise conflict checking uses one hour. Masses always use a one-hour operational conflict convention. Manila normalization uses `Asia/Manila` and explicit `+08:00` construction.

Exclusions exist for Schedule, Event, PersonalSchedule, and Mass template self-updates. Non-owner conflict errors are redacted to generic unavailability. See [ConflictHelper.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/ConflictHelper.js:243).

This engine is suitable for requested-priest filtering/scoring, provided Phase 5 adds bounded batch-loading rather than calling it once per candidate.

The existing staff preflight:

- Route: `GET /schedule-requests/:id/priest-availability`
- Roles: Secretary, Priest, Diocese Coordinator.
- Tenant scope: owning parish for non-coordinators.
- Inputs: Schedule ID and optional candidate date/time/start timestamp.
- Output: `{ priestId, available, reasonCode? }[]`
- Privacy: safe.
- Recommendation: **reuse its underlying conflict logic, leave the endpoint UI-specific, and do not reuse its catch-all loop as the recommendation engine.**

# 11. CURRENT DURATION MODEL

| Resource | Classification | Current behavior |
|---|---|---|
| Schedule with explicit start/end | **A — authoritative** | Supported by schema and conflict helper. |
| Newly created parishioner Schedule | **B — deterministic operational duration** | Server writes start + 60 minutes and labels it estimated in remarks. |
| Legacy Schedule with slot | **B** | Recovered slot + 60 minutes. |
| Unresolvable legacy Schedule | **C — missing/ambiguous** | Conflict check fails closed. |
| ParishEvent with endTime | **A** | Explicit start/end. |
| ParishEvent without endTime | **B** | 60-minute conflict fallback. |
| Mass template | **B** | Start-only; 60-minute conflict convention. |
| PriestPersonalSchedule | **A** | Explicit startAt/endAt with DB constraint. |
| PRIEST_LEAVE | **A/B** | Explicit inclusive date range representing full-day unavailability. |

The schema exposes no service duration field: [schema.prisma](C:/Users/me/Documents/testimonium/testimonium-backend/prisma/schema.prisma:486).

A universal 60-minute duration is therefore not an authoritative Phase 5 fact.

# 12. RECOMMENDATION INPUT SUPPORT MATRIX

| Input | Classification | Source state |
|---|---|---|
| Event/service type | **SUPPORTED NOW** | Canonical 16-value catalog and enabled-service validation. |
| Preferred date | **SUPPORTED NOW** | Existing clients select an exact date. |
| Explicit date range | **PARTIALLY SUPPORTED** | Backend supports a 0–90-day horizon, but no recommendation range contract exists. |
| Duration | **PARTIALLY SUPPORTED** | Operational 60-minute fallback; not authoritative per service. |
| Parish calendar | **PARTIALLY SUPPORTED** | Rules, blocks, office hours, capacity supported; events/Masses are not general parish-capacity blocks. |
| Confirmed events | **PARTIALLY SUPPORTED** | Block an assigned priest, not the whole parish/resource. |
| Pending events/requests | **SUPPORTED NOW** for Schedule capacity/priest rules | Exact policy differs by resource. |
| Priest assignments | **SUPPORTED NOW** | Structured assignment and response state. |
| Priest personal schedules | **SUPPORTED NOW** | Explicit intervals. |
| Operating constraints | **SUPPORTED NOW** | Office hours, enabled services, configured slots, horizon. |
| Blackout periods | **SUPPORTED NOW** | ParishAvailability and persisted date rules. |
| Rescheduling holds | **NOT SUPPORTED / NOT NEEDED** | Proposed targets are advisory and do not reserve capacity. |

# 13. PENDING / CAPACITY POLICY

Parish daily and slot capacity currently count every Schedule except `CANCELLED` and `REJECTED`. Therefore these consume capacity:

- `PENDING`
- `REQUESTED`
- `PROPOSED_RESCHEDULE`
- `WAITING_PARISHIONER_RESPONSE`
- `CONFIRMED`
- `COMPLETED` if present on the queried date

Priest availability uses only the five nonterminal blocking statuses, excluding `COMPLETED`.

Additional semantics:

- A proposed reschedule continues consuming capacity at its current/original `requestedDate`.
- The proposed target date is not held.
- Unassigned Schedules consume parish capacity but no priest capacity.
- Active ParishEvents and Mass templates block an assigned priest regardless of pending/accepted response state.
- ParishEvents/Masses do not currently consume Schedule slot/daily capacity.

Recommendation filtering must mirror these rules unless product explicitly changes them.

# 14. RECOMMENDATION SEARCH-WINDOW ASSESSMENT

Current authoritative bounds:

- Minimum: Manila today, with passed same-day slots removed.
- Maximum: Manila today + 90 calendar days, inclusive.

The older `preferredDate ±7 days` rule is **ARBITRARY / NEEDS DECISION**.

Safest MVP:

- Search the existing 0–90-day horizon.
- Optionally narrow it with a validated explicit range.
- Rank by distance from the preferred date.
- Do not impose an implicit ±7 window.

# 15. CANDIDATE-GENERATION DESIGN FEASIBILITY

A safe pipeline is feasible:

1. Validate parish, event type, preferred date/range, and horizon.
2. Load parish configuration, office hours, blocks, weekday rules, and date overrides once.
3. Load all capacity-consuming Schedules for the bounded range once.
4. Group bookings by Manila date and normalized configured slot.
5. Iterate configured slots only; apply date rules, office rules, daily capacity, slot capacity, and same-day expiry.
6. Validate requested-priest eligibility.
7. Batch-load that priest’s five conflict sources for the same bounded range.
8. Evaluate intervals in memory using the canonical ConflictHelper semantics.
9. Keep preferred-priest-unavailable candidates, but mark/rank them lower.
10. Apply deterministic ordering and a server-controlled result cap.

Existing reusable functions include `validateDateHorizon`, `requireEnabledSchedulingService`, `validateParishAndOffice`, `validateParishAvailability`, `evaluateSchedulingRules`, `parseManilaDateTime`, and ConflictHelper’s interval resolution.

# 16. RANKING / SCORING ASSESSMENT

Current source contains **NO recommendation ranking or score logic**.

| Factor | Assessment |
|---|---|
| Date proximity | **SOURCE-SUPPORTED / SAFE TO ADD** |
| Exact configured time preference | **SAFE TO ADD**, but UI semantics need definition |
| Requested-priest availability | **SOURCE-SUPPORTED / SAFE TO ADD** as a soft factor |
| Capacity contention | **SHOULD DEFER** unless product defines why it benefits users |
| Morning/afternoon | **NEEDS PRODUCT DECISION**; no current input |
| Numerical score exposure | **SHOULD DEFER** |

`+20 morning`, `+40 preferred priest`, and `+10 low contention` have no authoritative source basis. They are arbitrary old-plan suggestions.

Recommended deterministic order:

1. absolute date distance;
2. preferred-priest available first, if selected;
3. exact preferred slot, if supplied;
4. earlier date;
5. configured slot order.

# 17. RECOMMENDATION DTO RECOMMENDATION

Minimal safe DTO:

```json
{
  "parishId": 12,
  "eventType": "BAPTISM",
  "preferredDate": "2026-09-20",
  "window": {
    "from": "2026-09-08",
    "to": "2026-12-07"
  },
  "generatedAt": "2026-09-08T12:00:00.000Z",
  "recommendations": [
    {
      "date": "2026-09-20",
      "timeSlot": "10:00 AM",
      "startAt": "2026-09-20T02:00:00.000Z",
      "preferredPriestAvailable": true,
      "reasons": ["PREFERRED_DATE", "PREFERRED_PRIEST_AVAILABLE"]
    }
  ]
}
```

Guidance:

- Array order is the rank; omit internal numeric scores.
- Omit `endAt` until duration is authoritative, or explicitly label it estimated.
- Do not return remaining booking counts, other users, conflict titles, notes, leave reasons, or staff-only data.
- Reason labels should be bounded enums, not free-form internal explanations.

# 18. REQUESTED PRIEST — CURRENT STATE

- Prisma structured field: **no**.
- Schedule API input: **no**.
- Web structured selector: **no**.
- Mobile structured selector: **no**.
- Admin structured preference display: **no**.
- Current representation: free text in Additional Notes only.
- Web and Mobile explicitly tell users that priest preference is not guaranteed.
- Admin displays the full request remarks/notes.

Evidence:

- Create schema: [scheduleSchemas.js](C:/Users/me/Documents/testimonium/testimonium-backend/validators/scheduleSchemas.js:10)
- Web notes UI: [EventSchedulerPage.tsx](C:/Users/me/Documents/testimonium/testimonium-parishioner-web/src/pages/dashboard/EventSchedulerPage.tsx:444)
- Mobile notes UI: [ScheduleWizardScreen.tsx](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/schedule/ScheduleWizardScreen.tsx:518)

# 19. REQUESTED PRIEST — DATABASE ASSESSMENT

**Option B: add nullable `requestedPriestId` to Schedule.**

Minimum conceptual change:

- Nullable FK to `User`.
- Named relation separate from `assignedPriest`.
- `onDelete: SetNull`.
- Index on `requestedPriestId`.
- No backfill.
- Existing rows remain null.

Semantics:

- Preference is written at request creation.
- Actual assignment remains `assignedPriestId`.
- Reassignment must not modify the preference.
- Rescheduling should preserve it automatically on the same Schedule row.
- Inactive/transferred priests remain historical references but become ineligible/unavailable operationally.
- If preference editing is later allowed, add history/audit treatment; the MVP can keep it immutable after submission.

# 20. REQUESTED PRIEST — BUSINESS SEMANTICS

Recommend **B: show slots where the preferred priest is unavailable, ranked lower and labeled unavailable**.

This follows the master requirement:

- Request remains valid.
- Another priest may be assigned.
- Preference creates no hold.
- Preference never bypasses eligibility or conflicts.
- Staff retains final assignment control.
- Actual assignment may differ without changing `requestedPriestId`.

# 21. REQUESTED PRIEST — ELIGIBILITY

Eligible choices must exactly match current assignment authority:

- User role is `PRIEST`.
- User status is `ACTIVE`.
- User belongs to the selected parish.
- Both parish priest and assistant priest are eligible; `isAssistant` is presentation metadata only.
- Diocese Coordinator is not eligible merely because of coordinator authority.
- No visiting-priest concept exists in current source; do not introduce one.

Current authoritative assignment validation is in [ScheduleService.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/ScheduleService.js:1599).

The existing parish DTO exposes only one priest, and parishioners cannot access the staff `/users` directory. Phase 5 therefore needs a small safe eligible-priest read endpoint returning only ID, name, and assistant/primary label.

# 22. WEB IMPACT

Preserve the current Parish → Service → Date → Slot → Confirmation flow.

Minimum integration:

- Add optional requested-priest selection before recommendation calculation.
- On the slot step, show a small “Suggested times” section above the existing manual slot grid.
- Selecting a suggestion populates the existing date/time state.
- Keep manual calendar and slot selection always available.
- Preserve notes and other inputs after a stale 409.
- Refetch recommendations plus existing dates/slots on conflict.
- Add provider types/methods; do not duplicate availability rules in React.

Current stale-capacity handling already retains parish/service/notes and refreshes authoritative options at [EventSchedulerPage.tsx](C:/Users/me/Documents/testimonium/testimonium-parishioner-web/src/pages/dashboard/EventSchedulerPage.tsx:260).

# 23. MOBILE IMPACT

Minimum parity:

- Extend scheduling types/API/query keys for eligible priests and recommendations.
- Add optional requested-priest selection without visual redesign.
- Render suggested candidates near the existing time-slot step.
- Populate existing `selectedDate` and `selectedSlot`.
- Preserve remarks and earlier selections on stale recommendation failure.
- Invalidate/refetch recommendations, availability dates, and slots after creation/conflict.
- Continue using Manila server results; do not derive recommendation dates from device-local time.

The current wizard already preserves most draft state and classifies availability conflicts at [ScheduleWizardScreen.tsx](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/schedule/ScheduleWizardScreen.tsx:225).

# 24. ADMIN IMPACT

Minimum changes:

- Map and display requested priest separately from actual assigned priest.
- Indicate whether the preference is presently available, using sanitized status only.
- Optionally preselect or visually highlight the requested priest, but require normal staff confirmation.
- Keep current assignment controls and ConflictHelper-backed final validation.
- No Admin recommendation engine is required.

# 25. CENTRAL DOMAIN ARCHITECTURE RECOMMENDATION

**OPTION B: create a `ScheduleAvailabilityDomainService` that orchestrates existing helpers.**

Responsibilities:

**REUSE EXISTING**

- Configuration parsing.
- Manila date/horizon helpers.
- Parish block and weekday/date rules.
- ConflictHelper interval and privacy semantics.
- Existing final transactions, locks, versioning, and idempotency.

**NEW ORCHESTRATION**

- Load a bounded parish availability snapshot.
- Group capacity by date/slot.
- Load a bounded priest conflict snapshot.
- Evaluate candidates consistently.
- Generate and rank recommendations.
- Return sanitized read DTOs.

**DO NOT MOVE**

- Parish/priest row locks.
- Final booking transaction.
- Schedule state machine/version history.
- Emergency and accepted-reschedule mutations.
- Existing assignment mutation authority.

ConflictHelper should be extended with reusable batch/snapshot evaluation while preserving `checkPriestConflict()` for existing writers.

# 26. REUSE / EXTEND / NEW / DEFER MATRIX

| Component | Decision |
|---|---|
| ConflictHelper | **EXTEND** with batch-loading/shared pure evaluation; preserve existing API |
| SchedulingAvailability | **REUSE/EXTEND** pure rules and locks |
| BookingValidator | **EXTEND** capacity evaluation; retire obsolete `validatePriestConflict` |
| ScheduleService | **EXTEND**, retaining write authority |
| Current slot endpoints | **REUSE AS-IS** for manual fallback; internally centralize later |
| Priest availability endpoint | **LEAVE UI-SPECIFIC**, reuse underlying logic |
| Normal booking transaction | **REUSE AS-IS** |
| Requested-priest model field | **NEW** |
| Eligible-priest read endpoint | **NEW** |
| Recommendation endpoint | **NEW** |
| Ranking engine | **NEW**, deterministic and non-numeric externally |
| Web UI | **EXTEND** |
| Mobile UI | **EXTEND** |
| Admin UI | **EXTEND minimally** |
| Reservation/hold system | **DEFER / DO NOT ADD** |

# 27. DATABASE CHANGE ASSESSMENT

Centralized availability: **NO**

Recommendations: **NO**

Requested priest: **YES**

Minimum additive change: nullable indexed Schedule FK to User, `onDelete: SetNull`, no backfill, no destructive alteration.

# 28. INDEX / PERFORMANCE ASSESSMENT

Current useful indexes include:

- Schedule: parish/date composite; individual assigned-priest, status, and requested-date indexes.
- ParishEvent: parish/date and visibility/date.
- PersonalSchedule: priest/start/end composite.
- Availability: parish and date-range indexes.
- Persisted rules: parish/date and uniqueness constraints.

For a bounded initial recommendation window, these are functionally adequate at modest scale. Actual query patterns expose gaps:

- ParishEvent has no assigned-priest/date index.
- ParishAvailability has no user/type/date index.
- Schedule has no assigned-priest/date/status composite.
- Mass templates have no assigned-priest/dayType composite.

Do not add all speculatively. Measure the batched implementation on a disposable PostgreSQL copy with `EXPLAIN ANALYZE`; add only proven indexes. The new `requestedPriestId` should receive an index because its lookup pattern is explicit.

# 29. N+1 / QUERY-RISK ASSESSMENT

Unacceptable design:

```text
date × slot × priest × five conflict queries
```

Recommended approximate query groups:

1. parish plus scheduling configuration/rules/blocks;
2. capacity-consuming Schedules for the whole range;
3. eligible requested-priest record;
4. assigned Schedules for requested priest;
5. assigned ParishEvents;
6. relevant Mass templates;
7. personal schedules;
8. PRIEST_LEAVE ranges.

That is roughly 7–9 bounded query groups, followed by in-memory evaluation. Measure query count, rows loaded, p50/p95 latency, and worst-case 91-day range after implementation.

# 30. TIMEZONE

Candidate generation must operate exclusively in **Asia/Manila**.

Canonical backend helpers:

- `getManilaDateString`
- `parseManilaDateOnly`
- `parseManilaDateTime`
- `formatManilaTimeSlot`
- `getManilaHorizonMaxDate`

These are defined in [ConflictHelper.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/ConflictHelper.js:30).

Current source issue requiring a prerequisite correction:

- Admin constructs `proposedStartDatetime` as `YYYY-MM-DDTHH:mm:ss` without an offset at [ScheduleRequestsPage.tsx](C:/Users/me/Documents/testimonium/testimonium-admin-portal/src/pages/ScheduleRequestsPage.tsx:215).
- Backend requires an explicit `Z` or `±HH:MM` at [scheduleSchemas.js](C:/Users/me/Documents/testimonium/testimonium-backend/validators/scheduleSchemas.js:5).
- Direct validation confirmed that the current Admin payload fails and `+08:00` succeeds.

Also, Web/Admin/Mobile fallback display code uses device-local `getHours()` for timestamps. Recommendations should return canonical slot text/start instants so clients do not reinterpret Manila slots.

# 31. PRIVACY / AUTHORIZATION

Recommendation responses may disclose only:

- whether a slot is currently available;
- whether the requested priest is available;
- public priest identity selected by the user;
- bounded reason labels.

They must not disclose personal schedule titles/notes, leave titles/reasons, another parishioner’s request, ParishEvent private details, or internal conflict metadata.

Authorization recommendation:

- Require authentication, consistent with current scheduling routes.
- Parishioners may search an active selected parish because manual scheduling already permits this.
- Secretary/Priest searches must be limited to their authoritative parish.
- Coordinators need not receive broader recommendation visibility unless Admin reuse is approved.
- Validate requested-priest eligibility server-side without exposing cross-parish personnel.

ConflictHelper’s current non-owner redaction is reusable at [ConflictHelper.js](C:/Users/me/Documents/testimonium/testimonium-backend/services/ConflictHelper.js:14).

# 32. ENDPOINT RECOMMENDATION

Use:

```text
POST /api/v1/schedule-requests/recommendations
GET  /api/v1/schedule-requests/eligible-priests?parishId=...
```

Register static routes before `/:id`.

POST is preferable for recommendation retrieval because the search payload may contain a range, service, parish, requested priest, and time preference. It remains read-only and needs no idempotency key.

Request:

```json
{
  "parishId": 12,
  "eventType": "BAPTISM",
  "preferredDate": "2026-09-20",
  "dateFrom": "2026-09-08",
  "dateTo": "2026-12-07",
  "preferredTimeSlot": "10:00 AM",
  "requestedPriestId": 44
}
```

`dateFrom`, `dateTo`, `preferredTimeSlot`, and `requestedPriestId` should be optional. Do not accept client-supplied duration as authoritative.

# 33. IDEMPOTENCY / STALE RECOMMENDATION HANDLING

- Recommendation call: no idempotency key.
- Final booking: reuse the existing idempotent `POST /schedule-requests`.
- Stale candidate:
  - backend returns existing controlled 409;
  - client preserves parish, service, notes, requested priest, and preferred date;
  - clears only the invalid selected slot as appropriate;
  - refetches recommendations/dates/slots;
  - explains that availability changed.

No recommendation token should bypass final validation.

# 34. MANUAL SCHEDULING FALLBACK

The existing manual calendar and slot flow must remain authoritative and available.

Recommended behavior:

```text
recommendation succeeds → show suggestions plus manual controls
recommendation returns none → show message plus manual controls
recommendation service fails → show recoverable warning plus manual controls
```

Recommendations enhance the wizard; they do not replace it.

# 35. ERROR / RATE-LIMITING ASSESSMENT

Recommended contracts:

- `400`: invalid type/date/range/time/preference input.
- `401`: expired/missing authentication.
- `403`: staff cross-parish scope violation.
- `404`: parish or requested search context not found.
- `200` with empty results and `NO_SCHEDULE_RECOMMENDATIONS`: valid search with no candidates.
- `409`: final create reports stale capacity/conflict; the read-only search itself should not normally return 409.
- `429`: existing rate-limit envelope.
- `500`: generic recommendation calculation failure, without draft mutation.

Do not copy preflight’s catch-all “unavailable” behavior into recommendations; distinguish genuine conflict from database/configuration failure internally.

Existing global/adaptive rate limits are sufficient initially. One caveat: limiters are mounted before route authentication, so their authenticated detection sees requests as anonymous; a POST recommendation enters the lower write bucket. Measure before adding a route-specific limiter—no new infrastructure is required.

# 36. EXISTING TEST COVERAGE

Existing coverage includes:

- canonical services/configuration;
- Manila date/horizon behavior;
- office rules, blocks, and capacity;
- persisted weekday/date-rule precedence;
- idempotency and error-code redaction;
- state-machine/version invariants;
- five-source priest conflicts;
- privacy masking;
- simulated lock races;
- real disposable-DB Phase 4 concurrency suites in the repository;
- priest eligibility/assignment hardening;
- personal schedules;
- Mass/Event conflicts;
- Admin preflight UX;
- Mobile scheduling state/idempotency/query-key behavior;
- Web schedule history/tracking.

Important gaps:

- No current recommendation service or endpoint tests.
- No cross-check proving manual availability and recommendation filtering match.
- No requested-priest persistence or client tests.
- No batched query-budget test.
- No policy test for whether ParishEvents/Masses consume parish resources.
- No Admin HTTP-contract test catching the missing reschedule timestamp offset.
- The existing `phase5_scheduling.test.js` name refers to earlier scheduling work, not this Phase 5 intelligence scope.

# 37. REQUIRED PHASE 5 TEST MATRIX

Add focused tests for:

**Central domain**

- Manual endpoint and recommendation candidate parity.
- Closure, weekday rule, date override, disabled service.
- Daily and slot capacity.
- Every relevant Schedule status.
- ParishEvent/Mass policy once decided.
- Priest leave, personal commitment, and Manila boundaries.
- Back-to-back interval behavior.
- Unresolvable legacy Schedule fail-closed behavior.

**Recommendations**

- Preferred date available/unavailable.
- Alternatives before/after preferred date.
- Horizon and explicit-range limits.
- Stable ordering and duplicate-free output.
- Requested-priest available/unavailable.
- No private data.
- Batched query-count ceiling.
- Read-only/no database writes.
- Two users receiving the same candidate.
- Stale final submission returning 409.
- Manual create remains authoritative.

**Requested priest**

- Null preference.
- Eligible primary/assistant.
- Inactive, non-priest, wrong-parish rejection.
- Unavailable preference does not invalidate request.
- Actual assignment may differ.
- Preference survives reschedule/reassignment.
- Staff sees preference.
- Private conflict details remain hidden.

**Clients**

- Web/Mobile selection and stale refresh.
- Manual fallback after recommendation failure.
- Admin preference display.
- Admin reschedule timestamp includes explicit Manila/UTC offset.

# 38. MIGRATION RISK

Requested-priest migration risk is low if limited to:

- nullable additive column;
- nullable FK to User;
- `ON DELETE SET NULL`;
- index;
- no backfill;
- no status or existing relation changes.

Validate the migration on disposable PostgreSQL before deployment. Do not use `db push`.

# 39. PHASE 1–4 REGRESSION BOUNDARIES

Protect:

- Profile completeness, greeting/name behavior, and Additional Notes.
- Document/authorization/receipt workflows.
- Directory, councils, and photos.
- Schedule state machine and terminal immutability.
- Schedule version/history.
- Staff-proposed rescheduling.
- Emergency confirmed rescheduling.
- Parish and stable priest locks.
- Five-source conflict checks.
- Priest personal schedule ownership/privacy.
- Mini calendar and ongoing eligibility.
- Priest preflight privacy.
- Web/Mobile tracking/history and stale availability recovery.

# 40. FILES LIKELY TO CHANGE

Do not change them during this audit.

Backend likely overlaps:

- `services/ScheduleService.js`
- `services/ConflictHelper.js`
- `services/BookingValidator.js`
- `services/SchedulingAvailability.js`
- new `ScheduleAvailabilityDomainService.js`
- `controllers/ScheduleController.js`
- `routes/scheduleRoutes.js`
- `validators/scheduleSchemas.js` or a new recommendation validator
- `prisma/schema.prisma`
- one additive migration
- focused scheduling tests

Clients likely overlap:

- Web scheduler provider/types and `EventSchedulerPage.tsx`
- Mobile schedule types/API/query keys/wizard/tests
- Admin ScheduleRequest types/provider/details page
- Admin reschedule timestamp construction/test

# 41. GENUINE PRODUCT DECISIONS REQUIRED

| Decision | Source state | Recommended default | Risk |
|---|---|---|---|
| Duration used for requested-priest availability | Source has only estimated 60-minute convention | Preserve it explicitly as an operational estimate for MVP, or define service duration before claiming exactness | False available/unavailable result |
| Do ParishEvents/Masses block parish capacity? | Source blocks only assigned priest | Do not make them parish-wide blocks without a resource policy | Overblocking an entire parish |
| Unavailable preferred-priest slots | Master says preference, not guarantee | Keep visible, rank lower, show generic unavailable indicator | Hiding valid parish capacity |
| Recommendation count | Not defined | Planning default: 6, server capped | Payload/compute growth or poor choice set |
| Search window | Only 0–90 horizon is authoritative | Search full horizon, optionally narrow explicitly | Arbitrary ±7 omissions |
| Time preference | No current general preference input | Support exact configured slot only; defer morning/afternoon | Invented UX semantics |
| Capacity-contention score | No product basis | Defer | Unexplainable ranking |
| Reason labels | No current contract | Only bounded, source-backed enum labels | Privacy leakage or misleading explanations |

# 42. RECOMMENDED PHASE 5 IMPLEMENTATION BOUNDARY

**Prerequisite**

- Correct Admin proposed-reschedule timestamps to include an explicit offset and add an HTTP-contract test.

**5A — Centralized availability orchestration**

- Shared parish snapshot/capacity evaluator.
- Shared requested-priest eligibility.
- ConflictHelper batch/snapshot extension.
- Existing writers remain authoritative.

**5B — Recommendations**

- Validated read-only POST endpoint.
- Full bounded-horizon candidate generation.
- Deterministic ranking.
- Safe DTO and no private details.

**5C — Requested-priest preference**

- Nullable indexed FK.
- Eligible-priest endpoint.
- Create/read DTO support.
- Final assignment remains independent.

**5D — Web/Mobile/Admin**

- Suggested slots and optional preference on Web/Mobile.
- Manual fallback preserved.
- Minimal Admin preference display.

**5E — Focused QA**

- Unit/contract tests.
- Disposable PostgreSQL concurrency and query-budget validation.
- Web/Mobile static validation.
- Separate live HTTP and physical-device verification.

# 43. SHARED DB MUTATED

**NO**

# 44. SOURCE FILES MODIFIED

**NO**

Final `git status --short` and `git diff --check` remained empty.

# 45. READY FOR SONNET 4.6 IMPLEMENTATION PLAN

**YES**, provided the plan explicitly resolves the decisions in section 41 and treats the Admin timestamp-offset defect as a prerequisite rather than folding it silently into recommendation work.
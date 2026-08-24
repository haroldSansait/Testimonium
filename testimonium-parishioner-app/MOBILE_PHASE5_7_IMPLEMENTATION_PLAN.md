# TESTIMONIUM Mobile Phase 5–7 Implementation Plan

## Summary

Implement functional scheduling, in-app notifications, events, and profile/settings while preserving current auth, uploads, payments, and cross-client contracts. This is a planning-only audit; no files or data are changed.

Phase order: Scheduling → validation → Notifications/Events → validation → Profile/Settings → full regression.

## Contract and Backend Changes

- Add authenticated `GET /schedule-requests/availability-dates?parishId&eventType`.
  - Resolve the canonical event type server-side and return `{ eventType, serviceAvailable, dates: string[] }`.
  - Return only dates with at least one bookable slot, using Asia/Manila semantics and a server-enforced rolling 90-day window.
  - Reuse/refactor the existing availability checks so closed days, parish blocks, service configuration, daily limits, and slot capacity agree with `GET /available-slots` and creation.

- Add authenticated `GET /schedule-requests/:id` for schedule detail.
  - Parishioners may fetch only their own record; staff retain parish scope and coordinators retain cross-parish access.
  - Keep `/available-slots` and all existing static routes ahead of parameterized routes.

- Extend schedule listing with optional parishioner-only `scope=upcoming|history`; leave the existing default listing contract unchanged for Web/Admin.
  - Upcoming: non-terminal schedules on or after the Manila calendar date.
  - History: completed, cancelled, rejected, and elapsed schedules.

- Make `POST /schedule-requests` idempotent with the existing `Idempotency-Key` storage using resource type `SCHEDULE_CREATE`.
  - Same user/key/canonical payload replays the created schedule; same key with a different payload returns `409`.
  - Persist the key and schedule in the same transaction; recover the winning record on unique-key races.
  - Convert serialization/last-slot contention into a safe, specific `409` conflict rather than a server error.

- Harden staff-proposed rescheduling without changing its established workflow.
  - Mobile parishioners only accept or decline staff proposals; no new parishioner self-service slot-replacement endpoint.
  - Permit acceptance only for a valid pending proposal, revalidate its date/slot/capacity transactionally, and leave the original booking unchanged on conflict.
  - Preserve existing decline-to-cancel behavior for compatibility with Parishioner Web/Admin.

- Do not add notification reference enums or event-detail APIs.
  - Existing notifications support document-request and schedule references; general notifications remain non-navigable.
  - Event detail will reload the originating month feed using its `year`, `month`, and event ID, supporting both database events and generated recurring-mass IDs.

- Before relying on idempotency, verify the existing `idempotency_keys` migration is applied and Prisma Client is regenerated in the approved target environment. This is a release blocker, not a new migration requirement.

## Mobile Implementation

- Create a typed scheduling feature with UID-scoped query keys for lists, detail, availability dates, and slots; add API hooks/mutations using the centralized client.
  - Maintain the exact 16 canonical event enum values with mobile display labels.
  - Reuse parish discovery rather than creating a parish data source.
  - Build a dependency-free, server-driven date selector from the returned 90-day date list; selecting parish, service, or date clears the prior slot immediately.
  - Query backend slots only for the selected date; never generate slots or capacity locally.
  - Use one in-flight guard and one preserved idempotency key per create attempt. On `409`, clear the slot, refetch dates/slots, and show the safe conflict message.

- Replace the Schedule placeholder with:
  - Upcoming/history schedule lists, refresh, loading/error/empty states, and create CTA.
  - Schedule detail showing service, parish, Manila-safe date/time, status, assigned priest if supplied, and a proposal response card when eligible.
  - A compact service → parish → date → slot → review wizard, with optional remarks only where supported.

- Replace the Notifications placeholder with a UID-scoped list, unread styling/count, pull-to-refresh, mark-one-read, and existing mark-all-read support.
  - Optimistically mark read, roll back on failure, then reconcile the list.
  - Route document references to owned request detail and schedule references to owned schedule detail. Unknown, deleted, or unauthorized targets show a recoverable unavailable state without crashing.

- Extend Events from the existing current-month cards to an all-events screen with previous/next month controls, chronological date grouping, refresh, and event detail.
  - Make event cards pressable while retaining the parish link.
  - Use Manila-derived current-date/month helpers rather than device-local authority; preserve safe date-only parsing to prevent UTC date shifts.
  - Fetch the same month on detail reload and show an unavailable state if the event no longer exists in that feed.

- Complete Profile and Settings using the existing authenticated profile contract.
  - Add profile edit for `fullName`, `contactNumber`, and `address`; require a non-empty trimmed name and preserve entered form data after save failure.
  - Commit the returned `PUT /auth/profile` profile through `AuthProvider`; do not introduce a second profile cache or passive profile writes.
  - Add read-only Terms and Privacy views using existing legal content, plus app-version/About information already available at runtime.
  - Do not expose email change, password change, or deletion until a Firebase-authoritative flow exists.
  - Keep logout through the current Firebase sign-out and query-client clearing path; add regression coverage for schedule, notification, request, payment, and profile cache isolation across account changes.

- Add routes for schedule creation/detail, events list/detail, and profile edit. Keep the existing tab structure and visual system; no new native dependency, push setup, maps, or redesign work.

## Validation and Tests

- Mobile Jest coverage:
  - Canonical service labels, payloads, query keys, date/slot reset behavior, date-window states, and Manila day-boundary formatting.
  - Create pending guard/idempotency header, stale-slot conflict recovery, schedule list/detail, and proposal accept/decline outcomes.
  - Notification loading/error/empty states, unread count, optimistic rollback, reference navigation, and inaccessible/deleted references.
  - Event month navigation, recurring-mass detail lookup, malformed event handling, and timezone-safe dates.
  - Profile validation/save recovery, legal views, logout, and second-user cache isolation.

- Backend coverage:
  - Availability-date parity with slots/create, invalid event/parish/date inputs, 90-day boundary, ownership, and staff/coordinator scope.
  - Same-key replay and changed-payload rejection; concurrent last-slot, capacity, stale-slot, and serialization-conflict behavior.
  - Proposal authorization, invalid/non-pending proposal rejection, atomic accept, failed accept preserving the original schedule, and cross-user access denial.
  - Notification ownership for list/read/read-all and public-event discovery route ordering.

- Run:
  - Mobile: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npx expo export --platform android`.
  - Backend: relevant `node --check` and expanded `npm test`.
  - Because shared scheduling endpoints change: Web/Admin lint and production builds, plus focused shared-contract checks.
  - `git diff --check` and `git status --short`, preserving existing unrelated changes.

- Execute database-backed concurrency tests only against an isolated disposable database with dedicated fixtures and cleanup. Without that isolation, report them as not executed rather than passing them.

## Assumptions and Constraints

- Rescheduling remains staff-proposed and parishioner-responded.
- Availability dates are server-derived for the next 90 Manila calendar days.
- The existing idempotency migration must be operational before scheduling creation is release-ready.
- No Prisma schema change, native package, EAS build, deployment, Gradle/prebuild, or physical-device QA is part of this phase.
- Phase 8 remains responsible for visual redesign; Phase 9 remains the physical Android and cross-client runtime QA gate.

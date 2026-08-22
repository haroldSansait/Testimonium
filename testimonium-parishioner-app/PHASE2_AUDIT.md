TESTIMONIUM Mobile Phase 2 — Post-Implementation Audit
1. Executive Verdict
FIX BEFORE PHYSICAL TESTING
Three high-severity defects are present: broken incremental pagination, an office-hours DTO mismatch, and malformed parish deep links can resolve to the wrong parish.
2. Source / Documentation Reviewed
Reviewed the required Phase 2 plan, implementation plan, execution prompt, supplied implementation report, current Expo Router tree, Phase 0/1 auth/API client, Phase 2 features/tests, and backend parish/event routes, services, repositories, validators, and Prisma schema.
3. Static Verification Results
Check	Result
npm run typecheck	PASS
npm test -- --runInBand	14 suites / 75 tests PASS
npm run lint	PASS, zero warnings
git diff --check	PASS
npx expo export --platform android	Not run; it emits export artifacts, so skipped to keep the audit strictly non-writing

Jest also reported an unresolved async-handle warning after tests completed.
4. Navigation & Expo Router Audit
(app) remains centrally protected by the root Stack.Protected guard and is entered only for AUTHENTICATED_READY.
The five tab roots are mounted under (tabs); parish detail and notifications are correctly above the tabs.
No legacy tab route files remain to collide with the new tree.
Current internal navigation hrefs resolve to existing routes; no sixth tab was introduced.
navigateBackOrReplace uses valid tab fallbacks and avoids unconditional router.back().
High finding H-3 below applies to malformed direct parish-detail URLs.
5. Auth / Session Regression Audit
Phase 2 preserved the Phase 0/1 protections:
Firebase observer and interactive-operation suppression remain intact.
Generation/UID checks still prevent stale auth bootstrap commits.
Parishioner/active-account gate remains enforced.
Logout calls cancelQueries(), clears the cache, then clears local auth state.
Phase 2 queries consume TanStack Query’s AbortSignal through the centralized API client.
For User A → logout → User B, an in-flight Phase 2 request is cancelled, its query cache is cleared before the protected UI is re-rendered, and no feature-local copy exists that could rehydrate A’s data. The design is sound, though the automated test only tests QueryClient cancellation/clear directly—not the full AuthProvider race.
6. TanStack Query / Race-Condition Audit
Query keys are structurally stable and list/detail keys do not collide. Search/filter changes create distinct keys, so Search A cannot overwrite Search B’s result.
However:
The directory is not actually incremental: changing page fetches a new page and replaces data.items.
A page/filter race does not mix records, but it can skip the user forward and loses prior pages.
Month parameters are captured at render time. If Home remains open across a month boundary, refreshes continue querying the prior month until some unrelated re-render occurs.
Manual refresh correctly deduplicates Home and its event subsection because they share the same query key.
7. Parish API & DTO Audit
The list contract and type-filter transport values match the backend. Search genuinely includes parish name, patron saint, and active priest/secretary names.
The important mismatch is office hours: backend structured values use openTime, closeTime, and isClosed; mobile only recognizes open, close, and closed. Therefore valid structured office hours are silently omitted.
The backend maps province out of its parish DTO despite the mobile type allowing it; this degrades the location label but does not crash. Mobile also trusts DTOs without runtime validation, so malformed responses can still produce poor display output or crash in event presentation.
8. Parish Directory Audit
Stable FlatList keys use parish ID; no nested virtualized-list issue.
Debounce cleanup is correct.
Loading, empty, and initial error states exist.
Cover-image failures do not crash, but lack an onError fallback and may leave an empty image area.
On refresh failure after a successful load, error takes precedence over cached data, replacing valid stale content with the generic error state.
9. Parish Detail Audit
Missing parish IDs safely avoid a request and show the unavailable state. Valid card navigation passes numeric IDs.
Malformed direct values are not validated. Because the backend uses parseInt, /parishes/1junk returns parish 1, rather than a safe unavailable state. Array route params can similarly become comma-joined request paths.
404, 403, network, and server errors all collapse into “Parish Unavailable”; this is safe but network failure has no in-place retry.
10. Event / Date-Time Audit
Events correctly use the public /parish-events/all endpoint.
Date parsing intentionally takes the date portion without client UTC conversion.
Backend emits DateTime values serialized as ISO timestamps; correctness therefore still depends on the backend maintaining its date-only semantics across deployment time zones.
parseTimeToMinutes handles common 12-hour and 24-hour strings, midnight, and noon, but malformed times sort as midnight.
“Upcoming” intentionally includes all events today, including events whose start time has passed. This matches the Phase 2 calendar-day rule, but is not real-time upcoming behavior.
No runtime DTO guard exists for null/malformed eventDate; dateInput.split(...) can throw.
11. Home Audit
Home remains usable when events fail: greeting and parish navigation are independent. It makes no request, schedule, payment, or notification API calls.
Profile display has safe fallbacks for missing full name/email. Event “View parish” is only rendered when a parish name and callback exist, although it still assumes parishId is valid.
12. Notification / Deferred Tabs Audit
Notifications is a protected placeholder only: no polling, unread count, notification query, read mutation, or push implementation exists.
Requests and Schedule are intentional shells with no later-phase API calls. Profile retains logout, but exposes raw PARISHIONER and ACTIVE labels.
13. Shared Component Regression Audit
Button/TextInput changes are additive and typecheck/lint pass. Loading disables Button correctly.
The accessibility claim is overstated: small Buttons are 38pt and event/filter controls have 36pt visual heights. Some use hit slop, but not all meet the claimed 44pt visible/practical target.
Skeleton loops are created once and stopped on unmount; no animation leak was found. Reduced-motion handling is absent.
14. Error-Handling Matrix
Operation	Network	401	403	404	429	5xx	Cancellation	Verdict
Parish list	Retries twice, then generic error	One token retry; persistent 401 clears session	Generic error, no retry	Generic error, no retry	Generic error, no retry	Retries twice, then generic error	Signal passed; no retry	Safe, but replaces cached list on refresh failure
Parish detail	Generic unavailable, no in-place retry	Same session handling	Generic unavailable	Generic unavailable	Generic unavailable	Retries twice, then unavailable	Signal passed; no retry	Safe but weak recovery
Events	Retries twice, section-local generic error	Same session handling	Generic section error	Generic section error	Generic section error	Retries twice, section-local error	Signal passed; no retry	Home remains usable

Malformed JSON becomes an untyped error and is retried; unexpected DTOs are not validated.
15. Security / Cross-Account Safety
No direct raw fetch or staff/mutation endpoint was introduced. Phase 2 uses only centralized authenticated requests for parishes and public event discovery.
Cross-account cache safety is sound by source trace, but it lacks a true in-flight logout/account-switch integration test.
16. Accessibility Source Audit
Implementation appears prepared for device verification, but physical 130–200% font-scale PASS cannot be claimed.
Positive: labels for icon-only controls, decorative image hiding, selected tab semantics supplied by Tabs, scalable text, safe areas, and alert roles.
Gaps: several 36–38pt controls, no reduced-motion option, raw profile enums, and no tested image-failure state.
17. Dependency / Native Impact Audit
@expo/vector-icons@15.1.1 is installed locally and lockfile-consistent. No config plugin or native configuration change is present; this JS/font dependency does not itself require another EAS build for the existing development client.
18. Test Coverage Audit
The three new Phase 2 suites do contain the reported 33 test cases. They cover helpers, endpoint paths, query keys, route guard helpers, and manual cache clearing.
They do not cover the highest-risk behavior:
directory incremental pagination;
filter/page transition behavior;
malformed detail parameters;
office-hours backend shape;
sparse component rendering;
image/link failure UI;
actual query cancellation during AuthProvider logout;
retry/error UI with existing cached data.
19. Documentation / Implementation Report Accuracy
Supported: route restructuring, protected shell, central API use, event endpoint selection, no notification API work, no native config change, and the reported 14/75 test total.
Inaccurate or overstated:
“Load more” is not incremental.
Structured office-hours rendering is not compatible with the actual backend shape.
@expo/vector-icons is recorded as ^15.0.2 / installed 15.1.1, not the report’s ~14.0.2.
Test files are in src/__tests__, not src/tests.
“All core capabilities” and “comprehensive automated coverage” overstate current evidence.
20. Findings
BLOCKER
None.
HIGH
H-1 — Broken incremental pagination. [ParishDirectoryScreen.tsx (line 175)](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/parishes/ParishDirectoryScreen.tsx:175)
“Load more” increments page, but the FlatList renders only the current response’s items; page 2 replaces page 1. Users cannot return to prior results and pages do not accumulate. Not covered by tests. Use useInfiniteParishes or explicitly append pages with filter-safe reset behavior.

H-2 — Office-hours contract mismatch. [utils.ts (line 54)](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/parishes/utils.ts:54)
Mobile expects open/close/closed; backend validates openTime/closeTime/isClosed. Valid backend office hours are omitted from parish detail. Not covered by tests. Align the mobile DTO/formatter to the backend contract and test both structured and legacy values.

H-3 — Malformed parish deep links can show the wrong parish. [[parishId\].tsx (line 5)](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/app/(app\)/parishes/[parishId].tsx:5)
Route params are passed unchecked, and backend parseInt treats 1junk as ID 1. A malformed link can render an unintended parish. Not covered by tests. Normalize a single route param and accept only the deliberate ID/slug grammar before requesting.

MEDIUM
M-1 — Cached content is discarded visually on refresh error. [ParishDirectoryScreen.tsx (line 165)](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/parishes/ParishDirectoryScreen.tsx:165)
error takes precedence over retained query data, contrary to the Phase 2 stale-content goal. Preserve cached content and show a non-blocking refresh error.

M-2 — Current-month event query does not roll over while kept open. [api.ts (line 26)](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/events/api.ts:26)
Query month is computed only on render. A long-open screen can keep refreshing the prior month after midnight/month change.

M-3 — Map URL validation/fallback is incomplete. [utils.ts (line 26)](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/parishes/utils.ts:26)
NaN and out-of-range coordinates are accepted; Android has no browser/Google Maps fallback if geo: is unsupported. Failures are swallowed without user feedback.

M-4 — 44pt interaction claim is not met everywhere. [Button.tsx (line 97)](C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/components/ui/Button.tsx:97)
Small buttons are 38pt and several controls are 36pt. This needs device/TalkBack verification and likely adjustment.

LOW
Image URLs have no onError fallback.
Profile shows raw role/status enum values.
Tests leave an unresolved async-handle warning.
Event malformed DTO handling is unguarded.
Report inventory/version details are inconsistent.
INFO
Events today remain visible after their start time by intentional calendar-day logic.
No Phase 3+ API leakage, notification polling, or native map scope leakage was found.
21. Required Fixes Before Device Testing
H-1: implement correct incremental pagination.
H-2: align office-hours DTO/formatter with backend fields.
H-3: validate and normalize parish-detail route params.
22. Recommended Device-Test Focus Areas
After those fixes: Android back from direct detail links, pagination after search/type changes, real office-hours rendering, 401/logout then account switch during active reads, failed image/external-link behavior, refresh failure with cached content, TalkBack, font scaling, and a month-boundary event refresh.
23. Final Verdict
FIX BEFORE PHYSICAL TESTING. The app shell, auth boundary, route hierarchy, and centralized-query integration are coherent, but the three high findings break expected Phase 2 directory/detail behavior and should be corrected first.
# Web caching implementation report

Implemented locally on `main`, 2026-10-21. Changes are confined to the two Web applications. Nothing was staged, committed, pushed, merged, migrated or deployed.

## Implementation and resource coverage

Both portals now have their own application-wide, memory-only TanStack React Query client and root QueryClientProvider. Protected keys contain Firebase UID, backend role, parish scope, resource and all relevant parameters. QueryClient deduplicates matching reads and supplies cached data immediately; stale mounted queries refresh without replacing available data with first-load skeletons. Failed initial reads retain retry actions. There is no query persistence, service worker or HTTP/CDN caching change.

Parishioner Web keeps the `useService` hook return capabilities: `data`, `loading`, `error`, `refetch` and `setData`, plus the existing profile update helper. Cached reads cover Home's parish/request/schedule/profile/event data, Parish Directory lists and parish details, Request Tracking's document and schedule lists, document detail/tracking hooks, schedule detail pages, notifications and payment configuration. Events and featured events share their existing identical monthly read, including the Manila calendar month in the key. Notification rows and unread counts derive from query data; optimistic read updates cancel older reads, serialize actions and retain rollback and arrival highlights.

Admin cached reads cover Secretary, Priest and Diocese dashboards; Priest assignments; filtered/paginated document and schedule lists; the details selected from those lists; notifications shared by the page and Navbar; calendar month/parish filters; Priest mini-calendar; filtered parish/user management lists; and the existing profile page. Complete query parameters, including page size, are part of each list key. Existing permissions, API mappings, optimistic workflow handlers and version checks remain authoritative.

## Preloading

Preloading starts 1.5 seconds after dashboard content is ready, runs sequentially, and checks session identity, tab visibility, foreground query activity and relevant pauses before each task. Navigation/unmount cancels remaining tasks. Fresh prefetched entries and reads already in flight are reused.

- Parishioner: require the resolved Parishioner profile and accepted policies; warm the same parish/request/schedule keys Home already consumes, then import the existing Parish Directory and Request Tracking lazy chunks. Home normally already warmed these data keys, so this does not require another fresh API read.
- Secretary: prefetch only the default document and schedule list pages, subject to the existing view permissions.
- Priest: prefetch only the default schedule list page, subject to its existing view permission.
- Coordinator: prefetch only the default parish management list, subject to its existing management permission.

Admin routes retain their existing imports. No route, screen or navigation item was added. Opportunistic tasks are skipped when the tab is hidden or foreground queries are busy; they are not forced to run later.

## Freshness and refresh ownership

| Resource | Freshness |
| --- | --- |
| Parish lists/details | 10 minutes |
| Parishioner public monthly events | 5 minutes |
| Notifications | 30 seconds |
| Document/schedule lists and details | 30 seconds |
| Profile and other integrated Admin reads | 30 seconds |
| Payment configuration | 30 seconds |
| Availability, slot and eligibility checks | Continue their existing authoritative network reads; no cached-navigation reuse |
| Client default for other explicit queries | 60 seconds |

Inactive query garbage collection is 10 minutes. Transient reads may retry once; HTTP authorization, validation and other client failures are not automatically retried. Mutations are not retried or stored as query data.

Parishioner `useService` retains one shared 10-second poller per explicit key, focus/visibility refresh, focus checks and nested `usePausePolling` counts. Notification polling retains its separate 30-second visible-tab cadence and remains independent of form polling pauses; notification actions pause its polling while in flight. Schedule detail retains no periodic poller. Manual refetch and polling bypass freshness and deduplicate an existing request.

Admin `useAutoRefresh` is unchanged: notifications 30 seconds, document/schedule lists 60 seconds, Secretary/Coordinator dashboards 60 seconds, Priest dashboard and calendar 5 seconds. Existing visibility listeners and modal/mutation conditions continue to own these refreshes. React Query has no second polling, focus or reconnect refresh path. Disabled modal/mutation observers retain data while deferring automatic invalidation fetches.

## Mutations and session isolation

The Parishioner API client and Admin Axios interceptors cancel affected query results before writes, then cancel again and invalidate related resource families only after success. This covers documents, drafts, submissions, corrections, receipts/payments, returns, scheduling/rescheduling, Priest responses, parishes/users, profile, calendar/availability and notification operations. Related dashboards and notification keys are invalidated as appropriate. Inactive filter/page variants stay invalidated until needed. Active queries refetch unless their existing pause condition prevents it. Existing explicit authoritative refreshes remain available during a modal. The read-only recommendation POST is excluded from mutation invalidation.

Query functions consume cancellation signals and verify the session generation before accepting results. Cache writes and manual refetch callbacks from an old session are rejected, including logout followed by login to the same UID. API transport uses an abort signal per protected session; obsolete responses cannot expire the next user's session.

Logout, expiry and cross-tab logout use the existing SessionService and immediately clear/cancel protected query state. UID, role or parish changes clear the cache and remount only protected route content, clearing selected details and protected local state. Public login/signup forms stay mounted. Parishioner notification/profile requirement providers live inside the existing protected route boundary. Late profile resolution cannot restore a logging-out session.

Tokens are only attached by the existing transport, never stored as query results. Protected file GETs, Government ID images, uploaded files, private signed URLs and Blob/object URLs are outside the new cached query paths. Existing secure file reads and object-URL cleanup remain in place. QueryClient contains application JSON/metadata from the integrated providers, not binary evidence. Backend headers, Firebase rules, permissions, database and infrastructure were not changed.

## Validation

| Check | Parishioner Web | Admin Portal |
| --- | --- | --- |
| Production build, including TypeScript | PASS | PASS; existing large-bundle warning |
| Lint | PASS, existing warnings | PASS, existing warnings |
| Full `npm test` | 202/202 PASS | 141 PASS, 2 failed test nodes, 143 total |
| Cache/refresh/transport/auth lifecycle tests | 33/33 PASS | 29/29 PASS |
| `git diff --check` | PASS | PASS |

The Admin failure is the unchanged `features_regression.test.mjs` assertion that Diocese Coordinator must have `MANAGE_DOCUMENT_REQUESTS`; the parent test is also reported as failed. The permission map and that test match HEAD and were not edited. Existing Secretary-only management permissions were preserved.

New automated checks execute real QueryClient/QueryObserver behavior plus the actual hooks and transports in controlled effect/timer runtimes. They cover initial reads, immediate cached reuse, concurrent deduplication, stale background refresh, recoverable errors, 10/30/60/5-second refresh wiring, focus/visibility and nested pauses, optimistic shared cache writes, mutation invalidation, failed version checks, session transport abortion, identity/role/parish/filter separation, same-UID re-login, private binary bypass, deferred/limited preloading and obsolete-response suppression. These are automated checks, not browser performance evidence.

Windows sandbox process spawning blocked the initial Vite/Node test attempts with `spawn EPERM`; reruns with permitted process access completed. No real browser, authenticated live backend, cross-tab browser interaction, visual comparison or timing benchmark was run. No real-world speed improvement or complete browser workflow PASS is claimed.

## Limits

A full reload starts with an empty cache. Uncached/garbage-collected queries, new filters/pages, first-time detail reads and private files still require the network. Availability/eligibility reads and existing wizard-specific authoritative fetches retain their current network paths. Auth/backend profile resolution remains authoritative. Changes made in another browser/account appear through the existing polling or refetch schedule, not a new push channel. A cancelled provider read may finish on the wire, but its cancelled/old-generation result cannot populate query data; session transitions also abort transport requests.

## Exact files changed

Paths below are relative to each application directory. This report is included in the Parishioner Web list.

### `testimonium-parishioner-web/`

```text
CACHING_IMPLEMENTATION.md
package.json
package-lock.json
scripts/query_cache.test.js
scripts/query_refresh.test.js
scripts/query_transport.test.js
scripts/session_reauthentication.test.js
src/App.tsx
src/main.tsx
src/api/client.ts
src/components/ProtectedRoute.tsx
src/contexts/AuthContext.tsx
src/contexts/NotificationContext.tsx
src/hooks/useService.ts
src/hooks/useDashboardPreload.ts
src/pages/dashboard/HomePage.tsx
src/pages/dashboard/ScheduleDetailPage.tsx
src/services/SessionService.ts
src/services/queryClient.ts
```

### `testimonium-admin-portal/`

```text
package.json
package-lock.json
scripts/query_cache.test.js
scripts/query_refresh.test.js
scripts/query_transport.test.js
scripts/session_reauthentication.test.js
src/main.tsx
src/api/interceptors.ts
src/components/dashboard/SecretaryDashboard.tsx
src/components/dashboard/PriestDashboard.tsx
src/components/dashboard/DioceseDashboard.tsx
src/components/dashboard/PriestMiniCalendar.tsx
src/components/layout/Navbar.tsx
src/context/AuthContext.tsx
src/hooks/useCachedQuery.ts
src/hooks/useDashboardPreload.ts
src/pages/CalendarPage.tsx
src/pages/DocumentRequestsPage.tsx
src/pages/NotificationsPage.tsx
src/pages/ParishManagementPage.tsx
src/pages/ProfilePage.tsx
src/pages/ScheduleRequestsPage.tsx
src/pages/UserManagementPage.tsx
src/routes/ProtectedRoute.tsx
src/services/SessionService.ts
src/services/queryClient.ts
```

TanStack API references checked during implementation: [QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient) and [query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).

## Logout/login regression correction

The initial cache implementation exposed a session lifecycle defect in both portals: logout left the singleton SessionService in terminal `LOGGED_OUT` state with `logoutInProgress` still set. Subsequent Firebase login did not start a new service session. The cache integration's `publishProfile` guard therefore rejected the newly fetched backend profile, leaving the protected query scope null and its queries disabled. Parishioner `useService` additionally reported those pending disabled queries as no longer loading, allowing Home to render empty lists and a blank map.

The correction adds an explicit `startAuthenticatedSession` operation invoked from Firebase's current-identity callback before backend profile resolution. It checks the current Firebase UID, refuses to interrupt `LOGGING_OUT`, resets the previous logout latch and refresh promise, advances the session generation, and publishes `ACTIVE`. Ordinary state transitions still cannot reopen a terminated session. Backend profile resolution remains required before enabling protected queries. Existing cache clearing, protected route remounting, request cancellation, cache reuse, polling and mutation invalidation remain in place. No reload workaround was added.

Token refreshes and Parishioner profile publication now check the authentication/session generation so a previous session cannot overwrite data, expire a new session, or clear its in-flight refresh. Initial profile resolution stays in the existing loading display; failure uses the existing ErrorState and retry action. The Parishioner query wrapper keeps a protected query pending while it waits for a valid scope.

The regression suite runs the actual AuthProvider, SessionService, protected route and QueryClient with controlled Firebase/backend/effect fixtures. It exercises first login, cache reuse, logout, same-UID re-login without reinitializing the service, a fresh query after clearing, another account, a second logout, old in-flight query completion, delayed profile responses, refresh single-flight races, profile loading/error/retry, and refusal to restart during logout. The original Parishioner implementation reproduced the failing `LOGGED_OUT` assertion before the fix; the corrected lifecycle tests pass in both portals. This is automated reproduction, not the requested real-browser walkthrough: no connected browser tool or authenticated browser session was available, so actual dashboard/events/map rendering after re-login remains browser-unverified.

Files changed specifically for this correction (the broader inventory above includes the earlier caching work):

```text
testimonium-parishioner-web/package.json
testimonium-parishioner-web/src/services/SessionService.ts
testimonium-parishioner-web/src/contexts/AuthContext.tsx
testimonium-parishioner-web/src/components/ProtectedRoute.tsx
testimonium-parishioner-web/src/hooks/useService.ts
testimonium-parishioner-web/scripts/query_refresh.test.js
testimonium-parishioner-web/scripts/session_reauthentication.test.js
testimonium-parishioner-web/CACHING_IMPLEMENTATION.md
testimonium-admin-portal/package.json
testimonium-admin-portal/src/services/SessionService.ts
testimonium-admin-portal/src/context/AuthContext.tsx
testimonium-admin-portal/src/routes/ProtectedRoute.tsx
testimonium-admin-portal/scripts/session_reauthentication.test.js
```

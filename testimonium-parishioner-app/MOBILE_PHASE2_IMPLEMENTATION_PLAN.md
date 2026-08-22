# TESTIMONIUM Parishioner Mobile — Phase 2 Implementation Plan

## 1. Executive Verdict

Phase 2 can be implemented entirely in mobile JS/TS using the existing authenticated API, Expo Router, and TanStack Query. No backend or native build change is required for the core shell, directory, parish detail, or events preview.

The roadmap’s request/schedule Home cards conflict with the binding Phase 2 boundary. Defer those workflows; Home will use only profile, parish discovery, and public-event data.

## 2. Current Repository Audit

| Item | Status |
| --- | --- |
| Auth-gated Expo Router shell | Implemented; must remain unchanged |
| Five tabs | Placeholder implementation |
| Home | Placeholder |
| Parishes | Placeholder |
| Requests/Schedule | Placeholder |
| Profile | Identity plus logout only |
| Shared UI/theme | Minimal but reusable |
| Parish/event API wrappers | Needs implementation |
| Query-key helpers | Only generic client helpers exist |
| Notifications | Backend supports full list, but no unread-count endpoint |

The worktree was clean during planning.

## 3. Phase 0/1 Baseline That Must Be Preserved

- Keep the centralized authenticated API client, normalized errors, timeout/cancellation behavior, single forced-token 401 retry, and no mutation retries.
- Preserve `AuthProvider` generation/UID stale-response protection, backend profile bootstrap, parishioner/active-account enforcement, protected route groups, and query clearing on logout/account switch.
- Do not add screen-local redirects or unconditional back navigation.
- Keep the existing Google and email/password native development-client workflow unchanged.

## 4. Phase 2 Scope Reconciliation

Implement:

- A polished five-tab parishioner shell.
- Home with welcome, parish discovery entry, and current-month public-event preview.
- Parish list, search/type filter, detail, safe contact/location actions, and parish-filtered event preview.
- A notification bell and intentional Phase 6 placeholder destination, without a badge or inbox implementation.
- Honest minimal shells for Requests, Schedule, and Profile.

Defer:

- Requests, appointments, payments, schedule workflows, event calendar/detail, notification inbox/read actions/deep links, native push, maps, profile editing, and all staff actions.

## 5. Backend/API Audit

### Parish directory

`GET /parishes` is authenticated and defaults to active parishes. It supports `search`, `type`, `page`, and `limit`, and returns:

```ts
{
  items: ParishDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

The supported display fields include `id`, `name`, `type`, `patronSaint`, `address`, `municipalityCity`, `province`, `contactNumber`, `email`, coordinates, imagery, description, office hours, and available documents. Mobile must not render staff names, payment fields, internal status, mutation settings, or IDs.

### Parish detail

`GET /parishes/:id` returns the same mapped DTO. Detail can safely render only populated fields:

- name, type, address/city/province;
- description;
- patron saint and feast day;
- cover image or gallery image when a real URL is present;
- office hours when valid structured data is present;
- phone and email actions.

No mass-schedule read model is returned by this endpoint; do not design a mass schedule section.

### Events

`GET /parish-events/all?year=YYYY&month=M` requires both query parameters and returns active entries for that calendar month, including public mass-template expansions. Its public DTO is:

```ts
{
  id: number;
  parishId: number;
  title: string;
  eventType: string;
  description: string | null;
  location: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  parish?: { id: number; parishName: string };
}
```

Do not call `GET /parish-events/:parishId`: its staff tenant guard is not a parishioner discovery route. Filter the public `/all` result client-side by `parishId` for parish detail.

There is no safe event-by-ID endpoint, so Phase 2 has no event-detail route.

### Notifications badge

The backend has only unpaginated `GET /notifications`, plus read mutations. It has no cheap unread-count endpoint. Per the chosen scope, Phase 2 will make no notification query and display no count badge; the bell opens an explicit read-only “Notification inbox is coming in a later phase” screen. Phase 6 can introduce the inbox, unread state, and deep links, ideally after backend pagination/count support is evaluated.

### Any safe read-only Home data

Use only the authenticated profile already in `AuthProvider`, plus the public events query. Do not use dashboard, requests, schedule, or calendar endpoints in Phase 2.

## 6. Current UI/Navigation Audit

The current `(app)` layout is a single `Tabs` navigator containing route-group roots. This cannot place parish detail and notification screens above tabs cleanly. The existing Home and Parish screens are one-line placeholders; Requests and Schedule are equivalent placeholders; Profile exposes email, role, and logout.

## 7. Proposed Final Phase 2 Navigation Architecture

Restructure routes without changing the protected `(app)` group:

```text
app/(app)/
  _layout.tsx                       # root Stack above tabs
  notifications.tsx                 # Phase 6 placeholder destination
  parishes/[parishId].tsx           # parish detail above tabs
  (tabs)/
    _layout.tsx                      # five-tab navigator
    (home)/index.tsx
    (requests)/index.tsx
    (schedule)/index.tsx
    (parishes)/index.tsx
    (profile)/index.tsx
```

- Root stack owns drill-down screens; tabs own top-level roots.
- Tab bar uses `@expo/vector-icons` icons, labels, selected/unselected colors, 44pt-or-larger hit targets, light safe-area styling, and `tabBarHideOnKeyboard`.
- Home has the branded header and bell; Parishes has a contextual “Parishes” header; deferred tabs have simple descriptive headers.
- Tapping a parish pushes detail. Detail back uses `navigateBackOrReplace` with the Parishes tab as fallback.
- Android back closes no global handler: normal stack pop applies; tab roots preserve normal platform exit behavior.
- Active tabs remain roots; no transactional child flows exist in Phase 2 to accidentally discard.

## 8. Proposed Design-System / Shared Component Refinement

Extend the existing tokens rather than redesigning authentication screens:

- Keep `#7B1C2A` primary and add only needed semantic roles: elevated surface, muted surface, focus border, and image placeholder.
- Add small reusable `AppHeader`, `Card`, `IconButton`, and feedback-state primitives. Keep `Button`, `TextInput`, and auth layouts compatible.
- Add list/card skeletons, section headers, retryable inline error treatment, and a calm empty-state treatment.
- Add `@expo/vector-icons` as a direct Expo-compatible dependency; it introduces no native plugin/configuration requirement.
- Use real parish imagery only when DTO URLs are populated. Otherwise render a decorative color surface/icon, never fake parish photos or logos.

## 9. Home Screen Plan

Home is a scrollable, pull-to-refresh screen containing:

1. A concise welcome using the authenticated profile’s existing name.
2. One primary “Explore parishes” card that switches to the Parishes tab.
3. “Upcoming this month” with up to three public events from the current-month query, sorted by local calendar date/time.
4. A “View parish” action on each event that opens its associated parish detail.
5. A compact no-events state and section-only retry state; failed event loading must not hide the welcome or parish entry.
6. Header bell linking to the explicit notification shell, with no numeric badge.

Do not add request, payment, appointment, schedule, or inbox summaries.

## 10. Parish Directory Plan

- Fetch active directory pages with `GET /parishes`, default `limit=25`; implement incremental “Load more” pagination when `totalPages > 1`.
- Use a debounced server-side search query and the API-supported type filter only: `Parish`, `Quasi-Parish`, and `Mission Station`. Label search as parish/patron search rather than claiming municipality search.
- Display card hierarchy: parish name, human-readable type, municipality/city, and address; show an actual cover image only if supplied.
- Cards must be pressable as a whole, not expose IDs, and announce name/type/location to TalkBack.
- Provide initial skeleton cards, pull-to-refresh, retryable error UI, a search-empty state with “Clear search,” and a directory-empty state.
- Search/filter values are local UI state; query responses remain server state.

## 11. Parish Detail Plan

Render a scrollable detail screen from `GET /parishes/:id`:

- Header title and deterministic back fallback.
- Optional cover image, marked decorative unless it adds information.
- Name/type, address, description, patron/feast metadata, and valid office-hours rows only when present.
- Explicit buttons for Call, Email, and Open in Maps only when their source fields exist and pass formatting checks.
- External actions use encoded `tel:`, `mailto:`, or HTTPS maps URLs with `Linking.canOpenURL`; they never auto-launch and never expose staff controls.
- A parish-scoped “Upcoming this month” subsection selects matching items from the public events query.
- Missing, 403, or 404 detail results show a safe unavailable state with a return-to-directory action.

## 12. Events Preview Plan

- Create a typed event mapper and presentation utility shared by Home and parish detail.
- Query the current local calendar month only; refresh when the screen regains focus after the query becomes stale or when the month changes.
- Treat `eventDate` as a calendar date: parse its `YYYY-MM-DD` portion without UTC shifting, and display the server-provided time strings as “time provided by parish.”
- Omit absent descriptions, locations, and end times rather than inventing values.
- Exclude prior local-calendar-day entries from “Upcoming”; retain all current-month returned entries only where a future Phase 6 calendar needs them.
- No event detail, RSVP, mutation, recurring-event editor, or full calendar.

## 13. Notifications Badge Shell Plan

Implement the selected Bell Only option:

- Add a bell with an accessible label such as “Notifications, inbox coming soon.”
- Do not query `/notifications`, derive a count, poll, mark read, or add push handling.
- The bell opens a small protected screen explaining that the inbox will appear there in a later mobile phase, with a clear Home return action.
- Keep this isolated to one screen so Phase 6 can replace it with a real inbox without changing header navigation.

## 14. State / TanStack Query Plan

Define feature-owned typed query keys and hooks:

```ts
parishKeys.list({ search, type })
parishKeys.detail(parishId)
eventKeys.month({ year, month })
```

- Parish list/detail: `staleTime: 10 minutes`; list uses paginated query data and pull-to-refresh explicitly refetches.
- Events: `staleTime: 5 minutes`; no interval polling.
- Query functions call only the centralized API client.
- Do not persist query caches to device storage.
- Continue relying on `AuthProvider`’s `queryClient.cancelQueries()` and `clear()` on logout/account switch; Phase 2 must add no parallel cache or local user-scoped copy.

## 15. Loading, Empty, Error & Offline Behavior

- Preserve previously loaded parish/event data during a refresh and show a non-blocking refresh indicator.
- Initial loads use skeletons; partial Home failures remain local to their section.
- Map normalized network, timeout, forbidden, and not-found errors to actionable, non-sensitive copy.
- Previously fetched discovery data may remain visible when offline, labeled as unavailable to refresh; no persistent offline cache is added.
- Retry read queries only through TanStack Query’s existing bounded retry policy and explicit retry controls.

## 16. Accessibility Plan

- Use 44pt minimum hit areas for tabs, icon buttons, cards, and external actions.
- Supply labels/hints/state for all icon-only controls, selected tabs, loading states, retries, and external-link actions.
- Preserve font scaling; avoid fixed-height text, use flexible rows and multiline titles, and test at 130–200% scale.
- Ensure status/content is not color-only, card reading order is logical, decorative imagery is hidden from accessibility, and list refresh/loading state is announced.
- Keep contrast consistent with existing semantic tokens and avoid motion beyond standard navigation transitions.

## 17. Security & Role-Boundary Review

- Mobile continues to gate access to active `PARISHIONER` profiles; backend remains authority.
- Use only GET discovery/detail/event endpoints and no staff mutation, map-config, payment, request, or schedule endpoints.
- Do not create a home-parish field, tenant scope, preferred-parish behavior, or “your parish” language.
- Do not turn user-entered route IDs into authorization decisions; detail API responses and 403/404 states remain authoritative.
- Use only the existing sanitized `/parish-events/all` DTO.
- Do not log tokens, URLs with sensitive content, or full errors; retain existing safe diagnostics.
- Logout/account switch clears all TanStack Query data before another user can render it.

## 18. Optional Map Decision

Defer the map entirely to Phase 2B/later after list/detail stability.

`react-native-maps` is not installed; a native map would require dependency/configuration review and a new EAS development build. Coordinate coverage has not been proven. Ordinary browsing will never request device location.

## 19. File-by-File Change Plan

Create:

- `app/(app)/(tabs)/_layout.tsx` — final tabs.
- `app/(app)/parishes/[parishId].tsx` and `app/(app)/notifications.tsx` — root-stack secondary screens.
- `src/features/home/HomeScreen.tsx` — Phase 2 Home composition.
- `src/features/parishes/api.ts`, `ParishDirectoryScreen.tsx`, `ParishDetailScreen.tsx`, `ParishCard.tsx` — typed parish access and UI.
- `src/features/events/api.ts`, `presentation.ts`, `UpcomingEventsSection.tsx` — public event query, date formatting, and reusable preview.
- `src/features/notifications/NotificationShellScreen.tsx` — intentional Phase 6 placeholder.
- Focused shared UI files for header, cards, feedback states, and icon actions.

Modify:

- `app/(app)/_layout.tsx` — convert from direct tabs to root stack.
- Existing tab route files — move into `(tabs)` and replace Home/Parishes content; replace Requests/Schedule/Profile with intentional minimal shells.
- `src/theme/tokens.ts` — additive semantic design tokens.
- `package.json` and lockfile — direct icon dependency only.
- Relevant mobile architecture/navigation/state/roadmap/decision documents after implementation.

Delete only the old route files replaced by the moves; do not delete auth, onboarding, API, Firebase, or guard files.

## 20. Proposed Phase 2A / 2B / 2C / ... Execution Order

1. **2A — Shell and shared UI:** route restructure, tabs, headers, icon dependency, minimal deferred shells, and auth-gate regression checks.
2. **2B — Parish directory/detail:** DTO mapper, list pagination/search/type filter, detail, external actions, and all feedback states.
3. **2C — Home and events:** current-month event query/presentation, Home composition, and parish-filtered event preview.
4. **2D — Notification shell:** bell and intentionally non-functional future-inbox screen; no API query.
5. **2E — Accessibility and regression:** large-font/layout pass, safe back behavior, logout/account-switch checks, tests, lint/type/bundle verification.
6. **2F — Deferred:** map assessment only after the prior exit criteria pass.

Each subphase ends with typecheck, targeted tests, lint, and Fast Refresh verification through `npm run dev:mobile`; no native build is part of these subphases.

## 21. Automated Test Plan

Add focused tests for:

- Parish list/detail DTO normalization, optional fields, type labels, pagination parameters, and no internal-field display dependencies.
- Query-key generation and event month parameter generation.
- Date-only parsing, upcoming filtering, sorting, missing-time handling, and no timezone day shift.
- Safe external-link builders and missing-data suppression.
- Home/parish loading, empty, retry, and unavailable-resource render states.
- Route helper behavior: parish detail back fallback and bell-to-shell navigation.
- Shell tab labels/selected accessibility state.
- `AUTHENTICATED_READY` still mounts the tab shell while unresolved auth states do not.
- Logout/account-switch cache clearing regression using the existing auth/query test setup.
- Assertions that Phase 2 API wrappers never invoke staff/event-mutation or request/schedule endpoints.

## 22. Physical Android Test Matrix

Run on the installed development APK after implementation:

- Existing complete-account launch reaches Home without protected-shell flash.
- Email and Google login/logout regressions remain PASS.
- All five tabs are reachable, labeled, safe-area correct, and maintain expected Android-back behavior.
- Parish initial loading, search, type filtering, pagination, pull-to-refresh, empty, timeout, and server-error states.
- Parish detail, missing resource, Call/Email/Maps actions, and public event preview.
- Home no-event, event-loading, and event-error states.
- Bell opens the intentional notification shell and never shows a misleading badge.
- Font scale 130–200%, TalkBack labels, and compact Android width checks.
- Logout then sign in as another account: no prior parish/event content flashes.

Report device results separately from static verification; do not pre-claim PASS.

## 23. Native/EAS Impact

No EAS build is required. The phase is JS/TS/UI/API work plus a JavaScript asset icon package, so the installed Google-enabled development APK and Metro/Fast Refresh workflow remain sufficient.

A future native map dependency would require a separate native-impact review and EAS build.

## 24. Documentation Updates

After implementation, reconcile:

- navigation map with the `(tabs)` plus root-stack route structure;
- state/offline guidance with implemented parish/event freshness;
- notification/deep-link documentation with the no-badge Phase 2 decision;
- roadmap scope to remove request/schedule cards from Phase 2;
- change-control log with the map deferral and notification-count backend gap.

## 25. Risks / Open Questions / Backend Gaps

- A numeric unread badge is deferred because notification listing is unpaginated and no count endpoint exists.
- Parish search does not document municipality filtering; mobile must not promise it.
- Parish DTOs contain more fields than Phase 2 should display; render an explicit public presentation subset.
- Event API has no event-by-ID endpoint and returns month-bounded results only; event detail is deferred.
- Coordinate completeness is unverified, reinforcing the map deferral.
- If directory size materially exceeds normal diocesan scale, exercise pagination before considering any local filtering expansion.

## 26. Phase 2 Exit Criteria

- An active parishioner reaches a polished five-tab shell after the existing auth gate.
- Parish directory, detail, and public event preview render only real backend fields and handle all core states.
- No request, scheduling, payment, staff, map, or notification-inbox workflow is silently implemented.
- No admin controls, home-parish assumption, token leak, or cross-account cache leak exists.
- Automated checks pass; Android development-client checks are recorded accurately.
- No native rebuild is needed.

## 27. Recommended Execution Model / Reasoning Level

Use one implementation agent in staged Phase 2A–2E checkpoints with high reasoning effort. Require review after each checkpoint, retain the dirty-worktree baseline, and run direct TypeScript, test, lint, Android bundle, and diff checks before declaring the phase complete.

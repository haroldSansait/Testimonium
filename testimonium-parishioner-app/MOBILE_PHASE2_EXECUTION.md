Implement TESTIMONIUM Parishioner Mobile Phase 2.

Repository root:
C:\Users\me\Documents\testimonium

Mobile app:
C:\Users\me\Documents\testimonium\testimonium-parishioner-app

EXECUTION MODEL

Use Gemini 3.7 Flash High.

This is an IMPLEMENTATION task, not another planning task.

The architecture and scope have already been planned and reviewed.

Before changing code, read these two files IN FULL:

1. testimonium-parishioner-app/MOBILE_PHASE2_PLAN.md
   - original binding Phase 2 brief and constraints

2. testimonium-parishioner-app/MOBILE_PHASE2_IMPLEMENTATION_PLAN.md
   - audited Phase 2 implementation plan produced after repository/backend inspection

Treat them in this priority order:

1. actual current source code / backend behavior
2. MOBILE_PHASE2_PLAN.md scope and architectural constraints
3. MOBILE_PHASE2_IMPLEMENTATION_PLAN.md implementation blueprint
4. older documentation

If implementation-plan details conflict with current source, investigate and adapt rather than forcing stale assumptions.

Do not expand Phase 2 scope.

==================================================
GOAL
==================================================

Implement Phase 2:

MOBILE SHELL, HOME & PARISH DIRECTORY

Deliver:

- polished five-tab authenticated shell;
- Home;
- Parish directory;
- Parish detail;
- current-month public event previews;
- notification bell + Phase 6 placeholder destination;
- intentional minimal Requests, Schedule, and Profile shells;
- reusable authenticated-app UI foundation;
- loading, empty, retry, accessibility, and safe navigation behavior.

The authenticated side of the application currently works but intentionally looks rough.

Phase 2 should make the app feel like a coherent TESTIMONIUM mobile product rather than a Phase 0/1 scaffold.

==================================================
ABSOLUTE SCOPE BOUNDARIES
==================================================

DO NOT implement:

- document request creation/lifecycle;
- payment/receipt flow;
- scheduling workflow;
- notification inbox;
- notification read/unread mutations;
- notification polling;
- native push;
- event calendar;
- event-detail workflow;
- map;
- location permission;
- profile editing/settings expansion;
- RAG/chatbot;
- admin/staff functionality;
- production/staging deployment;
- iOS.

Those belong to later phases.

Requests, Schedule, and Profile remain visible tabs but must stay intentionally minimal.

==================================================
PHASE 0/1 BASELINE — DO NOT REGRESS
==================================================

The following physical Android runtime flows are already verified:

Email/password login       PASS
Google Sign-In             PASS
Google logout              PASS
Email/password logout      PASS
Backend bootstrap          PASS
Profile commit             PASS
AUTHENTICATED_READY        PASS

Preserve:

- Native Firebase authentication;
- Google Sign-In;
- AuthProvider state machine;
- Firebase/backend bootstrap separation;
- generation/UID stale-response protection;
- parishioner-only + ACTIVE role enforcement;
- protected Expo Router groups;
- centralized API client;
- Firebase bearer token injection;
- one forced token refresh / one 401 retry;
- normalized AppError handling;
- query cancellation + clearing during logout/account switching;
- existing safe navigation/back helper;
- existing dev diagnostics.

Do not rewrite auth.

Do not add screen-local auth redirects.

Do not reintroduce unconditional router.back() behavior.

Do not modify:

- Google OAuth configuration;
- google-services.json;
- Firebase console configuration;
- EAS credentials;
- Android signing;
- native Android project files.

==================================================
DEVELOPMENT WORKFLOW
==================================================

Current physical-device workflow is already working:

From repository root:

npm run dev:mobile

It automatically handles:

backend
→ Cloudflare Quick Tunnel
→ mobile API env
→ Metro dev-client

Do not redesign this launcher.

Normal Phase 2 changes must work through Metro/Fast Refresh with the currently installed Google-enabled development APK.

DO NOT RUN:

- eas build
- expo prebuild
- expo run:android
- gradlew
- Android Studio

No EAS build is expected for core Phase 2.

==================================================
PHASE 2A — AUTHENTICATED SHELL & UI FOUNDATION
==================================================

Implement the route architecture from the approved plan.

Target conceptual structure:

app/(app)/
  _layout.tsx
  notifications.tsx
  parishes/[parishId].tsx

  (tabs)/
    _layout.tsx

    (home)/
      index.tsx

    (requests)/
      index.tsx

    (schedule)/
      index.tsx

    (parishes)/
      index.tsx

    (profile)/
      index.tsx

Adapt exact filenames to existing Expo Router conventions if necessary.

The `(app)` protected group must remain the security/navigation boundary.

Use:

root Stack
    ↓
tab navigator
    ↓
top-level tab roots

Parish detail and notification shell should sit above the tab navigator.

Do not make detail routes permanent tabs.

--------------------------------
BOTTOM TABS
--------------------------------

Five tabs:

Home
Requests
Schedule
Parishes
Profile

Provide:

- appropriate icons;
- visible labels;
- selected/unselected state;
- canonical TESTIMONIUM crimson selected state;
- accessible selected state;
- >=44pt practical targets;
- safe-area-correct tab bar;
- keyboard hiding behavior where appropriate;
- visually polished light parishioner styling.

IMPORTANT:

Inspect package.json before adding any icon dependency.

If the currently installed Expo stack already provides the required icon package, reuse it.

Only add `@expo/vector-icons` explicitly if it is genuinely absent/required.

Do not add a native navigation dependency.

--------------------------------
AUTHENTICATED UI FOUNDATION
--------------------------------

Inspect existing components/tokens first.

Extend rather than rewrite.

Establish only the reusable primitives Phase 2 actually needs, such as:

- AppHeader
- Card / surface primitive
- IconButton
- SectionHeader
- loading skeletons
- InlineError / retry state
- EmptyState

Exact names may differ if existing conventions already cover them.

Do not create a massive design-system abstraction.

Keep existing auth screens compatible.

Canonical primary:

#7B1C2A

Do not resurrect stale older crimson values if current tokens already use the canonical primary.

Visual direction:

- warm/light;
- parishioner-first;
- ecclesiastical but modern;
- generous spacing;
- soft borders/cards;
- restrained shadows;
- clean typography;
- no admin-dashboard appearance;
- no fake parish imagery;
- no repeated TESTIMONIUM branding everywhere.

==================================================
PHASE 2B — PARISH API + DIRECTORY + DETAIL
==================================================

Use the centralized API client only.

Expected endpoints:

GET /api/v1/parishes
GET /api/v1/parishes/:id

Inspect CURRENT backend implementation before defining TypeScript DTOs.

Do not invent response fields.

--------------------------------
PARISH LIST API
--------------------------------

Expected pagination shape from audited implementation:

{
  items: ParishDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

Verify against current backend source.

Create typed parish API/query code.

Use TanStack Query.

Prefer the established feature-owned query-key pattern:

parishKeys.list({ search, type })
parishKeys.detail(parishId)

For paginated directory loading, use TanStack Query v5's established capabilities where appropriate.

`useInfiniteQuery` is acceptable if it cleanly matches the backend page/totalPages contract.

Do not install another state library.

--------------------------------
SEARCH
--------------------------------

Use backend-supported search.

Debounce input reasonably.

When search/type changes:

- reset pagination correctly;
- do not mix pages from previous filters;
- cancel/dedupe through TanStack Query;
- avoid firing requests for every keystroke unnecessarily.

The plan proposes labeling the field as parish/patron search.

Inspect backend behavior before finalizing copy.

Do NOT advertise municipality search unless the backend actually supports it.

--------------------------------
TYPE FILTER
--------------------------------

The plan identifies these user-facing values:

Parish
Quasi-Parish
Mission Station

IMPORTANT:

Verify the actual backend validator/query values.

Do not assume those exact display strings are also valid transport values.

If backend uses enum-like values such as:

PARISH
QUASI_PARISH
MISSION_STATION

then create an explicit mapping:

transport value ↔ user-facing label

Do not send UI labels blindly.

--------------------------------
PARISH CARDS
--------------------------------

Use only real backend data.

Suggested hierarchy:

- parish name;
- user-facing type;
- municipality/city;
- address;
- real cover image only if supplied.

Do not expose:

- database IDs;
- internal status;
- staff names;
- payment configuration;
- admin configuration;
- mutation metadata.

Whole card should be pressable.

Add useful TalkBack label.

Initial load:
→ skeletons

Refresh:
→ preserve existing content + refresh indicator

Search empty:
→ meaningful state + clear-search action

Directory empty:
→ distinct meaningful state

Failure:
→ normalized copy + retry

Pagination:
→ Load more / incremental loading only when totalPages indicates more results

--------------------------------
PARISH DETAIL
--------------------------------

Use:

GET /api/v1/parishes/:id

Render only populated safe fields confirmed in DTO.

Potential approved fields include:

- name;
- type;
- address;
- municipality/city;
- province;
- description;
- patron saint;
- feast day;
- cover/gallery imagery;
- structured office hours;
- contact number;
- email.

Do not invent a Mass Schedule section.

The audited backend does not provide a safe mass-schedule read model through this detail endpoint.

--------------------------------
EXTERNAL ACTIONS
--------------------------------

Where valid fields exist, support explicit:

Call
Email
Open in Maps

Use safe builders.

Use Linking.canOpenURL / Linking.openURL as appropriate.

Never auto-launch.

Encode values properly.

No device location permission is required.

Do not infer coordinates or addresses.

Do not expose dangerous or malformed schemes.

--------------------------------
DETAIL FAILURE
--------------------------------

403 / 404 / unavailable:

show safe resource-unavailable UI and a deterministic return-to-Parishes action.

Use the existing safe back helper/fallback strategy.

Do not blindly call router.back().

==================================================
PHASE 2C — EVENTS + HOME
==================================================

Expected endpoint:

GET /api/v1/parish-events/all?year=YYYY&month=M

Audit source first.

Expected public DTO:

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
  parish?: {
    id: number;
    parishName: string;
  };
}

Do not use:

GET /parish-events/:parishId

for parishioner discovery.

The audited plan found it is staff/tenant guarded.

For parish detail:

reuse the public monthly `/all` query and filter its returned data client-side by parishId.

This should allow Home and Parish Detail to share the same TanStack Query cache.

--------------------------------
EVENT QUERY
--------------------------------

Suggested key:

eventKeys.month({ year, month })

Use current local calendar month.

No polling.

Suggested stale time:

5 minutes

Do not persist query cache to device storage.

--------------------------------
DATE/TIME SAFETY
--------------------------------

`eventDate` is a calendar date.

Avoid accidental UTC day shifting.

Parse YYYY-MM-DD as a date-only/calendar value rather than `new Date(iso)` behavior that can move the displayed day.

Use one presentation utility.

Sort upcoming events deterministically:

calendar date
→ time where present
→ stable fallback

Home "Upcoming" should exclude earlier local-calendar dates.

Do not fabricate times.

If `startTime` is absent, omit it.

If `endTime` is absent, omit it.

Do not claim live/real-time status.

--------------------------------
HOME
--------------------------------

Implement a polished scrollable Home.

Use:

1. concise greeting using existing authenticated profile;
2. primary Explore Parishes entry;
3. Upcoming This Month;
4. up to three upcoming public events;
5. View Parish action where parish reference exists;
6. notification bell in header.

Home must NOT include:

- request summaries;
- payment summaries;
- appointment summaries;
- scheduling summaries;
- notification inbox content.

Phase 2 does not own those workflows.

If events fail:

Home greeting and parish discovery must remain usable.

Use section-local retry.

No-events state should be calm and intentional, not a broken empty rectangle.

==================================================
PHASE 2D — NOTIFICATION SHELL
==================================================

Implement Bell Only.

Do not query:

GET /notifications

Do not implement:

- unread count;
- inbox;
- mark read;
- polling;
- push;
- deep links.

Header bell:

accessible label similar to:

Notifications

It may indicate the feature is not yet available when appropriate, but avoid awkward overly technical copy in accessibility text.

Tap opens:

app/(app)/notifications.tsx

This is an intentional protected placeholder screen for Phase 6.

Keep the screen simple and polished.

Explain that notifications will be available there in a later app update/phase using user-facing copy, not engineering terminology.

Provide safe navigation back/Home.

Structure it so Phase 6 can replace the screen without redesigning header navigation.

==================================================
MINIMAL DEFERRED TABS
==================================================

REQUESTS

Keep visible.

Make it look intentional and finished.

Do NOT call request APIs.

Do NOT build creation/tracking/history.

Use concise user-facing copy indicating the feature is not yet available in the current mobile build.

Do not say "Phase 3" to users.

--------------------------------
SCHEDULE

Same principle.

Do not query slots/schedules.

Do not build booking.

Do not say "Phase 5" to users.

--------------------------------
PROFILE

Profile may be more useful because Phase 1 already provides authenticated profile state and logout.

Display only already-available identity/profile/session-safe fields.

Keep the existing logout capability.

Do not implement:

- profile editing;
- settings;
- password management expansion;
- legal/settings center.

Those remain later work.

==================================================
STATE / CACHE RULES
==================================================

TanStack Query remains the only server-state solution.

Suggested freshness:

Parish list/detail:
10 minutes

Events:
5 minutes

No interval polling.

Pull-to-refresh should refetch explicitly.

Do not persist discovery cache across application installs/sessions using a new persistence layer.

Do not duplicate server responses into React Context.

Preserve logout behavior:

await queryClient.cancelQueries()
queryClient.clear()

Do not introduce another user-specific cache.

==================================================
LOADING / ERROR / OFFLINE
==================================================

Initial lists:
→ skeletons

Background refresh:
→ preserve current data

Section failure:
→ local retry where possible

Offline after previously loaded discovery data:
→ stale content may remain visible
→ indicate refresh unavailable appropriately

Do not add persistent offline storage.

Normalized errors must not expose internal traces.

Do not print bearer tokens.

==================================================
ACCESSIBILITY
==================================================

Implement and verify:

- >=44pt practical touch targets;
- accessible tab labels;
- selected-tab accessibility state;
- accessible bell;
- accessible parish cards;
- accessible external action buttons;
- decorative images excluded from accessibility;
- scalable text;
- no fixed-height text clipping;
- multiline parish/event titles;
- readable line height;
- safe areas;
- large-font resilient card layouts.

Target device-font testing in final user verification:

130–200%

Do not encode meaning by color alone.

==================================================
SECURITY / DOMAIN RULES
==================================================

Mobile remains PARISHIONER-only.

Parishioners are NOT tied to a home parish.

Do not create:

homeParishId
preferredParish
automatic tenant scope
"your parish" assumptions

Do not expose staff/admin actions.

Do not use a route parameter as authorization proof.

Backend response is authoritative.

403/404 remain safe unavailable states.

No staff mutation endpoints.

No request/schedule/payment mutation endpoints.

No token logging.

==================================================
MAP
==================================================

DEFER.

Do not install react-native-maps.

Do not add native map dependencies.

Do not request location permission.

The directory/list/detail experience must stand on its own.

==================================================
FILE PLAN
==================================================

Use MOBILE_PHASE2_IMPLEMENTATION_PLAN.md as the primary blueprint.

Expected create/modify areas include:

app/(app)/
app/(app)/(tabs)/
src/features/home/
src/features/parishes/
src/features/events/
src/features/notifications/
src/components/ui/
src/theme/

Do not mechanically create a file just because the plan listed it if existing repo organization provides a cleaner equivalent.

Keep the implementation small and coherent.

Do not create hundreds of tiny abstraction files.

==================================================
EXECUTION ORDER
==================================================

Implement sequentially:

PHASE 2A
Shell + shared UI

Then validate.

PHASE 2B
Parish directory + detail

Then validate.

PHASE 2C
Home + events

Then validate.

PHASE 2D
Notification shell

Then validate.

PHASE 2E
Accessibility + regression + cleanup

Do not stop after each checkpoint asking me for permission unless a genuine architectural/backend blocker is discovered.

Proceed through 2A–2E in one execution session.

However, keep the implementation logically staged so regressions are easy to locate.

==================================================
TESTS
==================================================

Add focused automated coverage for:

- Parish DTO normalization;
- optional fields;
- parish type display mapping;
- backend filter/query parameters;
- pagination;
- query keys;
- current-month parameter generation;
- event date-only parsing;
- event sorting;
- upcoming filtering;
- missing times;
- timezone-safe rendering;
- external-link builders;
- missing-data suppression;
- loading states;
- empty states;
- error states;
- unavailable parish detail;
- safe route fallback;
- notification bell navigation;
- tab labels/accessibility;
- AUTHENTICATED_READY tab-shell gating;
- logout/account-switch query clearing regression.

Where practical, assert Phase 2 feature APIs never invoke:

- staff mutations;
- request workflows;
- schedule workflows;
- payment workflows.

Do not create brittle snapshot-heavy tests just to increase coverage.

==================================================
VALIDATION
==================================================

Run from the mobile app as appropriate:

npm run typecheck

npm test -- --runInBand

npm run lint

npx expo export --platform android

git diff --check

`npx expo export --platform android` is permitted.

It is only a JS bundle/static Expo validation.

It is NOT a native Gradle/EAS build.

Do NOT run an EAS build.

Do NOT run prebuild.

Also inspect:

git status --short

before and after.

Do not use destructive Git commands.

NEVER run:

git reset --hard
git clean -fd
git checkout .
git restore .

Do not discard unrelated user work.

==================================================
DEVICE TESTING
==================================================

Do not mark physical Android cases PASS yourself unless you actually have interactive access to the device.

After implementation, provide me a concise manual device test checklist covering:

- app session restore;
- Google login/logout regression;
- email login/logout regression;
- five tabs;
- tab styling/safe area;
- Home;
- event preview;
- parish list;
- search;
- filter;
- pagination;
- pull-to-refresh;
- parish detail;
- external actions;
- missing resource state;
- bell shell;
- Android back;
- font scaling;
- account-switch cache safety.

The human user will perform these tests.

==================================================
DOCUMENTATION
==================================================

After code is implemented, update the existing mobile docs that are materially changed, including as applicable:

05_MOBILE_NAVIGATION_AND_SCREEN_MAP.md
08_MOBILE_STATE_DATA_OFFLINE.md
10_MOBILE_NOTIFICATIONS_DEEPLINKING.md
13_MOBILE_IMPLEMENTATION_ROADMAP.md
15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md

Do not rewrite unrelated historical documentation.

Mark Phase 2 as complete only for statically/automatically verified implementation.

Keep physical Android runtime verification separately marked PENDING until the user tests it.

==================================================
NATIVE / DEPENDENCY RULE
==================================================

The expected result requires NO new EAS build.

If you discover a proposed package is actually native/config-plugin-dependent:

STOP before adding it.

Explain:

- why it is needed;
- why current JS/Expo dependencies cannot solve it;
- whether it would require a new dev build.

Do not silently introduce native impact.

==================================================
FINAL QUALITY PASS
==================================================

Before finishing:

Inspect the authenticated UI holistically.

Do not leave Phase 2 looking like disconnected demo screens.

Ensure consistency across:

- spacing;
- typography;
- cards;
- headers;
- icon buttons;
- empty/error states;
- tab bar;
- parish cards;
- event cards;
- placeholder shells.

Avoid excessive decoration.

The goal is:

clean
modern
warm
ecclesiastical
mobile-native
parishioner-facing

not:

admin dashboard squeezed onto a phone.

==================================================
FINAL REPORT
==================================================

Return:

# TESTIMONIUM Mobile Phase 2 — Implementation Report

## 1. Summary

## 2. Phase 2A — Shell & Shared UI
- implementation
- routes
- navigation behavior

## 3. Phase 2B — Parish Directory & Detail
- API contract used
- filtering
- pagination
- detail
- external links

## 4. Phase 2C — Home & Events
- API
- presentation/date handling
- Home composition

## 5. Phase 2D — Notification Shell

## 6. Deferred Tab Behavior
- Requests
- Schedule
- Profile

## 7. State / TanStack Query

## 8. Accessibility

## 9. Security / Role Boundary

## 10. Files Created

## 11. Files Modified

## 12. Dependencies
State whether anything was added and why.

## 13. Automated Tests Added

## 14. Validation Results
Include exact results for:
- typecheck
- tests
- lint
- Expo Android export
- diff check

## 15. Native/EAS Impact
Explicitly confirm whether native config changed.

## 16. Documentation Updated

## 17. Manual Physical Android Test Checklist

## 18. Known Limitations / Deferred Work

## 19. Final Phase 2 Status
Separate:
- IMPLEMENTATION COMPLETE
- STATIC VERIFICATION
- PHYSICAL DEVICE VERIFICATION PENDING

Implement Phase 2 now.
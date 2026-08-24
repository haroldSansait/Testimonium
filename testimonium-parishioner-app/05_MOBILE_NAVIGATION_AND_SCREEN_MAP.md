# TESTIMONIUM Parishioner Mobile — Navigation & Screen Map

**Last reconciled:** 24 August 2026
**Status:** Full navigation hierarchy implemented with Expo Router SDK 57.

## 1. Information architecture overview

The application organizes parishioner tasks into a deterministic navigation hierarchy with an unauthenticated `(auth)` group, compliance-driven `(onboarding)` gate, and a root stack for `(app)` containing a 5-tab navigator alongside modal/drill-down destinations.

```text
Root Layout (app/_layout.tsx)
  │
  ├──> (auth)/                   # Unauthenticated flow
  │     ├── welcome.tsx
  │     ├── login.tsx
  │     ├── register.tsx
  │     └── forgot-password.tsx
  │
  ├──> (onboarding)/             # Auth verification & profile completion gates
  │     ├── verify-email.tsx
  │     ├── legal.tsx
  │     └── profile-completion.tsx
  │
  └──> (app)/                    # Authenticated parishioner experience
        ├── _layout.tsx          # Root Stack (headerShown: false)
        │
        ├── (tabs)/              # 5-Tab Bottom Navigator
        │     ├── (home)/index.tsx       # Home Screen
        │     ├── (requests)/index.tsx   # Request List Screen
        │     ├── (schedule)/index.tsx   # Schedule List Screen
        │     ├── (parishes)/index.tsx   # Parish Directory Screen
        │     └── (profile)/index.tsx    # Profile Screen
        │
        ├── parishes/[parishId].tsx      # Parish Details
        ├── requests/
        │     ├── new.tsx                # 5-Step Document Request Wizard
        │     └── [requestId]/
        │           ├── index.tsx        # Request Detail & Timeline
        │           └── payment.tsx      # Payment & Receipt Upload
        ├── schedule/
        │     ├── new.tsx                # 5-Step Scheduling Wizard
        │     └── [id].tsx               # Schedule Detail & Reschedule Response
        ├── events/
        │     ├── index.tsx              # Public Events Calendar List
        │     └── [id].tsx               # Event Details
        ├── notifications.tsx            # In-App Notifications Inbox
        └── profile/
              ├── edit.tsx               # Edit Profile Form
              ├── settings.tsx           # App Settings & Sign-Out
              ├── terms.tsx              # Terms of Service Viewer
              └── privacy.tsx            # Privacy Policy Viewer
```

## 2. Tab navigation behavior

The 5-tab bottom navigator provides immediate access to the primary parishioner features:

| Tab | Route | Active Icon | Inactive Icon | Feature Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Home** | `/(app)/(tabs)/(home)` | `home` | `home-outline` | Welcome banner, quick actions, active tracking summary, event previews. |
| **Requests** | `/(app)/(tabs)/(requests)` | `document-text` | `document-text-outline` | Document requests list, status filtering, new request trigger. |
| **Schedule** | `/(app)/(tabs)/(schedule)` | `calendar` | `calendar-outline` | Upcoming and past appointments, slot booking trigger. |
| **Parishes** | `/(app)/(tabs)/(parishes)` | `business` | `business-outline` | Searchable directory of parishes, contact directory, and mass info. |
| **Profile** | `/(app)/(tabs)/(profile)` | `person` | `person-outline` | Parishioner details, verification status, settings entry. |

## 3. Drill-down and modal flows

All multi-step wizards, detail views, and sub-flows sit above the bottom tab bar inside the `(app)` Stack navigator:

1. **Document Request Flow:**
   `Requests Tab` → `requests/new` (Wizard) → `requests/[requestId]` (Detail) → `requests/[requestId]/payment` (Receipt Upload)
2. **Scheduling Flow:**
   `Schedule Tab` → `schedule/new` (Wizard) → `schedule/[id]` (Detail & Reschedule Response)
3. **Parish Discovery Flow:**
   `Parishes Tab` or `Home` → `parishes/[parishId]` (Detail) → Quick actions for documents or scheduling
4. **Events Flow:**
   `Home` or `Parish Detail` → `events/index` (Full calendar) → `events/[id]` (Event Details)
5. **Notifications Flow:**
   `AppHeader` Bell icon → `notifications` (Inbox) → Deep-link to referenced request or schedule

## 4. Back navigation and tab fallbacks

To ensure predictable back navigation across Android hardware back presses and iOS swipe gestures, modal and stack screens utilize `navigateBackOrReplace` (`src/utils/navigation.ts`). When the stack history is empty (e.g. following a direct deep link), back actions safely resolve to their canonical tab-root fallbacks:

- `parishes/[parishId]` → `/(app)/(tabs)/(parishes)`
- `requests/*` → `/(app)/(tabs)/(requests)`
- `schedule/*` → `/(app)/(tabs)/(schedule)`
- `events/*` → `/(app)/(tabs)/(home)`
- `notifications` → `/(app)/(tabs)/(home)`
- `profile/*` → `/(app)/(tabs)/(profile)`

## 5. Deep linking scheme

The application supports deep links configured in `app.config.ts` (`scheme: "testimonium"`):

- `testimonium://requests/:id` → Opens document request detail
- `testimonium://requests/:id/payment` → Opens payment screen
- `testimonium://schedule/:id` → Opens schedule detail
- `testimonium://parishes/:id` → Opens parish detail
- `testimonium://events/:id` → Opens event detail
- `testimonium://notifications` → Opens notifications inbox

When a deep link is received while the user is logged out, the intended target is preserved in memory and navigated after successful authentication.

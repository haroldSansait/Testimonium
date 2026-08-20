# TESTIMONIUM Parishioner Mobile — Navigation & Screen Map

## 1. Navigation goals

The user should be able to answer these questions within one or two taps:

- What needs my attention?
- Where is my request?
- How do I request a document?
- How do I schedule a service?
- Which parish should I contact?
- What events are upcoming?
- What notifications are unread?
- How do I update my profile?

## 2. Recommended top-level navigation

Recommended five-tab model:

```text
Home
Requests
Schedule
Parishes
Profile
```

Notifications should be reachable from a top-bar bell and deep links rather than consuming a permanent tab unless later usage data proves otherwise.

Events can appear:
- on Home;
- inside Parishes;
- in a calendar/event screen pushed from Home.

## 3. Auth route group

```text
/auth
  welcome
  login
  register
  verify-email
  legal
  profile-completion
  forgot-password (if currently supported)
```

Do not let authenticated app tabs render before backend profile bootstrap is resolved.

## 4. App route group

### Home
```text
/home
/home/notifications
/home/event/:eventId
```

### Requests
```text
/requests
/requests/new
/requests/new/parish
/requests/new/document-type
/requests/new/requirements
/requests/new/details
/requests/new/attachments
/requests/new/review
/requests/:requestId
/requests/:requestId/payment
/requests/:requestId/receipt
/requests/:requestId/corrections
/requests/:requestId/history
```

Route granularity may be implemented as nested steps or one stateful flow depending on actual navigation library. Preserve conceptual boundaries even if URLs differ.

### Schedule
```text
/schedule
/schedule/new
/schedule/new/parish
/schedule/new/type
/schedule/new/date
/schedule/new/slot
/schedule/new/review
/schedule/:scheduleId
/schedule/:scheduleId/reschedule-response
```

### Parishes
```text
/parishes
/parishes/map
/parishes/:parishId
/parishes/:parishId/events
```

### Profile
```text
/profile
/profile/edit
/profile/legal
/profile/session
```

## 5. Tab reset behavior

When a user taps the active tab again:
- optionally pop to that tab's root if supported;
- do not discard an active unsaved transactional form without confirmation.

## 6. Auth gating

Navigation gate order should be deterministic.

Conceptually:

```text
No Firebase user
-> Auth routes

Firebase user but email verification required
-> Verify Email

Firebase user + backend profile says incomplete
-> Profile Completion

Legal acceptance required
-> Legal flow

Ready
-> Main tabs
```

Exact precedence should match existing backend/web policy after code audit.

## 7. Deep-link target model

Prepare stable internal route helpers for:

```ts
toRequest(id)
toSchedule(id)
toParish(id)
toEvent(id)
toNotifications()
```

This creates a clean future path for push notifications without requiring push implementation now.

## 8. Notification routing

Current notification references can be:
- `DOCUMENT_REQUEST`
- `SCHEDULE_REQUEST`
- `GENERAL`

Recommended:
- DOCUMENT_REQUEST → request detail if accessible.
- SCHEDULE_REQUEST → schedule detail if accessible.
- GENERAL → notification detail/list unless explicit safe target exists.

If referenced resource is unavailable:
- show a graceful "This item is no longer available" state;
- do not crash or loop.

## 9. Back behavior

Android hardware back:
- close sheet/modal first;
- pop stack second;
- if at tab root, follow normal app exit behavior;
- protect unsaved forms.

Never intercept Back globally in a way that traps the user.

## 10. Auth/logout navigation

On logout:
1. cancel/ignore protected queries;
2. clear protected caches/state;
3. sign out Firebase according to chosen auth architecture;
4. reset navigation to auth root.

Do not leave authenticated screens in back stack.

## 11. Request creation UX

Recommended flow:

```text
Requests
-> New Request
-> Select Parish
-> Select Document
-> Requirements
-> Applicant/Request Details
-> Attachments
-> Review
-> Create/Submit according to backend draft flow
-> Request Detail
```

Important: match actual backend draft creation semantics. If a draft must exist before attachment upload, create it at the correct step and retain its server ID.

Do not create multiple drafts when navigating backward/forward.

## 12. Payment flow

```text
Request Detail
-> Payment Required banner/action
-> Payment Instructions
-> QR enlarge
-> Capture/Select Receipt
-> Review File
-> Upload
-> Under Review state
```

After upload:
- route to request detail or payment result;
- refetch authoritative request/payment state.

## 13. Schedule flow

```text
Schedule
-> New Schedule Request
-> Parish
-> Service/Event Type
-> Date
-> Available Slots
-> Details/Location if required
-> Review
-> Submit
-> Schedule Detail
```

When slot conflict occurs at submission:
- do not keep user on a false success screen;
- refetch slots and return to selection with explanation.

## 14. Parish discovery

List first, map optional.

Filters may include only data already available from backend.

Potential hierarchy:
- search;
- municipality/filter;
- parish cards;
- map toggle;
- detail.

No coordinator-only "edit map" or map-config endpoints.

## 15. Screen transition rules

Use stack push for:
- details;
- secondary flows.

Use replace/reset for:
- completed auth onboarding;
- logout;
- expired session requiring reauth.

Do not use replace for normal drill-down because it breaks expected back navigation.

## 16. Unsaved-change protection

Protect:
- request detail form;
- schedule form;
- profile edits where loss is meaningful.

Do not prompt for trivial filter/search state.

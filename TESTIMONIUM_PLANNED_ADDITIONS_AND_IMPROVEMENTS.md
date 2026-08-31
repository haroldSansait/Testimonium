# TESTIMONIUM — Planned Additions & Improvements

**Document Type:** Feature Planning / Enhancement Specification  
**Scope:** Backend, Admin Portal, Parishioner Web, Parishioner Mobile  
**Status:** Proposed — for review before implementation

---

# 1. Overview

This document defines the next planned improvements for TESTIMONIUM:

1. Parish-level scheduling availability rules for days and dates.
2. Default Sunday restrictions for Marriage, Marriage (Special), and Funeral.
3. Public vs Parish/Private visibility for parish events.
4. A Reports feature for Secretaries and Diocese Coordinators.
5. Responsive Admin Portal layouts for tablet and mobile-sized screens.
6. Expanded descriptive analytics with more graphs and operational data.
7. Email notifications for important document and scheduling transitions.
8. A Help/Guide feature for parishioners on Web and Mobile.

These additions should extend the current system without creating parallel business rules in the frontend.

---

# 2. Architecture Rules

TESTIMONIUM should continue to follow this authority order:

```text
Backend / Database
        ↓
Business-rule authority

Admin Portal
        ↓
Configuration and staff-management authority

Parishioner Web + Mobile
        ↓
Presentation of authoritative backend data
```

The backend must remain authoritative for:

- scheduling eligibility
- available/unavailable days
- available/unavailable dates
- services offered
- event visibility
- report access and ownership
- analytics scope
- notification triggers

Frontend clients should display these rules, not independently invent them.

---

# 3. Scheduling Availability Settings

## 3.1 Goal

Add Parish Settings that allow each parish to configure scheduling availability by:

- day of the week
- specific date
- scheduling service
- temporary exceptions

The configuration must be consumed consistently by:

- Admin Portal
- Parishioner Web
- Parishioner Mobile
- Backend scheduling validation

---

## 3.2 Default Sunday Restriction

The initial rule requested is:

| Scheduling Service | Sunday |
|---|---|
| Marriage | Not Available |
| Marriage (Special) | Not Available |
| Funeral | Not Available |

Canonical backend types should remain:

```text
WEDDING
MARRIAGE_SPECIAL
FUNERAL
```

User-facing labels should continue to use the established TESTIMONIUM terminology.

---

## 3.3 Parish Settings UI

Add a Scheduling Availability area under Parish Settings.

Suggested structure:

```text
Parish Settings
└── Scheduling
    ├── Services Offered
    ├── Time Slots
    ├── Capacity
    ├── Availability Days
    └── Date Exceptions
```

### Availability Days

Staff should be able to enable or disable days using switches or checkboxes.

Example:

| Day | General Availability |
|---|---|
| Monday | Available |
| Tuesday | Available |
| Wednesday | Available |
| Thursday | Available |
| Friday | Available |
| Saturday | Available |
| Sunday | Configurable / Service-specific |

Avoid free-text input for weekday configuration.

---

## 3.4 Service-Specific Day Availability

The system should support service-specific weekday rules.

Example:

| Service | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---:|---:|---:|---:|---:|---:|---:|
| Marriage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✕ |
| Marriage (Special) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✕ |
| Funeral | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✕ |
| Baptism | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Configurable |

The backend must revalidate these rules when a scheduling request is created.

---

## 3.5 Specific Date Exceptions

Parish staff should also be able to define exceptions for individual dates.

### Unavailable Date Example

```text
Date: December 25, 2026
Type: Unavailable
Reason: Christmas Day

Applies To:
[x] All scheduling services
[ ] Selected services only
```

### Available Override Example

```text
Date: December 27, 2026
Type: Available Override
Reason: Special parish scheduling day

Applies To:
[ ] All services
[x] Marriage
[x] Baptism
```

Suggested fields:

- date
- availability type
- reason/note
- all services vs selected services
- created by
- created at
- updated at

---

## 3.6 Rule Priority

Recommended rule evaluation:

```text
1. Is scheduling enabled for the parish?
2. Is the service offered?
3. Is there a specific-date exception?
4. Does the service allow that weekday?
5. Does the parish generally allow that weekday?
6. Is the selected time slot configured?
7. Is capacity available?
8. Is there a scheduling conflict?
```

A date-specific exception should normally override the weekly rule.

However, one decision must be made before implementation:

> Should Marriage, Marriage (Special), and Funeral be absolutely forbidden on Sundays, or may an authorized parish create a specific Sunday override?

If Sunday restrictions are absolute, the backend must enforce them as non-overridable rules.

---

## 3.7 Parishioner Web and Mobile

The parishioner scheduling calendar should:

- fetch valid dates from the backend
- disable dates not returned as eligible
- avoid calculating authoritative availability on the client
- refresh scheduling configuration when the workflow is opened
- refresh after stale-state or conflict responses

If a staff member changes availability while a parishioner is already inside the wizard, the backend must still reject a now-invalid submission.

---

# 4. Parish / Public Event Visibility

## 4.1 Goal

Allow staff-created parish events to be categorized as either:

```text
PUBLIC
PARISH_PRIVATE
```

### Public Event

Visible to:

- Parishioner Web event banner/feed
- Parishioner Mobile events
- Parish detail upcoming events
- authorized staff

### Parish / Private Event

Visible to:

- authorized parish staff
- Diocese Coordinator where permitted
- Admin calendar/internal views

Not visible to parishioners.

---

## 4.2 Admin Event Form

Add a visibility selector when creating or editing an event:

```text
Event Visibility

(•) Public Event
    Visible to parishioners on Web and Mobile.

( ) Parish / Private Event
    Internal parish event. Not shown to parishioners.
```

Existing event fields such as title, date, time, location, description, and parish should remain intact.

---

## 4.3 Backend Enforcement

Public visibility must be enforced by the backend.

Parishioner-facing event endpoints must return only public events.

Do not rely only on frontend filtering because private events should not be exposed to parishioner clients at all.

---

## 4.4 Existing Events

Before implementation, decide how existing events will be classified after introducing visibility.

Possible approaches:

- Existing parishioner-facing events become `PUBLIC`.
- Existing events inherit visibility based on current publication behavior.

This must be decided before migration.

---

# 5. Reports Feature

## 5.1 Goal

Add a Reports feature where authorized staff can record notable events that happened on a specific day.

Examples:

- meetings
- parish activities
- diocesan activities
- outreach programs
- important incidents
- significant parish events
- notable accomplishments
- operational notes

Reports are intentionally written records and are different from automatic Activity Logs.

### Activity Log

```text
Automatically generated by the system
Example:
"Payment Verified"
"Schedule Updated"
```

### Report

```text
Manually created by an authorized staff member
Example:
"Pastoral council meeting held on August 28."
```

---

## 5.2 Roles

Required by the current request:

| Role | Create | View |
|---|---:|---:|
| SECRETARY | Yes | Parish scope |
| DIOCESE_COORDINATOR | Yes | Cross-parish |

Priest access should be decided separately.

Parishioners should not have access to administrative reports.

---

## 5.3 Suggested Report Fields

```text
Report ID
Report Date
Title
Category
Description
Parish
Created By
Created At
Updated At
```

Possible categories:

```text
MEETING
ACTIVITY
IMPORTANT_EVENT
OTHER
```

These categories should remain proposals until confirmed.

---

## 5.4 Create Report UI

Example:

```text
Create Report

Date:
[ August 29, 2026 ]

Category:
[ Meeting ▼ ]

Title:
[ __________________________ ]

Description:
[ __________________________ ]
[ __________________________ ]
[ __________________________ ]

Parish:
[ Current Parish / Select Parish ]

[ Save Report ]
```

For a Secretary:

- parish should normally come from the authenticated staff scope

For a Diocese Coordinator:

- parish may be selected
- a future "Diocese-wide" option may be allowed if required

---

## 5.5 Reports List

Suggested filters:

- date range
- parish
- category
- author
- keyword

Example:

```text
Reports

[ Search ]

Date Range: [ Aug 1 ] - [ Aug 31 ]
Parish: [ All Parishes ▼ ]
Category: [ All ▼ ]

---------------------------------------
Aug 28, 2026
Pastoral Council Meeting
Meeting • St. Joseph Parish
Created by Secretary Maria
---------------------------------------
```

---

## 5.6 Optional Calendar Integration

Reports may optionally appear as indicators on the Admin calendar.

Example:

```text
August 28
• Marriage Schedule
• Parish Meeting
• 1 Daily Report
```

Reports should remain separate from scheduling events.

---

# 6. Responsive Admin Portal

## 6.1 Goal

Make the Admin Portal usable across:

```text
Desktop
Laptop
Tablet
Mobile-width browser
```

The Admin Portal should remain desktop-focused, but core actions should still work on smaller screens.

---

## 6.2 Responsive Audit Areas

Review:

- sidebar
- top navigation
- dashboards
- tables
- forms
- calendars
- charts
- modals
- parish settings
- document request review
- payment review
- scheduling
- user management
- activity logs
- analytics
- map configuration

---

## 6.3 Navigation Behavior

### Desktop

```text
Persistent sidebar
```

### Tablet / Mobile

```text
Collapsed sidebar
or
hamburger navigation drawer
```

Role-based navigation must remain intact.

---

## 6.4 Tables

Large tables should not simply shrink until unreadable.

Use:

- horizontal scrolling
- responsive hidden columns
- expandable rows
- card layouts on small screens where appropriate

Critical actions must remain reachable.

---

## 6.5 Forms and Modals

Desktop:

```text
Multi-column forms where appropriate
```

Mobile:

```text
Single-column forms
Full-width controls
Scrollable modal content
Touch-friendly buttons
```

Avoid:

- clipped modal buttons
- overlapping controls
- tiny icon-only actions
- off-screen submit buttons

---

# 7. Enhanced Descriptive Analytics

## 7.1 Goal

Expand analytics to provide more useful descriptive information.

The system should answer:

```text
What happened?
How many?
How often?
Where?
When?
Which category/status/parish had the most activity?
```

This should remain descriptive analytics, not predictive analytics.

---

## 7.2 Document Request Analytics

Possible metrics:

- total requests
- requests by document type
- requests by parish
- requests by status
- completed requests
- cancelled requests
- rejected requests
- average processing time
- monthly request trend
- most requested document types

---

## 7.3 Payment Analytics

Possible metrics:

- payment-required requests
- receipts submitted
- verified payments
- payment corrections
- rejected payments
- total verified payment value
- monthly payment trend
- payment volume by parish

---

## 7.4 Scheduling Analytics

Possible metrics:

- schedule requests submitted
- confirmed schedules
- cancelled/rejected schedules
- reschedule proposals
- requests by service/event type
- busiest scheduling days
- busiest months
- parish scheduling volume

---

## 7.5 Event Analytics

Possible metrics:

- public events created
- private parish events created
- events by parish
- events by event type
- monthly event volume

---

## 7.6 User Analytics

Where role permissions allow:

- registered parishioners
- active staff
- user growth over time
- role distribution

---

## 7.7 Recommended Graphs

Use charts only where they improve understanding.

Examples:

```text
Line Chart
→ monthly trends

Bar Chart
→ requests by document type

Horizontal Bar Chart
→ parish comparisons

Donut/Pie
→ small status distributions

Summary Cards
→ totals, averages, percentages
```

---

## 7.8 Analytics Filters

Suggested filters:

```text
Date Range
Parish
Document Type
Scheduling Service
Status
Event Type
```

Role scope remains mandatory:

```text
Secretary
→ own parish

Coordinator
→ cross-parish
```

Backend-generated aggregations are preferred over downloading large raw datasets and aggregating only in the frontend.

---

# 8. Email Notifications

## 8.1 Goal

Add email notifications for important parishioner workflow transitions.

Email should complement, not replace, existing in-app notifications.

---

# 9. Document Email Notification

## Ready for Pickup

Trigger when a document request reaches:

```text
READY_FOR_PICKUP
```

Suggested subject:

```text
TESTIMONIUM — Your Document Is Ready for Pickup
```

Suggested content:

```text
Hello [Name],

Your requested document is now ready for pickup.

Tracking Number: [Tracking Number]
Document: [Document Type]
Parish: [Parish Name]

Please follow the parish's pickup instructions.

— TESTIMONIUM
```

Do not attach sensitive uploaded files or document contents.

---

# 10. Scheduling Email Notifications

## 10.1 Awaiting Confirmation

After the parishioner submits a scheduling request, send an email informing them that it is awaiting parish confirmation/review.

Suggested subject:

```text
TESTIMONIUM — Schedule Request Submitted
```

Suggested message:

```text
Your scheduling request has been submitted and is awaiting parish confirmation.
```

Final wording should match the established schedule status terminology.

---

## 10.2 Proposed Rescheduling

Trigger when the Secretary proposes another date/time.

Suggested subject:

```text
TESTIMONIUM — New Schedule Proposed
```

Include:

- scheduling service
- parish
- proposed date
- proposed time
- instruction to sign in and Accept or Decline

Recommended workflow:

```text
Email
→ informs parishioner
→ parishioner opens TESTIMONIUM
→ accepts/declines while authenticated
```

Avoid direct accept/decline links unless a secure signed-action system is intentionally designed.

---

## 10.3 Confirmed Schedule

Trigger when the schedule becomes confirmed.

Suggested subject:

```text
TESTIMONIUM — Schedule Confirmed
```

Include:

- service
- date
- time
- parish
- venue/location when available

---

# 11. Email Notification Architecture

Recommended flow:

```text
Business state changes
        ↓
Database commit succeeds
        ↓
In-app notification created
        ↓
Email delivery requested
        ↓
Email provider sends
        ↓
Delivery result logged
```

Email failure must not roll back the actual workflow state.

Example:

```text
Document becomes READY_FOR_PICKUP
        ↓
Database update succeeds
        ↓
Email provider fails temporarily
        ↓
Document remains READY_FOR_PICKUP
```

---

## 11.1 Duplicate Protection

Email should not be sent twice because of:

- API retries
- staff double-clicks
- page refreshes
- repeated identical requests

Recommended deduplication concept:

```text
resource + transition + notification type
```

---

## 11.2 Delivery Logging

Recommended data:

- recipient
- email type
- related resource ID
- queued at
- sent at
- status
- failure reason
- retry count

Do not log:

- passwords
- Firebase tokens
- private uploaded files
- R2 credentials

---

# 12. System Help Feature

## 12.1 Goal

Add simple user guidance to:

- Parishioner Web
- Parishioner Mobile

The feature should help parishioners understand the system without requiring staff assistance for basic navigation.

---

## 12.2 Help Entry Points

### Web

Possible locations:

```text
Main navigation
→ Help

Profile menu
→ Help & Guide
```

### Mobile

Suggested location:

```text
Profile
→ Help & Guide
```

Optional contextual `?` links may appear in complex workflows.

---

## 12.3 Help Categories

### Getting Started

- creating an account
- email verification
- signing in
- completing profile information

### Document Requests

- requesting a document
- selecting a parish
- uploading requirements
- tracking a request
- correcting requirements
- submitting payment receipt
- understanding Ready for Pickup

### Scheduling

- selecting parish
- selecting service
- choosing date
- choosing time
- awaiting confirmation
- proposed rescheduling
- Accept/Decline
- confirmed schedule

### Parish Directory

- finding a parish
- office hours
- contact information
- directions

### Events

- viewing upcoming public events
- understanding that internal parish events are not public

### Notifications

- in-app notifications
- email notifications
- what common notification states mean

### Account

- editing profile
- settings
- signing out

---

## 12.4 Help Content Style

Help content should be:

- simple
- concise
- non-technical
- step-by-step
- consistent across Web and Mobile

Avoid developer terms such as:

```text
API
DTO
query cache
mutation
Firebase token
backend endpoint
```

---

# 13. Possible Domain / Database Additions

Exact Prisma changes should be designed only after auditing the existing models.

Potential additions include:

## 13.1 Scheduling Date Exception

Possible entity:

```text
ParishScheduleDateException
```

Potential fields:

```text
id
parishId
date
availabilityType
reason
appliesToAllServices
createdBy
createdAt
updatedAt
```

If selected services are supported, a service mapping may also be required.

Weekly availability should preferably extend the existing scheduling configuration instead of creating a duplicate settings system.

---

## 13.2 Event Visibility

Potential field:

```text
visibility
```

Potential values:

```text
PUBLIC
PARISH_PRIVATE
```

---

## 13.3 Reports

Potential entity:

```text
DailyReport
```

Possible fields:

```text
id
reportDate
title
category
description
parishId
createdByUserId
createdAt
updatedAt
```

---

## 13.4 Email Delivery

Possible implementation:

```text
EmailNotificationLog
```

or integration with an existing notification/outbox structure.

Do not add a new table if the existing architecture can support reliable delivery safely.

---

# 14. Role / Permission Matrix

| Feature | Parishioner | Secretary | Priest | Coordinator |
|---|---:|---:|---:|---:|
| View public events | Yes | Yes | Yes | Yes |
| View private parish events | No | Parish scope | Parish scope | Cross-parish |
| Change event visibility | No | Parish scope | Decision | Policy-defined |
| Configure scheduling availability | No | Parish scope | Decision | Policy-defined |
| Create reports | No | Yes | Decision | Yes |
| View reports | No | Parish scope | Decision | Cross-parish |
| Parish analytics | No | Yes | Where authorized | Yes |
| Diocese-wide analytics | No | No | No | Yes |
| Parishioner email notifications | Receive | N/A | N/A | N/A |
| Help feature | Yes | Optional | Optional | Optional |

Any Priest permissions marked **Decision** must be resolved before implementation.

---

# 15. Suggested Admin Navigation

Possible future structure:

```text
Dashboard

Document Requests
Scheduling
Calendar
Events
Reports          ← NEW

Parish Management
├── Parish Information
├── Scheduling Settings
├── Availability Days / Dates   ← NEW
├── Event Settings              ← NEW
└── Payment Settings

Analytics       ← ENHANCED
Activity Logs

Users / Staff
Settings
```

Actual visibility must remain role-aware.

---

# 16. Cross-Client Behavior

## Scheduling Settings

```text
Admin changes scheduling availability
        ↓
Backend saves rule
        ↓
Web refreshes authoritative availability
        ↓
Mobile refreshes authoritative availability
```

## Event Visibility

```text
Admin marks event PUBLIC
        ↓
Public event API includes event
        ↓
Web displays event
        ↓
Mobile displays event
```

```text
Admin marks event PARISH_PRIVATE
        ↓
Public event API excludes event
        ↓
Web does not display event
        ↓
Mobile does not display event
```

## Email

```text
Staff changes workflow status
        ↓
Backend commits status
        ↓
In-app notification created
        ↓
Email notification sent
```

---

# 17. Audit Logging

Important staff changes should be auditable.

Recommended actions:

- scheduling availability changed
- date exception created
- date exception updated
- date exception removed
- event visibility changed
- report created
- report updated
- report removed/archived
- email delivery failure/retry where useful

Logs should preserve:

- actor
- action
- target
- timestamp
- parish context

---

# 18. Validation and Error Handling

## Scheduling

Backend should reject:

- unavailable date
- unavailable weekday
- unsupported service
- invalid slot
- exceeded capacity
- conflicting schedule

Parishioner-facing copy should remain simple, for example:

```text
This date is no longer available. Please select another date.
```

---

## Events

Backend should reject:

- invalid visibility
- unauthorized visibility changes
- parish-scoped staff modifying another parish's events

---

## Reports

Validate:

- report date
- title
- description
- parish scope
- valid category if fixed categories are adopted

---

## Email

Email delivery failures should:

- be logged
- be retryable
- never corrupt or roll back workflow state

---

# 19. Testing Requirements

## Scheduling Availability

Test:

- default Sunday restriction
- general weekday availability
- service-specific weekday availability
- unavailable date exception
- available override
- stale Web/Mobile scheduling state
- backend revalidation
- capacity
- scheduling conflicts
- parish tenancy

---

## Event Visibility

Test:

```text
PUBLIC
→ visible in Admin
→ visible on Web
→ visible on Mobile

PARISH_PRIVATE
→ visible to authorized staff
→ NOT visible on Web
→ NOT visible on Mobile
```

Also test switching visibility in both directions.

---

## Reports

Test:

- Secretary creates parish report
- Secretary only sees allowed parish reports
- Coordinator views cross-parish reports
- filters
- editing
- deletion/archive policy
- date handling

---

## Responsive Admin

Physically inspect:

```text
320–359 px
360–392 px
393–430 px
Tablet
Desktop
```

Check:

- sidebar
- tables
- forms
- calendar
- charts
- modals
- buttons
- overflow
- touch targets

---

## Analytics

Verify:

- totals against database source
- date filters
- parish filters
- role scope
- empty data
- percentages
- graph labels
- aggregations

---

## Email

Test one notification for each transition:

```text
Document READY_FOR_PICKUP
Schedule submitted / awaiting confirmation
Secretary proposed reschedule
Schedule confirmed
```

Also test:

- duplicate/retry behavior
- invalid recipient
- provider failure
- retry handling
- no state rollback

---

## Help

Test:

- Web Help navigation
- Mobile Help navigation
- correct workflow instructions
- small-screen readability
- no obsolete steps
- no developer terminology

---

# 20. Recommended Implementation Order

## Phase A — Scheduling Availability

1. Audit current scheduling settings and backend rules.
2. Design weekday/date exception model.
3. Implement backend validation.
4. Add Parish Settings UI.
5. Update Web scheduling.
6. Update Mobile scheduling.
7. Perform cross-client testing.

## Phase B — Event Visibility

1. Add visibility to event domain.
2. Enforce public filtering in backend.
3. Add Admin visibility controls.
4. Verify Web event banner/feed.
5. Verify Mobile events.
6. Test private-event isolation.

## Phase C — Reports

1. Finalize roles and categories.
2. Add backend model/API.
3. Build Admin Reports page.
4. Add filters/details/editor.
5. Add audit logging.
6. Test tenancy.

## Phase D — Responsive Admin

1. Audit Admin layouts.
2. Fix global shell/sidebar.
3. Fix tables.
4. Fix forms/modals.
5. Fix calendar.
6. Fix analytics layouts.
7. Perform responsive physical QA.

## Phase E — Analytics Enhancement

1. Audit current analytics.
2. Finalize metrics.
3. Add backend aggregations where needed.
4. Add filters.
5. Add graphs.
6. Add detailed summary cards.
7. Validate calculations.

## Phase F — Email Notifications

1. Select/configure email provider.
2. Implement backend email service.
3. Add duplicate protection and retry policy.
4. Add Ready for Pickup email.
5. Add scheduling emails.
6. Add delivery logging.
7. Test failure behavior.

## Phase G — System Help

1. Finalize help content.
2. Build Web Help view.
3. Build Mobile Help view.
4. Add contextual help where useful.
5. Verify content against current workflows.

---

# 21. Decisions Required Before Implementation

## Scheduling

1. Are Marriage, Marriage (Special), and Funeral absolutely forbidden on Sundays?
2. Or may an authorized parish create a Sunday override for a specific date?
3. Are weekly availability rules:
   - parish-wide,
   - service-specific,
   - or both?
4. Which roles can edit scheduling availability?

## Events

5. What visibility should existing events receive after migration?
6. Can Priests modify event visibility?

## Reports

7. Can Priests create reports?
8. Should reports be deletable or archived?
9. Should reports support photos/attachments?
10. Can a Coordinator create a diocese-wide report without selecting a parish?

## Email

11. Which email provider will TESTIMONIUM use?
12. Are these emails mandatory transactional emails?
13. Should users be able to disable any non-essential email notifications?

## Help

14. Should help content initially be static in Web/Mobile source code?
15. Or should Admin eventually be able to edit Help content?

---

# 22. Acceptance Criteria

The enhancement set is complete when:

## Scheduling

- parish staff can configure available/unavailable days
- parish staff can configure date exceptions
- approved Sunday rules are enforced
- backend revalidates every submission
- Web and Mobile show the same authoritative availability

## Events

- Public events appear in parishioner clients
- Parish/private events do not appear in parishioner APIs or UI

## Reports

- Secretary and Coordinator can create reports
- report visibility respects parish and role scope

## Admin Responsiveness

- major workflows remain usable on desktop, tablet, and mobile-width browsers

## Analytics

- staff can view expanded graphs and descriptive metrics
- analytics respect role and parish boundaries

## Email

- required emails send on the intended transitions
- duplicate messages are controlled
- delivery failure does not affect workflow state

## Help

- Parishioner Web and Mobile include clear usage guidance
- instructions match current workflows

---

# 23. Final Feature Summary

```text
SCHEDULING
✓ Parish configurable weekdays
✓ Parish configurable date exceptions
✓ Sunday restriction support
✓ Backend revalidation
✓ Web + Mobile parity

EVENTS
✓ Public events
✓ Parish/private events
✓ Public feed protection

REPORTS
✓ Secretary reports
✓ Coordinator reports
✓ Date-based records
✓ Filters and history

ADMIN PORTAL
✓ Responsive desktop/tablet/mobile layouts

ANALYTICS
✓ More metrics
✓ More graphs
✓ More detailed descriptive reporting

EMAIL
✓ Document Ready for Pickup
✓ Schedule Submitted / Awaiting Confirmation
✓ Proposed Reschedule
✓ Confirmed Schedule

HELP
✓ Parishioner Web Help
✓ Parishioner Mobile Help
✓ Simple workflow guidance
```

---

**End of Planned Additions & Improvements Specification**

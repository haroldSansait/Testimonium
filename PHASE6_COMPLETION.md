# TESTIMONIUM — Phase 6 Completion & Final System Enhancement Plan

## Overview

This document consolidates all remaining implementation work after the completion of Phases 1–5. It includes the remaining backend integrations, workflow completion, scheduling improvements, calendar enhancements, staff management, UX polish, and final production-readiness tasks identified during the implementation audit.

The objective of these phases is to remove all remaining stubs, complete all end-to-end workflows, and ensure every feature behaves as a production-ready church management platform rather than a prototype.

---

# Phase 6 — Scheduling Completion & Liturgical Calendar System

**Priority:** Critical  
**Dependency:** Completed Phases 1–5

This phase completes the entire scheduling ecosystem, including reschedule workflows, priest assignments, notifications, parish Mass schedules, parish events, and parishioner-requested events.

---

## Objectives

Complete every scheduling workflow so that:

- every schedule request follows a complete lifecycle
- every assignment is reflected across all portals
- calendars remain synchronized
- parish Mass schedules become configurable
- parish events become administrator-managed
- parishioner-requestable events follow actual diocesan workflows

---

## 6.1 Complete Reschedule Workflow

Complete the entire scheduling lifecycle.

Implement:

- Secretary proposes alternative schedule
- Parishioner receives proposal
- Parishioner accepts or declines
- Secretary receives response
- Schedule status updates automatically
- Calendar updates automatically
- Notifications sent automatically

There should be **zero manual refreshes** or UI-only state changes.

---

## 6.2 Complete Priest Assignment Workflow

Current priest assignment is incomplete.

Complete:

- Load priests dynamically
- Include assistant priests
- Filter by parish assignment
- Respect priest availability
- Persist assignment
- Reflect assignment immediately on:
  - Secretary Portal
  - Priest Portal
  - Parishioner Portal
  - Calendar
  - Reports

---

## 6.3 Complete Notification Flow

Every scheduling action should notify all affected users.

Notifications should exist for:

- Request submitted
- Under review
- Reschedule proposed
- Reschedule accepted
- Reschedule declined
- Priest assigned
- Schedule confirmed
- Schedule cancelled
- Schedule completed

Notifications should contain contextual information rather than raw status names.

---

## 6.4 Parish Mass Schedule Management (NEW)

Instead of starting with an empty calendar, each parish should display its **default Mass schedule**.

The Diocese already has canonical Mass schedules.

These should automatically populate each parish calendar.

Example structure:

| Schedule Type | Default Times |
|---------------|--------------|
| Weekdays | 6:00 AM, 5:15 PM |
| Sundays | 5:00 AM, 7:00 AM, 9:00 AM, 4:00 PM, 6:00 PM |

These are recurring parish schedules rather than manually-created events.

---

### Secretary Mass Schedule Settings

Add a dedicated **Mass Schedule Settings** module.

Secretary can:

- Edit weekday Mass schedule
- Edit Sunday schedule
- Add special Mass schedules
- Disable Masses temporarily
- Set holiday schedules
- Set Holy Week schedules

Changes should automatically update:

- Parish calendar
- Parishioner calendar
- Vicariate Directory
- Future scheduling validation

---

## 6.5 Separate Parish Events from Requested Events

The current implementation mixes parish events with parishioner scheduling.

Split them into three independent categories.

---

### A. Parish Mass Schedule

Recurring schedules.

Examples:

- Weekday Mass
- Sunday Mass

Configured by secretary.

---

### B. Parish Events (Secretary Managed)

Events officially hosted by the parish.

These are scheduled internally.

Examples:

| Parish Events |
|--------------|
| Baptism |
| Marriage (Regular Saturday) |
| Confession (Holy Week) |

These appear on:

- Secretary calendar
- Parishioner calendar (read-only)

---

### C. Parishioner Schedule Requests

These are appointment requests initiated by parishioners.

Replace the current request types with:

| Parishioner Request Types |
|--------------------------|
| Marriage (Special) |
| Wake Mass |
| Funeral |
| Private Mass |
| Anointing of the Sick |
| Fiesta |
| Blessing |
| Deliverance |
| Thanksgiving |
| First Communion |
| Mass of the Holy Spirit |
| Confirmation |
| Confession |

These should initiate scheduling workflows instead of appearing as static parish events.

---

## Recommendations

Instead of storing all three as generic calendar entries, introduce three distinct scheduling concepts:

- Recurring Mass Schedule
- Parish Event
- Parishioner Appointment

This separation greatly simplifies:

- recurring schedules
- analytics
- reporting
- conflict detection
- availability checks

---

## Verification Goals

- Complete reschedule workflow
- Priest assignment synchronization
- Notification synchronization
- Calendar synchronization
- Default parish Mass schedules visible
- Secretary can edit Mass schedules
- Parish events separated from appointment requests
- Parishioner event requests reflect updated event list

---

# Phase 7 — Staff Management Completion

---

## Objectives

Complete every remaining administrative workflow.

---

## 7.1 Staff Profile Management

Implement complete staff profile pages.

Applicable roles:

- Secretary
- Priest
- Diocese Coordinator

Profile should include:

- personal information
- parish assignment
- contact information
- password management
- account settings

Administrative user management remains separate.

---

## 7.2 Assistant Priest Management

Complete assistant priest support.

Coordinator can:

- assign assistant priests
- transfer assistants
- remove assistants

Secretary scheduling should include:

- parish priest
- assistant priests

Availability should consider both.

---

## 7.3 Availability Management

Complete availability system.

Secretary:

- office closures
- holidays
- leave
- unavailable dates

Priest:

- leave
- retreats
- unavailable days
- pastoral assignments

Scheduling should automatically detect conflicts.

---

## 7.4 Address Persistence

Complete profile persistence.

Ensure all editable profile fields are stored consistently across all portals.

---

## Recommendations

Future-proof the availability system so it can later support:

- recurring leave
- diocesan holidays
- parish closures
- emergency closures

---

## Verification Goals

- Staff profile fully functional
- Assistant priest workflow complete
- Availability respected
- Profile information persisted

---

# Phase 8 — Calendar & User Experience Completion

---

## Objectives

Replace all remaining prototype behavior with production-ready functionality.

---

## 8.1 Manual Parish Events

Replace placeholder "Create Parish Event".

Secretary should create:

- title
- event type
- location
- description
- assigned priest
- schedule

Events appear across all calendars.

---

## 8.2 Calendar Export

Replace placeholder calendar integration.

Support:

- ICS download
- Google Calendar
- Outlook Calendar

---

## 8.3 Password Reset

Replace placeholder password reset.

Use the existing authentication provider's password reset workflow.

---

## 8.4 Remove Remaining Placeholder Alerts

Replace every remaining `alert()` with proper UI.

Examples:

- toast notifications
- dialogs
- confirmation modals
- snackbars

---

## 8.5 Help & About

Replace placeholder Help/About.

Provide:

- About TESTIMONIUM
- Contact information
- User guide
- FAQs
- Privacy Policy

---

## 8.6 Event Navigation

Replace placeholder "See All Events".

Navigate users to the actual Events page.

---

## Recommendations

Conduct a full audit ensuring:

- zero placeholder alerts
- zero TODO screens
- zero stub buttons
- zero dead navigation
- zero disconnected workflows

Every visible control should execute a real action.

---

## Verification Goals

- Manual events fully operational
- Calendar export functional
- Password reset operational
- No placeholder alerts remain
- Help/About functional
- Event navigation completed

---

# Final Production Readiness Checklist

## Scheduling

- [ ] Complete scheduling lifecycle
- [ ] Priest assignment
- [ ] Notifications
- [ ] Calendar synchronization
- [ ] Mass schedules
- [ ] Parish events
- [ ] Appointment requests

---

## Staff

- [ ] Staff profiles
- [ ] Assistant priests
- [ ] Availability
- [ ] Address persistence

---

## Calendar

- [ ] Manual events
- [ ] Calendar export
- [ ] Event synchronization
- [ ] Event navigation

---

## UX

- [ ] Password reset
- [ ] Remove alert placeholders
- [ ] Help Center
- [ ] About Page

---

## Final Goal

After completing these phases, TESTIMONIUM should have:

- Fully integrated backend workflows
- Production-ready scheduling
- Real-time calendar synchronization
- Complete staff management
- Configurable parish Mass schedules
- Proper separation of Masses, parish events, and parishioner appointment requests
- Complete notification workflows
- No remaining stubs, placeholder alerts, or disconnected features
- A fully production-ready diocesan sacramental records and scheduling platform.


--REMAINING WORK AUDIT--

Phase 6 & 7 System Audit: Scheduling, Liturgical Calendar, and UX
I have conducted a comprehensive end-to-end audit of Phase 6 (Scheduling & Liturgical Calendar) and Phase 7 (Staff Management) across testimonium-backend, testimonium-admin-portal, and testimonium-parishioner-web.

No code has been modified during this audit. Below is the categorized finding report.

1. Disconnected Workflows & Gaps Identified
A. Staff Profile Page Mappings (Phase 7.1 & 7.4)
File(s) Involved:


AppRouter.tsx
 (Admin Portal)


Sidebar.tsx
 (Admin Portal)
Current Behavior: The Admin Portal's Sidebar component has a "Profile" navigation button mapping to /profile, but clicking it redirects to the dashboard home because no /profile route is registered in the Router and no ProfilePage.tsx exists in the pages directory.
What is Missing: A dedicated profile settings page for secretaries, priests, and coordinators to edit their personal information, contact numbers, and view their parish assignments.
Why it is Incomplete: The admin portal profile view was skipped, leaving the sidebar profile navigation action broken.
Complexity: Medium. Requires creating ProfilePage.tsx with fields for name, email, phone, and password reset actions, and wiring it to /profile.
B. Address Persistence Gap (Phase 7.4)
File(s) Involved:


schema.prisma
 (Backend Database)


profile.ts
 (Parishioner Web Provider)
Current Behavior: The parishioner profile page displays and allows editing of an address field. However, ApiProfileProvider drops address when making the PUT request, and the backend User model lacks an address field.
What is Missing: Real persistence for the address field in the database.
Why it is Incomplete: There is a mismatch between the database schema and the UI state representations for addresses.
Complexity: Low-Medium. Requires adding address String? to the Prisma schema, generating migrations, and mapping it through the service and DTO layer.
C. Help & About Modals (Phase 8.5)
File(s) Involved:


AdminLayout.tsx


Sidebar.tsx
 (Admin Portal)
Current Behavior: Help and About page overlays exist and function in the Parishioner Web's DashboardLayout.tsx. However, the Admin Portal's sidebar has no links to Help or About dialogs, and the templates for FAQs or guides do not exist for staff roles.
What is Missing: An "Admin Help Guide" explaining how to approve events, set Mass slots, and add leave periods.
Why it is Incomplete: Gaps in the admin-specific portal documentation.
Complexity: Low.
B. Calendar Export in Admin Portal (Phase 8.2)
File(s) Involved:


CalendarPage.tsx
Current Behavior: Parishioners have the ability to download .ics calendar files or deep-link to Google Calendar for confirmed appointments. The Secretary/Coordinator calendar view does not expose any .ics export or sync actions.
What is Missing: Export actions for the parish-wide events stream.
Why it is Incomplete: UI export triggers were only added to the parishioner portal.
Complexity: Low-Medium.
E. Residual Browser alert() Modals (Phase 8.4)
File(s) Involved:
Admin Portal:


ScheduleRequestsPage.tsx:L78
 (alert('Please assign a priest...'))


CalendarPage.tsx:L187
 (alert(err.message...))
Parishioner Portal:


HomePage.tsx:L312
 (alert("Events Directory Page coming..."))


EventDetailsModal.tsx:L43
 (alert('Syncing...'))


EventDetailsModal.tsx:L49,51
 (alert('Event link copied...'))
Current Behavior: Simple browser popup boxes block UI execution.
What is Missing: Replacement of these boxes with premium inline toasts, confirmation modals, or state banners.
Why it is Incomplete: Minor residual placeholders missed during the Phase 5/6 transition audits.
Complexity: Low.
2. Concisely Categorized Progress Report
🟢 Fully Implemented
Recurrence Engine Fix: Generates Mass schedules exactly on the configured days (Wednesday, Friday, Sunday).
Parish Events vs. Parishioner Requests separation: Stored separately in MassScheduleTemplate, ParishEvent, and Schedule models, and unioned on demand.
Notification Dispatching: Dynamic templates dispatch human-readable notifications for all status transitions and assignments.
Priest Conflict Detection: Blocks leave overlaps and double-bookings.
Staff Leave Management: Allows priests and secretaries to manage leave periods on /availability.
🟡 Partially Implemented
Assistant Priest Management: Roles select, map, and filter accurately in user creation and directories; however, secretaries cannot assign them to events if they are queried without standard priest role mapping adjustments (resolved in our prior fix).
UX Alerts: The major workflows use premium toasts, but residual browser alert() popups remain in fringe handlers (e.g., clipboard errors, unassigned priest warning on approval).
🔴 Not Implemented
Staff Profile Management (Admin Portal): Profile page (ProfilePage.tsx) and profile editing routes are completely missing from the admin portal, rendering the sidebar profile link non-functional.
Address Persistence: Address field changes are ignored by the backend API and database schemas.
Calendar Export (Admin Portal): Exclusively available on the parishioner portal.
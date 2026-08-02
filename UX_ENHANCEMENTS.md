# TESTIMONIUM — Phase 3.7 Feature Improvements & UX Enhancements

## Overview

This phase focuses on improving usability, consistency, performance, maintainability, and overall production polish across both the **Admin Portal** and **Parishioner Web Portal**.

This is **NOT** a redesign or architecture rewrite.

The existing Provider Architecture, role permissions, backend services, and routing must remain intact.

---

# Global Requirements

## Do NOT

- Rewrite project architecture
- Replace Provider Architecture
- Replace routing
- Replace authentication
- Replace role permissions
- Introduce breaking database migrations
- Duplicate existing business logic
- Hardcode URLs
- Introduce unrelated UI libraries
- Modify unrelated modules

## Must

- Maintain Demo/API/Hybrid Provider compatibility
- Preserve backward compatibility
- Keep backend as the single source of truth
- Follow existing coding standards
- Keep responsive behavior intact
- Maintain accessibility
- Avoid unnecessary API requests

---

# 1. Diocese Coordinator Calendar Improvements

## Objectives

Improve the Calendar page usability for Diocese Coordinators.

### Changes

### Adjust Calendar Filters Layout

Improve spacing and alignment of the filter controls.

The filter row should remain usable even on smaller desktop widths.

Ensure controls wrap gracefully.

---

### Remove "All Parishes" Filter

Remove the **All Parishes** option.

Reason:

Loading every parish simultaneously can eventually overwhelm:

- Calendar rendering
- Queries
- Event loading
- Future scaling

Require coordinators to explicitly choose a parish.

If a global calendar becomes necessary in the future, implement it separately using pagination or lazy loading.

---

# Recommendation

Instead of "All Parishes", add:

- Recent Parish
- Last Selected Parish

and remember the last selection using local storage.

---

# 2. Remove My Leave Settings (Coordinator)

Remove **My Leave Settings** entirely from the Diocese Coordinator account.

The coordinator does not manage personal liturgical availability.

The page should remain available only for roles that actually require leave management (Priests and Secretaries).

---

# 3. Parishioner Web Background Auto Refresh

## Objective

Remove manual refreshes while keeping the UI stable.

---

### Update useQuery()

Enhance the core custom hook.

Implement background polling.

Suggested interval:

```
10 seconds
```

Requirements:

- only poll while

```
document.visibilityState === "visible"
```

AND

```
window.hasFocus()
```

- use silent

```
refetch(true)
```

- never reset loading state

- never trigger skeleton loaders

- never flicker

---

### Immediate Mutation Updates

Mutations should continue updating immediately.

Examples:

- Receipt Upload
- Correction Requests
- New Requests
- Schedule Updates

Immediately:

- update local cache

OR

- call refetch()

before background polling occurs.

---

# Recommendation

Instead of fixed polling, pause polling while:

- modal open
- form editing
- uploads in progress

Resume polling afterwards.

This reduces unnecessary requests.

---

# 4. Logout Behavior

After logout in Parishioner Web:

Redirect to:

```
Landing Page
```

NOT

- login page
- dashboard
- previous route

Clear:

- auth state
- cached queries
- local storage session
- temporary draft state

---

# 5. Admin Navbar Cleanup

## Remove

- Search icon
- Search input
- Static avatar circle
- Question mark button

Keep

- Notification Bell

---

## Move Help/About

Move

Help

About

from Sidebar

to Navbar.

Open

HelpModal

AboutModal

from Navbar.

---

## Update Modal Content

Refresh Help modal.

Include:

- navigation guide
- request workflow
- map configuration basics
- document management

Update About modal.

Include:

- version
- build date
- technologies
- contributors
- copyright

---

# Recommendation

Display:

```
Version x.x.x
```

automatically from package.json.

Avoid hardcoded version numbers.

---

# 6. Login & Signup Layout Cleanup

## PublicLayout

Remove:

```
Parishioner Portal
```

badge.

Move

```
Diocese Administration
```

beside or below

```
TESTIMONIUM
```

---

## Login

## Signup

Center the branding section vertically.

Remove duplicated heading.

Retain:

- quote
- icon
- description

---

# Recommendation

Animate the quote very subtly using fade transitions.

No heavy animations.

---

# 7. Dashboard Header Cleanup

Remove

```
|

Page Title
```

from DashboardLayout.

Keep only

```
TESTIMONIUM
```

breadcrumb/home.

The sidebar already communicates navigation context.

---

# 8. Sidebar UX Redesign

Implement the collapsible hover sidebar.

Features:

## Collapsed

76px

- icons
- avatar
- tooltips

## Expanded

280px

- labels
- user info
- categories

Hover delay:

150ms

---

## Categories

### Operations

- Dashboard
- Calendar
- Notifications

### Requests

- Documents
- Schedule Requests
- Mass Schedule

### Configuration

- Parish Settings
- Leave Settings (role-specific)

### Diocese

Coordinator only

- Parish Management
- Users
- Map Configuration
- Activity Logs
- Analytics

---

# Recommendation

Remember sidebar state.

If a user manually expands it,

keep it expanded across sessions.

---

# Recommendation

Support keyboard navigation.

Arrow keys.

Tab.

Escape.

---

# 9. Seed Mass Schedules & Events

Move runtime lazy initialization into database seeding.

Seed:

Mass Templates

for every parish.

Include:

Wednesday

Friday

Sunday

Sample Parish Events.

Examples:

- Fiesta
- Holy Hour
- Marriage Seminar
- Retreat
- Procession

Seed dates should be distributed naturally across the calendar.

---

# Recommendation

Use deterministic seed dates instead of Date.now()

This prevents changing datasets every seed execution.

---

# 10. Parish Select Cleanup

Dropdown:

Display

```
Parish Name
```

only.

Remove addresses.

---

Remove

GKK Endorsement

from

Frontend

Backend

Settings

Requirements Matrix

---

Ensure no orphan references remain.

---

# 11. Parish Directory Redesign

## ParishDrawer

Match the Coordinator Preview Card.

Include:

- Cover Image
- Floating Logo
- Parish Name
- Vicariate
- Patron Saint
- Description
- Address
- Phone
- Email

Fallback logo:

First two letters.

---

## Parish Directory Sidebar

Port the Map Configuration parish list.

Features:

- floating
- collapsible
- flyTo()
- active highlight

Selecting a parish:

- center map
- open drawer

---

# Recommendation

Automatically scroll the selected parish into view inside the sidebar.

---

# Recommendation

If a parish is selected directly from the map,

highlight it inside the list.

---

# Additional Recommendations

## Performance

Debounce:

- map flyTo()
- search
- filters

Memoize:

- parish cards
- markers
- list items

---

## Accessibility

Verify:

- keyboard navigation
- aria-labels
- focus trapping in modals
- ESC closes overlays
- proper tab order

---

## UX

Standardize:

- empty states
- loading states
- success toasts
- error toasts

Avoid browser alerts.

---

## Mobile

Verify:

- Parish Drawer
- Sidebar
- Calendar Filters
- Navbar

behave properly on tablets.

---

## Analytics

Track:

- most viewed parish
- frequently searched parish
- calendar filter usage

Only if analytics already exist.

Do not introduce tracking infrastructure.

---

## Testing Checklist

### Coordinator Portal

- Calendar filters fit correctly
- No "All Parishes"
- Coordinator has no Leave Settings
- Navbar cleaned
- Help/About work
- Sidebar transitions smooth

### Parishioner Web

- Background polling works
- No flickering
- Logout returns to landing page
- Login/signup layout centered
- Header simplified
- Parish drawer redesigned
- Parish list sidebar works

### Backend

- Seed script executes cleanly
- All parishes receive templates
- Events populate correctly
- No constraint violations

### Regression

- Provider Architecture intact
- No TypeScript errors
- No ESLint errors
- No console errors
- No build regressions
- No permission regressions


Context: this is the raw plan:

-On the coordinator account, Adjust the UI to fit the filter settings on the top
also, don't put all parish on the filter so the calendar won't break or be overwhelmed when lots of
events are added by multiple parishes.

-Remove the My Leave Settings on the coordinator account since I think that is irrelevant

-Real-time Background Polling for Parishioner Web Portal
Goal: Remove the need for manual page refreshes in the parishioner web application. Ensure status badges, document requests, and schedulers update automatically in the background without layout flickering.

Implementation Specifications:

Implement Auto-Polling in useQuery:

Open 

useService.ts
 and modify the core custom useQuery hook.
Add a background polling interval (e.g., every 10 seconds) that triggers refetch(true) (the silent refetching option already available in the code).
Resource Optimization: The polling timer must only run while the browser tab is active (document.visibilityState === 'visible') and the window has focus to prevent unnecessary API overhead when backgrounded.
Ensure that silent refetching (refetch(true)) updates the React state directly in the background without resetting the loading flag, which would otherwise trigger skeleton UI loaders and cause flickering.
Trigger Immediate Updates on Mutations:

Verify that pages performing mutations—such as uploading a receipt in ReceiptUploadCard or resubmitting corrections on the RequestTrackingPage—immediately call their returned refetch() or update their state locally so the changes are visible instantly.
Summary of Work
Analyzed Hook Architecture: Reviewed 

useService.ts
 and verified that the custom useQuery hook already supports silent updates via refetch(true).
Drafted Solution: Designed a polling mechanism that plugs directly into the existing useQuery setup, utilizing window visibility conditions to optimize network traffic.


-When Logging out of the Parishioner web, it should take you back to the landing page.

-Navbar Cleanup and Modal Migration
I want to perform the following updates in the testimonium-admin-portal frontend:

Clean Up Navbar.tsx:

Remove the non-functional search icon/search input logic.
Remove the existing static profile avatar circle (AD) at the far right.
Remove the static question mark icon button.
Retain the active Notification bell button.
Migrate Help and About Triggers to Navbar:

Move the Help and About button triggers from the bottom of 

Sidebar.tsx
 to the right side of 

Navbar.tsx
.
Ensure clicking these navbar buttons opens the respective HelpModal and AboutModal (moving modal states from the sidebar/layout to the navbar context).
Update Modal Information:
Open and update the contents of HelpModal.tsx and AboutModal.tsx to feature current/relevant instructions and system version details.


-Login & Signup Layout Refactoring
perform the following layout updates in the testimonium-parishioner-web workspace:

Update the Public Navbar Layout (PublicLayout.tsx):

Remove the static Parishioner Portal badge from the header.
Transfer the Diocese Administration wording to the header (e.g., place it adjacent to or styled under the main TESTIMONIUM title text).
Clean Up and Center Left Panels (LoginPage.tsx & SignupPage.tsx):

In the left-side branding pane (hidden on mobile, visible on desktop), remove the top block containing the Diocese Administration uppercase tag and the TESTIMONIUM title.
Adjust the flexbox layout of the left container (e.g., changing from justify-between to centered alignment) so that the remaining quote content (icon, quote text, and description) is vertically centered in the maroon block.



-Remove Header Navigation Title
Please perform the following update in testimonium-parishioner-web:

In DashboardLayout.tsx
, locate the header title block and remove the vertical divider (|) and page title header ({getPageTitle()}) situated next to the TESTIMONIUM home link.




-Improve the Sidebar accross the admin portal(for secretary, priest, coordinator views/accounts)
Here is the idea concept
Design Concept: Collapsible Hover Sidebar for TESTIMONIUM Admin Portal
This design adapts the core interaction pattern from your reference image (expanding from a compact icon column to a detailed, categorized panel) while customizing it to fit the existing TESTIMONIUM crimson theme, typography, and role-based route permissions.

1. Structure & Layout Behavior
Dual-Width Layout:
Collapsed State (w-[76px]): Keeps the interface clean and maximizes screen real estate for dashboards/data tables. Displays the TESTIMONIUM logo mark, user avatar, and navigation icons.
Expanded State (w-[280px]): Triggered automatically on hover. Smoothly transitions outward, revealing the full brand name, user details, category headings, and text labels.
Hover Mechanics:
An isHovered React state handles delayed transitions (e.g., a 150ms enter/exit delay) to prevent accidental expansions when a user's cursor briefly passes over the edge of the screen.
When collapsed, hovering over individual navigation items displays a floating tooltip (e.g., "Finances" in your reference image). When expanded, tooltips are disabled in favor of inline labels.
Layout Grid Adjustment:
The sidebar sits on top of or pushes the main layout content area. Utilizing a transition on the grid wrapper ensures the dashboard content shifts or scales smoothly along with the sidebar expansion.
2. Tailored Visual Styling & Aesthetics
Rather than copying the clinical, bright gray/light aesthetic of the reference card, the design maintains TESTIMONIUM's existing rich, premium visual cues:

Color Palette & Background:
Retains the rich linear gradient background (linear-gradient(180deg, #6B0F1A 0%, #4A0A12 100%)).
Active/Hover states use glassmorphism styles (bg-white/10 and bg-white/15) with a solid white left-accent border (border-l-2 border-white) for the active route.
Header Profile Panel:
In the collapsed state, shows only the user's avatar.
In the expanded state, transitions to a card displaying the user’s name, their specific role (e.g., Parish Secretary, Parish Priest, or Diocese Coordinator), and a premium logout button indicator.
Category Headers:
Subtle, semi-transparent uppercase headers (e.g., text-white/40 text-[10px] tracking-wider font-semibold) that fade in/out using transition delays (transition-opacity duration-200) so they don't look awkward during the width transition.
3. Dynamic Category Organization by Role
To organize the existing routes cleanly for the different roles (Secretary, Priest, and Coordinator), we group items into four distinct categories:

Category A: Operations (Core)
Dashboard (Lucide: LayoutDashboard) — Overview of daily metrics, activities, and stats.
Calendar (Lucide: Calendar) — Central parish/liturgical calendar.
Notifications (Lucide: Bell) — System alerts and pending task indicators (complete with red notification badge counters).
Category B: Requests & Schedules
Document Requests (Lucide: FileText) — Certificates (Baptism, Confirmation, Marriage) and records management.
Schedule Requests (Lucide: CalendarDays) — Bookings for sacraments, blessings, and funerals.
Mass Schedule (Lucide: Clock) — Managing daily mass slot assignments, intentions, and priests.
Category C: Configuration & Staffing
My Leave Settings (Lucide: Calendar) — Availability settings, particularly for Priests and Secretaries.
Parish Settings (Lucide: Settings) — Church-specific metadata, operating hours, and defaults.
Category D: Diocese Oversight (Diocese Coordinator Only)
Parish Management (Lucide: Church) — Managing individual parishes under the diocese.
User Management (Lucide: Users) — Admin accounts, roles, and authorization levels.
Map Configuration (Lucide: Map) — Geographic parish boundary edits.
Activity Log (Lucide: ClipboardList) — High-level audit logs of changes made in the system.
Analytics (Lucide: BarChart2) — Aggregate statistics of parish metrics across the diocese.
4. Implementation Steps (For future code reference)
Refactor Sidebar State: Introduce isOpen and isHovered states to the 

Sidebar.tsx
.
CSS Transition Layer: Update the layout container to handle dynamic widths (w-20 vs w-72) utilizing CSS transitions (transition-all duration-300 ease-in-out).
Content Hiding/Fade: Map the categories to separate sub-arrays in the code and use transition classes (transition-opacity duration-200, opacity-100 / opacity-0) to gracefully fade out text labels and category headers when the sidebar collapses.
Floating Tooltips: Integrate basic floating tooltip wrappers (e.g., using @radix-ui/react-tooltip or simple CSS tooltips) that only mount or trigger when the sidebar is collapsed.



-Seed Mass Schedules & Events for All Parishes
Context/Root Cause: Currently, only St. Joseph Parish has mass schedules visible in API mode because the database prisma/seed.js does not seed any MassScheduleTemplate or ParishEvent records. The application relies on an runtime auto-seed mechanism in MassScheduleService.getTemplates() which only triggers when a specific parish's template dashboard is loaded, leaving all other parishes empty.

Instructions:

Update 

seed.js
 to seed the default MassScheduleTemplate slots for every parish created in the parishes array. The template slots should include:
Wednesdays & Fridays: Morning Mass (06:00 AM) and Evening Mass (05:15 PM)
Sundays: Early Mass (05:00 AM), Morning Mass (07:00 AM), High Mass (09:00 AM), Afternoon Mass (04:00 PM), and Evening Mass (06:00 PM)
Seed several sample ParishEvent records (such as Pre-Cana Marriage Seminars, Parish Fiesta Processions, and Holy Hour Adorations) distributed across the different parishes so they populate the upcoming vicariate events feed.
Ensure the seed script runs cleanly (node prisma/seed.js) without constraint violations.
Summary of Work
Identified Root Cause: Traced the logic to 

ParishEventService.js:L119
, which reads MassScheduleTemplate rows directly from the database without triggering the lazy-initialization code in MassScheduleService.getTemplates().
Investigated Seed File: Confirmed in 

seed.js
 that no templates or events are created during database setup.
Formulated Solution: Drafted a prompt to update the seed database script to pre-populate templates and sample events across all parishes.


-Parish Select Cleanup and GKK Endorsement Removal
Please complete the following frontend and backend modifications across the workspace:

1. Frontend: Parish Dropdown Address Removal
In 

SacramentalRequestPage.tsx
, locate the drop-down <select> element under Step 1 (Select Parish).
Edit the <option> label rendering so it only displays {parish.name} (removing the delimiter and the address fields {parish.address || parish.city}).
2. Frontend & Backend: Remove "GKK Endorsement" Certificate Type
Parishioner Web Wizard: Remove the GKK Endorsement document type block from the ALL_DOCUMENT_TYPES array in 

SacramentalRequestPage.tsx
.
Admin Portal Settings: In 

SettingsPage.tsx
, remove the default settings item that configures the 'ENDORSEMENT' document type so it no longer appears in the Parish Settings interface.
Backend service: In the backend's 

DocumentRequirementService.js
, delete the ENDORSEMENT key and configuration block from DOCUMENT_REQUIREMENTS_MATRIX.



-Sync Parish Directory Map and Card Styles with Map Configuration
Please perform the following frontend UI updates in the testimonium-parishioner-web workspace:

1. Redesign the Parish Info Card (ParishDrawer.tsx)
Update 

ParishDrawer.tsx
 to match the visual design and layout of the coordinator preview dialog card found in 

PreviewDialog.tsx
:

Header Image & Logo Badge: Implement the full-width cover image with a floating, overlapping circular avatar logo badge (w-20 h-20, rounded-full with border) positioned on the bottom left. If no logo image exists, display the first 2 letters of the parish name.
Structured Metadata: Below the header, show the parish name followed by icons for the Vicariate and the Patron Saint.
Description & Contact Info Grid: Underneath an uppercase "ABOUT THE PARISH" label, render the parish description. Add a clean grid at the bottom containing the address (with a MapPin icon) and contact info (with Phone and Mail icons).
2. Implement the "Parishes List" Sidebar (ParishDirectoryPage.tsx)
Port the collapsable sidebar panel from 

MapConfigurationPage.tsx
 to 

ParishDirectoryPage.tsx
:

Left-Docked Panel: Add a floating overlay panel on the left side of the map titled "Parishes List" displaying all parishes.
List Item Styling: Each item in the list should display a Church icon (highlighted in crimson when active), the parish name, and its vicariate label.
Collapsible Behavior: Include the sidebar arrow button (ChevronLeft / ChevronRight) allowing users to easily slide the panel open or closed. Selecting a parish from this list should automatically fly the map center to that parish and open its updated info card.
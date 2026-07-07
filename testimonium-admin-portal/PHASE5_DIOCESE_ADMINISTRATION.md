# Phase 5 — Diocese Administration & Role-Based Frontend Architecture

## Objective

Implement a complete role-based frontend architecture for the TESTIMONIUM Admin Portal while preserving the existing backend API integration, Firebase authentication, UI styling, routing structure, and component hierarchy.

This phase establishes the foundation for Diocese-wide administration without changing existing backend endpoints.

---

# Goals

Implement:

- Role-based navigation
- Role-based routing
- Multiple dashboard layouts
- Diocese Administration module
- User Management module
- Parish Management module
- Permission system
- Feature visibility system

DO NOT modify backend endpoints.

DO NOT change authentication.

DO NOT break existing API communication.

---

# Existing Roles

The frontend must support the following roles returned by `/auth/profile`:

- DIOCESE_COORDINATOR
- SECRETARY
- PRIEST

Future roles should be easy to add.

---

# Permission Architecture

Create a centralized permission system.

Example:

```
src/
    permissions/
        permissions.ts
        rolePermissions.ts
```

Every page and navigation item must use this permission system instead of hardcoded role checks.

Avoid scattered:

if(role==="SECRETARY")

throughout the application.

---

# Sidebar Visibility

Secretary

- Dashboard
- Document Requests
- Schedule Requests
- Calendar
- Notifications

Priest

- Dashboard
- Document Requests
- Schedule Requests
- Calendar
- Notifications

Diocese Coordinator

- Dashboard
- Document Requests
- Schedule Requests
- Calendar
- Notifications
- Analytics
- Parish Management
- User Management
- Activity Log

---

# Dashboard Variants

Secretary Dashboard

Display parish-specific information.

Examples

- Pending Requests
- Today's Schedule
- Notifications

Priest Dashboard

Same layout but tailored for pastoral activities.

Diocese Dashboard

Completely different dashboard.

Display

- Total Parishes
- Total Quasi-Parishes
- Total Mission Stations
- Total Secretaries
- Total Priests
- Total Parishioners
- Pending Document Requests
- Pending Schedule Requests
- Recent Activity
- Diocese Notifications

Leave analytics cards connected to placeholder service methods if backend endpoints do not yet exist.

---

# Diocese Analytics Module

Create a new Analytics page.

Prepare reusable chart components.

Analytics sections:

Sacraments

- Baptisms
- Confirmations
- Weddings
- Funerals

Documents

- Requests per document type
- Monthly requests
- Completion rate
- Average processing time

Parishes

- Requests by parish
- Active parishioners
- Registrations

Financial

Placeholder only

- Payments
- QR transactions
- Collections

Charts should gracefully display empty states until backend analytics endpoints are implemented.

---

# User Management

Create User Management module.

Display table:

- Name
- Email
- Role
- Parish
- Status

Buttons

- Add User
- Edit
- Disable
- Reset Password

Only Diocese Coordinator may access.

All actions should call service methods that can temporarily return mock placeholders until backend APIs exist.

---

# Parish Management

Create Parish Management module.

Display

- Parish Name
- Type
- Vicariate
- Priest
- Secretary
- Status

Buttons

- Add Parish
- Edit
- Archive

---

# New Parish Wizard

Create a multi-step wizard.

Step 1

Parish Information

- Parish Name
- Parish Type

    - Parish
    - Quasi-Parish
    - Mission Station

- Vicariate
- Patron Saint
- Address
- Contact Number
- Email

Step 2

Secretary

- Name
- Email
- Contact Number

Step 3

Priest

- Name
- Email
- Contact Number

Step 4

Review

Finish

The wizard should be componentized.

No backend implementation yet.

---

# Routing

Protect every page through centralized role permissions.

Unauthorized users should automatically redirect to an Unauthorized page instead of generating backend errors whenever possible.

---

# Navigation Guards

Implement reusable helpers such as

canViewAnalytics()

canManageUsers()

canManageParishes()

Avoid direct role comparisons throughout the codebase.

---

# Services

Create placeholder services

AnalyticsService

UserManagementService

ParishManagementService

They should follow the same architecture as the existing service layer.

---

# UI

Maintain the existing design system.

Do not redesign the Admin Portal.

Maintain

- spacing
- colors
- typography
- responsiveness
- component hierarchy

---

# Deliverables

Create

- Permission system
- Diocese Dashboard
- Analytics page
- User Management page
- Parish Management page
- New Parish Wizard
- Protected routing
- Sidebar visibility rules
- Placeholder service layer

without breaking the existing frontend/backend integration.

---

# Verification

Ensure

- Existing login still works.
- Existing API communication remains unchanged.
- Existing secretary workflow continues to function.
- Diocese Coordinator sees the additional modules.
- Secretaries cannot access Diocese-only pages.
- Priests cannot access Diocese-only pages.
- Sidebar changes dynamically based on role.
- No TypeScript errors.
- Production build succeeds.

Also, Rather than having separate SecretaryDashboard, PriestDashboard, and DioceseDashboard pages, keep a single DashboardPage that renders different dashboard components based on the authenticated user's role. For example:

DashboardPage
 ├── DioceseDashboard
 ├── SecretaryDashboard
 └── PriestDashboard

This keeps our routing simple (/dashboard for everyone) while making it easy to add or modify role-specific dashboards in the future. It also avoids duplicating shared logic and keeps the application easier to maintain as TESTIMONIUM grows.
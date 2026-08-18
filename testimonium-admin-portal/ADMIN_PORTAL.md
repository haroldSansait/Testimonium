# TESTIMONIUM — Admin & Coordinator Portal Documentation

This document describes the architecture, data provider abstractions, state management, security guards, and page features of the **TESTIMONIUM Admin Portal**.

---

## 1. Architecture & Tech Stack

*   **Framework**: React 19 + TypeScript + Vite 8
*   **Styling**: Tailwind CSS with custom Testimonium Crimson design system (`#7B1C2A`, `crimson-700`, `bg-red-50`)
*   **Routing**: React Router 7 (`createBrowserRouter`)
*   **Authentication & RBAC**: Firebase Authentication + Custom Claims + Just-In-Time (JIT) staff provisioning
*   **Provider Architecture**: Pluggable Data Provider interfaces (`ParishProvider`, `DocumentRequestProvider`, `ScheduleProvider`, `ActivityLogProvider`) supporting seamless switching between `api` (REST API) and `demo` (in-memory mock) modes

---

## 2. Role-Based Access Control (RBAC)

The portal supports three distinct administrative roles with ring-fenced permissions:

| Role | Permitted Pages & Capabilities |
| :--- | :--- |
| **`DIOCESE_COORDINATOR`** | Unrestricted vicariate-wide access. Manage all parishes, user accounts, system-wide analytics, interactive map configuration, activity audit logs, and global settings. |
| **`SECRETARY`** | Scoped strictly to assigned parish. Manage parish document requests (verification & correction notes), sacramental schedules (booking & reschedule proposals), weekly mass templates, custom events, staff availability, and parish settings (fees, capacity, time slots, office hours, GCash/Maya QR). |
| **`PRIEST`** | Scoped strictly to assigned parish. View calendar feeds, confirmed sacraments, and respond to presiding mass/event assignments. |

---

## 3. Core Pages & Capabilities

### 1. Dashboard & Analytics (`/dashboard`)
- Live summary counters for pending document requests, scheduling requests, verified payments, and total active parishioners.
- Quick action shortcuts and recent activity stream.

### 2. Document Requests (`/document-requests`)
- Review sacramental certificate applications with authoritative fee snapshot display.
- Integrated Payment Verification drawer with **Google Vision / OCR.Space parsing** for GCash and Maya transaction screenshots.
- Interactive Correction Workflow: mark requests as `Needs Correction` with targeted requirement checklist and custom instructions.

### 3. Sacramental Scheduling & Rescheduling (`/schedule-requests`)
- Review booking applications for Baptisms, Weddings, Canonical Interviews, Blessings, Funerals, and Special Masses.
- Assign presiding priests with real-time schedule conflict and leave detection.
- Propose alternative reschedule dates/times with mandatory reason notes.

### 4. Parish Settings (`/settings`)
Multi-tab configuration suite:
- **Tab 1 — Document Fees & Requirements**: Set individual certificate pricing overrides and mandatory requirement file tags.
- **Tab 2 — Sacramental Scheduling**: Toggle offered sacraments, configure Per-Slot Booking Capacity (`slotCapacity`), Daily Appointment Quotas (`dailyLimit`), Maximum Church Venue Attendance Capacity (`venueCapacity`), and Time Slot builder chips.
- **Tab 3 — Office Operating Hours**: Set open and close times per day of the week, and mark closed days (e.g. Sunday/Monday).
- **Tab 4 — GCash / Maya Payment QR**: Upload, preview, and toggle active status for parish payment QR codes.
- **Unsaved Changes Guard**: Deep comparison tracking (`isDirty`) with modal confirmation when attempting to switch parishes or leave without saving.

### 5. Interactive Map Configuration (`/map-configuration`)
*(Diocese Coordinator Only)*
- Church sanctuary SVG map markers with custom hex color picker (`#7B1C2A`), zoom levels (1–20), and label visibility toggles.
- Interactive drag-and-drop marker relocation and keyboard arrow nudging with boundary clamping.
- Real-time save toolbar with unsaved changes glow indicator.

### 6. User Management (`/users`)
*(Diocese Coordinator Only)*
- Provision parish priests and secretaries with automatic JIT linking.
- Manage staff status (`Active`, `Inactive`, `Disabled`), assistant flags, and calendar color identifiers.

### 7. Activity Log & Auditing (`/activity-log`)
*(Diocese Coordinator Only)*
- Complete audit trail of database mutations with actor role, IP address, timestamp, and JSON diffs of previous vs new values.
- Archiving and log purge controls.
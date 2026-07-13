# TESTIMONIUM Parishioner Web Portal - UI/UX Design System Specification
# Workspace: /testimonium-parishioner-web
# Framework Matrix: React 19.x, Vite 8.x, TypeScript, TailwindCSS 3.4.x
# Geospatial Engine: Leaflet + OpenStreetMap (react-leaflet, leaflet)
# Calendar Engine: CalendarProvider Abstraction
# Authentication: Firebase Authentication
# AI Assistant: Google Gemini ("Caloy") (Backend API Proxy)

================================================================================
1. 🎨 DESIGN SYSTEM DESIGN TOKENS (CSS VARIABLE SPECIFICATION)
================================================================================

Configure these exact design tokens inside your global stylesheet or extend them
through Tailwind configuration to maintain complete visual consistency with the
TESTIMONIUM Admin Portal.

:root {

  /* Primary Brand Colors */
  --color-crimson: #7B1C2A;
  --color-crimson-dark: #5C1520;
  --color-crimson-light: #9B2535;

  /* Canvas */
  --bg-app-base: #FCFBFA;
  --color-page-bg: #F5F0EE;
  --color-card-bg: #FFFFFF;

  /* Navigation */
  --color-sidebar-bg: #6B0F1A;
  --color-sidebar-dark: #4A0A12;

  /* Typography */
  --color-text-primary: #1A1A1A;
  --color-text-muted: #6B7280;

  /* Borders */
  --color-border: #E5E7EB;

  /* Status Colors */
  --status-pending: #FBBF24;
  --status-under-review: #3B82F6;
  --status-ready: #10B981;
  --status-rejected: #EF4444;

  /* UI */
  --shadow-card: 0 8px 24px rgba(0,0,0,.08);
  --radius-card: 16px;
  --radius-button: 12px;
  --transition-fast: 180ms ease;
}

Typography

Primary Font:
- Inter

Headings:
- Playfair Display

Design Philosophy

- Minimal
- Ecclesiastical
- Spacious
- Premium
- Accessible
- Mobile-first
- Consistent with Admin Portal

================================================================================
2. 🗺 APPLICATION ROUTING STRUCTURE
================================================================================

Public

/

Landing Page

/login

Firebase Login

/signup

Account Registration

Authenticated

/dashboard

Layout Shell

├── home
├── parishes
├── request
├── track
├── scheduler
├── notifications
└── profile

================================================================================
3. 📐 GLOBAL APPLICATION LAYOUT
================================================================================

Unified Layout (Desktop & Mobile)

---------------------------------------------------------
Top Application Bar (Hamburger Trigger, Branding title, Profile Menu)
---------------------------------------------------------
Sliding Left Drawer Navigation (Toggled via Hamburger, ESC, or Backdrop click)
---------------------------------------------------------
Centered Content Canvas (max-w-7xl, mx-auto, generous spacing)
---------------------------------------------------------
Floating Caloy Button

All authenticated pages inherit:

- Authentication Guard
- User Context
- Notification Context
- Map Context
- Theme Tokens

================================================================================
4. SCREEN 4.1 — PUBLIC LANDING PAGE (/)
================================================================================

Purpose

Introduce TESTIMONIUM and direct visitors toward authentication.

Sections

Hero

- Diocese branding
- Welcome message
- Login
- Register

About TESTIMONIUM

Services

- Sacramental Requests
- Event Scheduling
- Parish Directory
- Request Tracking

Latest Diocese Announcements

Featured Parishes

Footer

================================================================================
5. SCREEN 4.2 — LOGIN & SIGNUP
================================================================================

Split Layout

Left

- Diocese Seal
- Background Illustration
- Ecclesiastical Branding

Right

Authentication Form

Features

- Email
- Password
- Google Sign In
- Remember Me
- Forgot Password

Forgot Password

Current implementation:

Displays informational modal instructing users to contact their Diocese Coordinator.

Future implementation:

Firebase Email Password Reset.

================================================================================
6. SCREEN 4.3 — DASHBOARD HOME
================================================================================

Purpose

Provide parishioners with an overview of everything important immediately after login.

Layout

--------------------------------------------------

Welcome Card

--------------------------------------------------

Announcements

Upcoming Events

Today's Mass Schedule

Quick Actions

--------------------------------------------------

Recent Requests

--------------------------------------------------

Leaflet Map Preview

--------------------------------------------------

Quick Actions

- Request Certificate
- Track Request
- Schedule Appointment
- View Parishes

Recent Requests

Display latest submitted requests with:

- Tracking Number
- Status
- Parish
- Last Updated

Announcements

Recent Diocese announcements.

Upcoming Events

Masses

Special Celebrations

Community Events

Leaflet Map Preview

Mini interactive map.

"Open Parish Directory"

button navigates to

/dashboard/parishes

================================================================================
7. SCREEN 4.4 — PARISH DIRECTORY
================================================================================

Purpose

Provide a complete geospatial directory of every parish.

Layout & Controls

- Search Input Bar: Autocomplete text box to filter parishes, zoom, and focus markers.
- Floating Map Controls:
  - Locate Me: Uses browser geolocation to pan to user's location (fallback to error message).
  - Reset View: Pans and zooms back to DEFAULT_CENTER showing the full Vicariate.
- Custom SVG Marker Icons: White church outline inside deep crimson circular border.

Overlays (Rich Information Panel)

- Desktop: Sleek floating card overlay positioned absolutely on the left side of the map.
- Mobile/Tablet: Slide-up bottom sheet from the bottom of the viewport.
- Contents:
  - Cover image with gradient text title overlay.
  - Parish name, address, operating hours, office open/closed status.
  - Historical description, Patron Saint, Feast Day.
  - Administrative personnel (Assigned Priest, Assigned Secretary).
  - Email, phone, Facebook Page links.
  - Mass schedules & upcoming event logs.
  - Future photo gallery support hooks.
- Action buttons:
  - Request Document (redirects to document wizard with parish ID).
  - Schedule Appointment (redirects to scheduler with parish ID).
  - Get Directions (launches external Google Maps with coordinates).

================================================================================
8. SCREEN 4.5 — SACRAMENTAL REQUEST
================================================================================

Multi-step Wizard

Step 1

Select Parish

Step 2

Select Document Type

Examples

- Baptism
- Confirmation
- Marriage
- Death
- Other

Step 3

Applicant Information

Fields

Personal Details

Relationship

Purpose

Registry Information

Step 4

Upload Requirements

Drag & Drop

Supported

PNG

JPG

PDF

Validation

File Size

MIME Type

Required Documents

Submission

Displays generated tracking number after successful submission.

================================================================================
9. SCREEN 4.6 — REQUEST TRACKING
================================================================================

Purpose

Allow parishioners to monitor document progress.

Components

Search Bar

Tracking Number

Status Card

Current Status

Current Parish

Assigned Office

Estimated Processing Time

Timeline

Created

↓

Received

↓

Validated

↓

Reviewed

↓

Signed

↓

Ready for Pickup

Rejected State

Displays

Reason

Instructions

Resubmit button if applicable.

Status Colors

Pending

Amber

Under Review

Blue

Ready

Green

Rejected

Red

================================================================================
10. SCREEN 4.7 — EVENT SCHEDULER
================================================================================

Booking Flow

Step 1

Select Parish

↓

Step 2

Select Service

↓

Step 3

Calendar

↓

Step 4

Time Slot

↓

Step 5

Confirmation

Calendar

Powered by CalendarProvider

Unavailable Slots

Disabled

Booked Slots

Gray

Available Slots

Selectable

Confirmation

Displays

Parish

Service

Date

Time

Confirmation Number

================================================================================
11. SCREEN 4.8 — NOTIFICATIONS
================================================================================

Purpose

Central notification center.

Notification Types

Document Approved

Document Ready

Appointment Confirmed

Appointment Updated

Announcements

Unread Indicator

Mark All Read

Filter

All

Unread

Archived

================================================================================
12. SCREEN 4.9 — PROFILE
================================================================================

Purpose

Allow parishioners to manage personal information.

Sections

Personal Information

Email

Phone

Address

Profile Picture

Security

Password

(Future Firebase reset)

Preferences

Notification Preferences

Theme (future)

Logout

================================================================================
13. 🤖 CALOY AI ASSISTANT
================================================================================

Floating Button

Bottom Right

Persistent

Opens

Right Drawer

Conversation Layout

User

Right aligned

Crimson Bubble

Caloy

Left aligned

Neutral Bubble

Capabilities

General FAQs

Sacramental Requirements

Office Hours

Mass Schedules

Parish Locations

Certificate Fees

Booking Guidance

Document Requirements

Status Explanations

Escalation

When Caloy cannot answer:

Displays

"Please contact your parish office for further assistance."

Loading

Typing Indicator

Disable input during requests

Streaming responses supported.

================================================================================
14. ♿ ACCESSIBILITY
================================================================================

Must satisfy WCAG AA

Keyboard Navigation

Focus Indicators

ARIA Labels

Semantic HTML

Responsive Design

Reduced Motion Support

Color Contrast Compliance

================================================================================
15. 📱 RESPONSIVE BREAKPOINTS
================================================================================

Mobile

320–767px

Tablet

768–1023px

Desktop

1024–1439px

Large Desktop

1440px+

================================================================================
16. 🔒 SECURITY CONSIDERATIONS
================================================================================

Firebase Authentication

Protected Routes

Role Validation

Client-side Validation

Server-side Validation

Upload Restrictions

MIME Validation

File Size Validation

Tracking Numbers never predictable

No sensitive data cached in browser

================================================================================
17. 🎯 DESIGN PRINCIPLES
================================================================================

The Parishioner Portal should feel:

- Welcoming
- Modern
- Calm
- Trustworthy
- Simple
- Accessible
- Ecclesiastical
- Mobile-first

The overall experience should minimize friction for parishioners while maintaining complete visual consistency with the TESTIMONIUM Admin Portal. Every workflow should require as few steps as possible without sacrificing clarity, and all interactions should guide users naturally from discovering parish information to requesting documents, tracking progress, scheduling appointments, and communicating with the AI assistant "Caloy".
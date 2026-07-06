Act as a Senior Frontend Software Engineer and UI/UX Engineer working in Antigravity Agent Mode.

We are beginning the frontend implementation of the TESTIMONIUM Secretary/Admin Portal.

==================================================
PROJECT CONTEXT
==================================================

Workspace:
testimonium-admin-portal

This phase focuses ONLY on recreating the frontend UI.

Do NOT integrate:

• Firebase Authentication
• Express Backend
• Supabase
• Prisma
• API calls
• React Query
• Authentication Logic

Everything must use local mock data.

The goal is to produce a production-quality frontend that is ready for backend integration later.

==================================================
SOURCE OF TRUTH
==================================================

The exported Figma images inside this workspace are the ONLY source of truth.

These include:

• Login - Parish Admin Portal
• Admin Dashboard
• Document Requests
• Schedule Requests
• Parish Calendar
• Notifications
• Activity Log
• TESTIMONIUM_Logo

Recreate every page as accurately as possible.

Do NOT redesign the UI.

Preserve:

• colors
• spacing
• typography
• shadows
• border radius
• icons
• tables
• cards
• badges
• filters
• search bars
• layout
• responsiveness

Mock data visible in the designs MUST be recreated exactly as static frontend data.

==================================================
TECH STACK
==================================================

Use:

React
TypeScript
Vite
Tailwind CSS
shadcn/ui
React Router DOM
React Hook Form
Zod
Lucide React

Do NOT install unnecessary libraries.

==================================================
PROJECT STRUCTURE
==================================================

Organize the project using scalable architecture.

src/

assets/
components/
layouts/
pages/
routes/
hooks/
contexts/
types/
mock/
utils/
styles/

Every reusable UI element must become its own component.

Examples:

Sidebar

Navbar

Page Header

Dashboard Card

Stat Card

Request Table

Search Bar

Notification Card

Calendar Widget

Status Badge

Pagination

Modal

Confirmation Dialog

Avatar

Profile Menu

Buttons

Inputs

Loading Skeletons

Empty State

==================================================
LAYOUT
==================================================

Create a reusable AdminLayout.

It must contain:

Sidebar

Top Navigation

Scrollable content area

Responsive behavior

Every authenticated page must use this layout.

The Login page must use a separate AuthLayout.

==================================================
ROUTING
==================================================

Configure React Router.

Routes:

/

Login

/dashboard

/document-requests

/schedule-requests

/calendar

/notifications

/activity-log

Use placeholder ProtectedRoute wrappers.

Do NOT implement authentication.

==================================================
MOCK DATA
==================================================

Create a dedicated mock folder.

Examples:

mock/

dashboard.ts

documentRequests.ts

scheduleRequests.ts

notifications.ts

calendar.ts

activityLog.ts

users.ts

Move ALL visible mock data from the Figma designs into these files.

Pages must consume mock data instead of hardcoded values.

Example:

const requests = documentRequests;

NOT:

const requests = [
...
]

inside the page.

==================================================
COMPONENT QUALITY
==================================================

Do NOT duplicate UI.

Extract reusable components.

Tables should be reusable.

Status badges should be reusable.

Cards should be reusable.

Dialogs should be reusable.

Forms should be reusable.

Buttons should be reusable.

Search bars should be reusable.

Filters should be reusable.

Pagination should be reusable.

==================================================
RESPONSIVENESS
==================================================

Support:

Desktop

Laptop

Tablet

Mobile

Maintain the same visual hierarchy as the Figma.

==================================================
DESIGN QUALITY
==================================================

The generated UI should look polished enough that someone unfamiliar with the project would assume it was hand-coded by an experienced frontend engineer.

Do not simplify layouts.

Do not omit sections.

Do not replace components with placeholders.

==================================================
CODE QUALITY
==================================================

Use:

Strict TypeScript

Functional Components

Reusable Props

Clean folder organization

Meaningful naming

No inline styles

No duplicated logic

No dead code

==================================================
DO NOT IMPLEMENT
==================================================

No backend calls

No Firebase

No authentication

No API clients

No Prisma

No Supabase

No database logic

No environment variables

No business logic

==================================================
DELIVERABLE
==================================================

Produce a fully navigable frontend application that accurately recreates every exported Figma screen using reusable React components and local mock data.

The project should be immediately ready for backend integration simply by replacing the mock data with API responses in a future phase.

==================================================
FINAL VERIFICATION
==================================================

Before finishing:

• Verify every exported Figma screen has been recreated.

• Verify routing works.

• Verify no page contains hardcoded UI duplicated from another page.

• Verify mock data is separated into dedicated files.

• Verify the application builds successfully.

• Verify there are no TypeScript errors.

• Verify there are no ESLint errors.

• Verify the codebase is modular, reusable, scalable, and production-ready.

Report any assumptions before implementation.
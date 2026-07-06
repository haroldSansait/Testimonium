# Phase 4 — Backend API Implementation

## Objective

Implement the REST API required by the Admin Portal frontend using the existing Prisma schema, Firebase authentication flow, repositories, services, and RBAC middleware.

Do not redesign the architecture.

Do not modify the database schema.

Do not create new Prisma migrations.

Do not recreate seed data.

Only expose the API endpoints required by the frontend.

---

## Requirements

Implement REST endpoints for:

### Authentication

GET /api/v1/auth/profile

Returns the currently authenticated application user after Firebase token verification.

---

### Dashboard

GET /api/v1/dashboard/stats

Return:

- pending document requests
- pending schedule requests
- documents needing correction
- ready for pickup

GET /api/v1/dashboard/schedule

Return today's upcoming events.

GET /api/v1/dashboard/alerts

Return recent alerts.

---

### Document Requests

GET /api/v1/document-requests

Supports:

- pagination
- search
- status filter
- document type filter

---

### Schedule Requests

GET /api/v1/schedule-requests

Supports:

- pagination
- status filter
- search

---

### Notifications

GET /api/v1/notifications

PATCH /api/v1/notifications/read-all

PATCH /api/v1/notifications/:id/read

---

### Calendar

GET /api/v1/calendar/events

Supports:

year

month

Returns all events for that month.

---

### Activity Log

GET /api/v1/activity-log

Supports:

- pagination
- personnel filter
- action filter
- date range

---

## Architecture Rules

Follow the existing architecture strictly.

Controller
↓

Service
↓

Repository
↓

Prisma

Controllers must never access Prisma directly.

Repositories contain all Prisma queries.

Services contain business logic.

Keep middleware responsibilities unchanged.

Continue using Firebase authentication.

Continue using RBAC middleware.

---

## API Response Format

Use consistent JSON responses.

Success:

{
  "success": true,
  "data": ...
}

Errors:

{
  "success": false,
  "message": "...",
  "error": ...
}

---

## Existing Database

Use the current schema exactly as-is.

Do not rename tables.

Do not rename enums.

Do not create migrations.

Do not change seed data.

---

## Verification

After implementation:

- npm run dev starts successfully
- Existing health endpoint still works
- Every endpoint responds correctly
- Role middleware continues working
- No Prisma validation errors
- No TypeScript or Node syntax errors
- Frontend API services can connect without modification

Do not modify the frontend. The frontend is considered complete and should work by simply consuming these backend endpoints.
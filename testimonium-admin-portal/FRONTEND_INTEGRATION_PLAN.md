# TESTIMONIUM Phase 3 — Frontend Integration & Authentication

## Overview

Integrate the Parish Admin Portal with the existing TESTIMONIUM backend.

This phase transitions the frontend from mock data into a production-ready architecture while preserving the existing UI implementation.

The objective is NOT to redesign any page.

The objective is to replace mock services with backend-powered services while maintaining the current component hierarchy.

---

# Existing Backend

Backend Stack

- Express.js
- Firebase Authentication
- Prisma ORM
- Supabase PostgreSQL
- Repository Pattern
- Service Layer
- JWT handled by Firebase ID Tokens
- Role-Based Access Control (RBAC)

Current backend features already implemented:

✓ Firebase token verification

✓ Just-In-Time Parishioner provisioning

✓ Staff account linking

✓ Role middleware

✓ Prisma database

✓ Health endpoint

✓ Roles

- PARISHIONER
- SECRETARY
- PRIEST
- DIOCESE_COORDINATOR

The frontend must integrate with this architecture exactly.

---

# Goals

Replace all mock services with backend-powered services.

Implement authentication.

Persist login state.

Protect routes.

Automatically attach Firebase ID Tokens to backend requests.

Support future expansion without changing page components.

---

# Architecture

Create the following folders if they do not already exist.

src/

    api/

        api.ts

        interceptors.ts

    context/

        AuthContext.tsx

    hooks/

        useAuth.ts

    services/

        AuthService.ts

        DashboardService.ts

        DocumentRequestService.ts

        ScheduleRequestService.ts

        NotificationService.ts

        CalendarService.ts

        ActivityLogService.ts

    types/

        auth.ts

        api.ts

    config/

        firebase.ts

---

# Environment Variables

Create

.env

Example

VITE_API_URL=http://localhost:5000/api/v1

VITE_FIREBASE_API_KEY=

VITE_FIREBASE_AUTH_DOMAIN=

VITE_FIREBASE_PROJECT_ID=

VITE_FIREBASE_STORAGE_BUCKET=

VITE_FIREBASE_MESSAGING_SENDER_ID=

VITE_FIREBASE_APP_ID=

Never hardcode URLs.

Never hardcode Firebase configuration.

---

# API Layer

Install Axios.

Create

api/api.ts

Responsibilities

- axios instance

- baseURL from VITE_API_URL

- timeout

- JSON headers

No request logic should exist elsewhere.

---

# Axios Interceptors

Create

api/interceptors.ts

Automatically

Before every request

- obtain Firebase ID Token

- attach

Authorization

Bearer <token>

Handle

401

403

gracefully.

Do not silently swallow errors.

---

# Firebase Configuration

Create

config/firebase.ts

Initialize Firebase only once.

Export

auth

for the entire application.

---

# Authentication Context

Create

AuthContext

Responsibilities

Maintain

currentUser

applicationUser

loading

role

signIn()

logout()

refreshUser()

The application user is the backend user profile returned after Firebase authentication.

---

# Auth Hook

Create

useAuth()

Expose

currentUser

applicationUser

loading

role

logout()

signIn()

This hook becomes the single authentication interface.

---

# Auth Service

Create

AuthService.ts

Responsibilities

Login using Firebase Authentication.

Retrieve Firebase ID Token.

Call backend authentication endpoint.

Receive application profile.

Cache user state.

Logout.

Never perform UI navigation.

---

# Backend Integration

Replace mock implementations inside

DashboardService

DocumentRequestService

ScheduleRequestService

NotificationService

CalendarService

ActivityLogService

with Axios requests.

The page components must remain unchanged.

Only service implementations should change.

---

# Protected Route

Replace placeholder implementation.

Requirements

If

not authenticated

redirect to Login.

If authenticated

allow navigation.

Future role restrictions should be simple to add.

---

# Login Page

Replace temporary login.

Requirements

Firebase email/password login.

Display loading state.

Display backend validation errors.

After login

navigate according to role.

Example

SECRETARY

Dashboard

PRIEST

Dashboard

DIOCESE_COORDINATOR

Dashboard

Future Parishioner application will have separate routing.

---

# Global Loading

Create reusable loading overlay.

Shown while

checking authentication

refreshing session

loading application profile

---

# Error Handling

Centralize API errors.

Never duplicate try/catch logic across pages.

Return typed errors from services.

---

# Remove Mock Dependencies

The following files should no longer provide production data.

mock/

Dashboard

Document Requests

Schedules

Notifications

Calendar

Activity Log

These may remain temporarily for testing but production services must no longer depend on them.

---

# Code Quality

Use

TypeScript

strict typing

async/await

React Context

Axios

No duplicated API logic.

No duplicated Firebase logic.

No duplicated authentication logic.

---

# Verification

Before completion

Run

npm install

npm run build

npx tsc --noEmit

Verify

✓ Login works

✓ Firebase authentication succeeds

✓ Backend receives Authorization header

✓ Backend validates Firebase token

✓ Backend returns application profile

✓ Protected routes function correctly

✓ Logout clears session

✓ Refresh preserves authentication

✓ No TypeScript errors

✓ No build errors

Do not modify existing UI designs.

Do not redesign layouts.

Do not change the component hierarchy unless required for authentication integration.

The current UI implementation should remain visually identical after integration.
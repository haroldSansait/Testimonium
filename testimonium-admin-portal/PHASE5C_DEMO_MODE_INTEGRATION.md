# Phase 5C — Data Provider Architecture & Demo Mode Integration

## Objective

Refactor the TESTIMONIUM Admin Portal to support multiple interchangeable data providers while preserving the existing frontend architecture.

Instead of replacing the backend with mock data or local storage, introduce a **Data Provider Architecture** that allows the application to switch between:

* **Demo Provider** (mock datasets)
* **API Provider** (Express Backend)
* **Hybrid Provider** (mix of Demo and API)

using configuration only.

The UI must remain completely unaware of which provider is active.

---

# User Review Required

> [!IMPORTANT]
> No backend modifications are allowed during this phase.

> [!IMPORTANT]
> Existing backend integrations completed in Phase 4 must remain fully functional.

> [!IMPORTANT]
> Existing service method signatures must not change.

> [!IMPORTANT]
> Existing RBAC, authentication, routing, dashboard layouts, and permissions must remain unchanged.

> [!IMPORTANT]
> This phase is purely an architectural improvement to support demonstrations and future backend integration.

---

# Architecture Goal

Current architecture:

```
Page

↓

Service

↓

Mock Data
```

Target architecture:

```
Page

↓

Service

↓

Data Provider

        ├── Demo Provider

        │      ↓

        │   Mock Data

        │

        ├── API Provider

        │      ↓

        │   Express Backend

        │

        └── Hybrid Provider

               ↓

      Mix of Demo + Backend
```

The page components must never know which provider is being used.

---

# 1. Demo Mode Configuration

## NEW

```
src/config/demo.ts
```

Create a centralized configuration module.

Example:

```
export const DEMO_MODE =
    import.meta.env.VITE_DEMO_MODE === "true";

export const DATA_PROVIDER =
    import.meta.env.VITE_DATA_PROVIDER;
```

Supported values:

```
demo

api

hybrid
```

No page should directly read environment variables.

Only the provider layer should.

---

# 2. Provider Interfaces

Create provider interfaces for every major module.

Examples:

```
DashboardProvider

NotificationProvider

DocumentProvider

ScheduleProvider

AnalyticsProvider

ParishProvider

UserProvider
```

Each provider exposes identical methods.

Example:

```
getUsers()

addUser()

editUser()

disableUser()

resetPassword()
```

The page components continue calling only the services.

---

# 3. Demo Providers

Create Demo Provider implementations using the existing mock datasets.

Examples:

```
DemoDashboardProvider

DemoAnalyticsProvider

DemoParishProvider

DemoUserProvider
```

All CRUD operations continue modifying the in-memory mock data exactly as implemented in Phase 5B.

No functionality should regress.

---

# 4. API Providers

Create API Provider implementations.

Examples:

```
ApiDashboardProvider

ApiAnalyticsProvider

ApiParishProvider

ApiUserProvider
```

Initially:

* reuse existing backend endpoints where available
* leave unimplemented endpoints as clearly marked TODOs

Do not fabricate backend endpoints that do not yet exist.

When an endpoint is unavailable, return a graceful placeholder rather than breaking the UI.

---

# 5. Hybrid Provider

Support mixed data sources.

Example configuration:

```
Dashboard

↓

Backend

Notifications

↓

Backend

Documents

↓

Backend

Schedules

↓

Backend

Parishes

↓

Demo

Users

↓

Demo

Analytics

↓

Demo
```

This allows unfinished modules to continue working during development.

The Hybrid Provider should determine, per module, whether requests are delegated to the Demo Provider or the API Provider.

---

# 6. Service Layer Refactor

Modify each service so that it delegates to the active provider.

Example:

```
UserManagementService

↓

Data Provider

↓

Demo or API
```

The public methods of every service must remain unchanged.

No UI component should require modification.

---

# 7. Provider Factory

## NEW

```
src/providers/providerFactory.ts
```

Centralize provider selection.

Example:

```
if (DATA_PROVIDER === "demo")

↓

return DemoUserProvider

if (DATA_PROVIDER === "api")

↓

return ApiUserProvider

if (DATA_PROVIDER === "hybrid")

↓

return HybridUserProvider
```

Every service obtains its provider through this factory.

---

# 8. Demo Mode Indicator

Display a small, unobtrusive badge in the Admin Portal.

Examples:

```
Demo Mode

Using Mock Data
```

```
API Mode

Connected to Backend
```

```
Hybrid Mode

Mixed Data Sources
```

This indicator should appear in the application layout so presenters always know which mode is active.

---

# 9. CRUD Compatibility

CRUD operations must behave identically regardless of provider.

Example:

```
User clicks

Add User

↓

UserManagementService.addUser()

↓

Provider

↓

Demo or API

↓

Promise resolves

↓

Table refreshes
```

The page should never know which provider handled the request.

---

# 10. Existing Mock Data

Do not remove any existing mock datasets.

Retain:

* Diocese mock data
* Parish mock data
* User mock data
* Analytics mock data

These datasets remain the source for the Demo Provider.

---

# 11. Backend Compatibility

The backend integration completed during Phase 4 must continue functioning.

When API mode is selected:

* authentication
* dashboard
* notifications
* schedules
* documents

must continue communicating with the backend exactly as before.

No regressions are allowed.

---

# 12. Future Backend Preparation

Design the providers so that future backend endpoints can replace Demo Providers with minimal effort.

When Phase 6 introduces endpoints for:

* Parish Management
* User Management
* Analytics

the implementation should only require updating the corresponding API Provider.

No page components or services should need modification.

---

# 13. Error Handling

API Providers should gracefully handle:

* network failures
* unavailable endpoints
* 401 responses
* 403 responses
* server errors

without crashing the application.

Demo Providers should always resolve successfully.

---

# 14. Documentation

Document the architecture.

Include:

* provider responsibilities
* switching providers
* adding new providers
* implementing future API endpoints
* hybrid workflow

This documentation should assist future developers during Phase 6.

---

# 15. Verification

Build verification:

```
npm run build

✓ 0 TypeScript errors
```

Manual verification:

## Demo Mode

* Login works.
* Dashboard loads mock data.
* CRUD works using mock providers.
* Existing UI behaves exactly as before.

## API Mode

* Login authenticates against Firebase.
* Dashboard loads backend data.
* Notifications load backend data.
* Documents load backend data.
* Existing backend integration remains intact.

## Hybrid Mode

* Backend-backed modules continue using live API data.
* Demo-backed modules continue using mock data.
* Navigation remains seamless.
* No page requires modification when switching modes.

---

# Expected Outcome

At the end of Phase 5C, the TESTIMONIUM Admin Portal will support three interchangeable operating modes:

* **Demo Mode** — Uses curated mock data for stable presentations and stakeholder demonstrations.
* **API Mode** — Connects directly to the Express backend and PostgreSQL for live application behavior.
* **Hybrid Mode** — Allows individual modules to use either mock data or backend APIs, enabling incremental development and testing.

This architecture ensures that demonstrations remain predictable while preserving full backend integration and making the transition to Phase 6 a matter of implementing additional API Providers rather than rewriting the UI.

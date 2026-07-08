# PHASE_6_BACKEND_IMPLEMENTATION.md

# Phase 6 --- Backend Completion Roadmap

> Goal: Replace remaining mock-backed coordinator modules with real
> backend integration while preserving the Provider Architecture
> (Demo/API/Hybrid).

------------------------------------------------------------------------

# Phase 6A --- Diocese Coordinator Backend APIs

**Objective** - Implement backend routes for Diocese Dashboard. -
Connect `ApiDioceseDashboardProvider` to live endpoints.

**Implement** - `/diocese/stats` - `/diocese/activity` -
`/diocese/notifications`

**Requirements** - Keep Demo Mode unchanged. - API Mode must use
PostgreSQL/Firebase. - Preserve provider/service signatures.

**Verify** - Coordinator dashboard loads real data in API Mode.

------------------------------------------------------------------------

# Phase 6B --- Parish Management Backend

**Objective** Replace mock parish CRUD with database CRUD.

**Implement** - GET parishes - GET parish by id - CREATE parish - UPDATE
parish - Archive/restore parish

**Requirements** - Seed the official 7 Vicariate of Canlaon parishes. -
CRUD must immediately reflect in API Mode. - Demo Mode continues using
mock provider.

**Verify** - Added/edited parishes persist after refresh.

------------------------------------------------------------------------

# Phase 6C --- User Management Backend

**Objective** Replace mock user management.

**Implement** - List users - Create user - Update user - Disable/Enable
user - Password reset endpoint

**Requirements** - Firebase Authentication + PostgreSQL remain
synchronized. - Creating a parish automatically provisions Secretary and
Priest accounts.

**Verify** - User CRUD persists and survives refresh/login.

------------------------------------------------------------------------

# Phase 6D --- Analytics Backend

**Objective** Replace analytics mock datasets.

**Implement** - Sacrament analytics - Document analytics - Parish
analytics - Financial analytics

**Requirements** - Dashboard cards consume live statistics. - Charts
update dynamically.

**Verify** - Analytics page contains no mock values in API Mode.

------------------------------------------------------------------------

# Phase 6E --- Integration & Synchronization

**Objective** Connect every provider to production APIs.

**Tasks** - Remove remaining API fallbacks. - Verify Provider Factory. -
Validate Demo/API/Hybrid switching. - Error handling and loading states.

**Verify** - All modules work correctly in every provider mode.

------------------------------------------------------------------------

# Phase 6F --- Data Quality & Production Readiness

**Objective** Prepare backend for deployment.

**Tasks** - Validation - Authorization checks - Audit logging -
Pagination/filtering - Performance optimization - Final seeders - API
documentation

**Verify** - Zero build errors. - Zero TypeScript errors. - Complete
end-to-end CRUD. - Ready for Website and Mobile App consumption.

------------------------------------------------------------------------

## Rules for Every Phase

-   Do **not** modify public service method signatures.
-   Preserve the Data Provider Architecture.
-   Demo Mode must always remain functional.
-   Hybrid Mode must remain configurable.
-   Backend changes must not break the Admin Portal UI.
-   After each sub-phase:
    -   Run `npm run build`
    -   Fix all TypeScript/build errors
    -   Provide a walkthrough and verification report before continuing.

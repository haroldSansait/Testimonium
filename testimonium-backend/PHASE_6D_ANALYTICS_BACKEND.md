# Implementation Plan - Phase 6D: Analytics Backend

Replace all remaining analytics mock data with live PostgreSQL-backed analytics while preserving the existing Data Provider Architecture (Demo / API / Hybrid).

---

## User Review Required

> [!IMPORTANT]
> **Scope**
>
> This phase replaces every analytics dataset with live backend aggregation except **Financial Analytics**, which will remain mocked until the financial subsystem is finalized.
>
> Demo Mode must remain unchanged.
>
> API Mode and Hybrid Mode will consume live backend analytics endpoints.

---

## Objectives

Implement a complete Analytics backend module that provides:

- Dashboard overview statistics
- Sacrament analytics
- Document analytics
- Parish analytics
- Monthly trends
- Status breakdowns
- Comparison datasets

Financial analytics are intentionally excluded.

---

# Backend Component

Follow the established architecture used throughout Phases 6A–6C.

```
Routes
    ↓
Controllers
    ↓
Services
    ↓
Repositories
    ↓
PostgreSQL (Prisma)
```

Create:

```
repositories/
    AnalyticsRepository.js

services/
    AnalyticsService.js

controllers/
    AnalyticsController.js

routes/
    analyticsRoutes.js
```

Mount:

```
/api/v1/analytics
```

---

# Endpoints

Implement:

```
GET /overview

GET /sacraments

GET /documents

GET /parishes
```

These endpoints should provide all data required by the existing Analytics page without changing frontend component APIs.

---

# Repository Responsibilities

Repositories perform database access only.

Implement methods similar to:

### Overview

- getOverallCounts()
- getActiveUsersCount()
- getActiveParishesCount()

---

### Sacrament Analytics

Aggregate totals for:

- Baptism
- Confirmation
- Marriage
- Funeral
- Communion
- Blessing

Return:

- total counts
- monthly counts
- yearly counts

---

### Document Analytics

Aggregate:

- pending
- approved
- rejected
- completed

Also return:

- monthly request totals
- request trends

---

### Parish Analytics

Return:

- requests grouped by parish
- sacramental records grouped by parish
- active users grouped by parish

---

Repository Rules

Repositories:

- execute Prisma queries only
- use groupBy/count aggregates
- no DTO formatting
- no chart formatting
- no percentages
- no labels
- no business logic

---

# Service Responsibilities

Business logic belongs only here.

Implement:

```
getOverview()

getSacramentAnalytics()

getDocumentAnalytics()

getParishAnalytics()
```

Service responsibilities:

- map repository results into frontend DTOs
- generate chart datasets
- calculate percentages
- generate labels
- compute totals
- compute monthly trend arrays
- normalize missing months to zero values
- preserve frontend interface contracts

No SQL belongs here.

---

# Controller Responsibilities

Create:

```
AnalyticsController.js
```

Implement:

- getOverview
- getSacraments
- getDocuments
- getParishes

Controllers remain thin.

Delegate everything to AnalyticsService.

---

# Routes

Create:

```
analyticsRoutes.js
```

Register:

```
GET /overview

GET /sacraments

GET /documents

GET /parishes
```

Protect every endpoint using:

```
authenticateFirebaseToken

checkRole([
    "DIOCESE_COORDINATOR"
])
```

---

# Server Registration

Modify:

```
server.js
```

Mount:

```
/api/v1/analytics
```

---

# Frontend Component

Modify only:

```
ApiAnalyticsProvider.ts
```

Replace placeholder implementations with live Axios requests.

Map:

```
GET /analytics/overview

GET /analytics/sacraments

GET /analytics/documents

GET /analytics/parishes
```

Do not modify:

- Analytics page
- Charts
- Cards
- Service signatures
- Provider interfaces

---

# Hybrid Configuration

Modify:

```
config/demo.ts
```

Set:

```
analytics: "api"
```

Demo mode remains untouched.

---

# Implementation Guidelines

Follow the same coding standards established in:

- Diocese Dashboard
- Parish Management
- User Management

Mirror:

- repository style
- controller style
- service style
- error handling
- response structure
- middleware order

---

## Performance Requirements

Use:

- Promise.all() where queries are independent
- Prisma aggregate/groupBy
- database-side counting
- database-side grouping

Avoid:

- N+1 queries
- unnecessary loops
- repeated queries

---

## Data Requirements

Analytics must be computed dynamically from:

- Sacramental Records
- Document Requests
- Schedule Requests
- Parish records
- User records

Do not use mock values.

Do not hardcode statistics.

---

## Explicitly Excluded

Do NOT implement:

- Financial analytics
- Revenue reports
- Payment summaries
- Offering statistics

These remain mocked until the financial module exists.

---

# Verification Plan

## Backend

Start backend:

```
npm run dev
```

Verify:

```
GET /analytics/overview

GET /analytics/sacraments

GET /analytics/documents

GET /analytics/parishes
```

using Postman or Insomnia.

Confirm:

- authentication
- authorization
- response format
- aggregation correctness

---

## Frontend

Run:

```
npm run build
```

Fix all TypeScript errors.

Run:

```
npm run dev
```

Login as:

```
coordinator@testimonium.org
```

Verify:

- Analytics dashboard loads live data
- KPI cards display database values
- Charts render correctly
- Monthly datasets populate dynamically
- Parish comparisons are live
- No placeholder values remain
- No console errors

---

## Provider Verification

Verify:

Demo Mode

↓

API Mode

↓

Hybrid Mode

Ensure Analytics behaves correctly in every provider mode.

Demo Mode must remain fully functional.

Hybrid Mode must consume live analytics endpoints.

---

# Success Criteria

- Zero mock analytics in API Mode
- Live PostgreSQL aggregation
- Zero TypeScript errors
- Zero build errors
- Preserved Provider Architecture
- No frontend API changes
- Ready for Website and Mobile App reuse
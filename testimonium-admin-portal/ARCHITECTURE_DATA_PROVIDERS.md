# TESTIMONIUM Admin Portal — Data Provider Architecture

This document describes the design, configuration, and implementation patterns for the Data Provider Architecture introduced in Phase 5C.

---

## Architecture Overview

The TESTIMONIUM Admin Portal is decoupled from direct backend or mock-data calls using a provider-based architecture:

```
Page Component (UI)
       ↓
Service Layer (public contracts)
       ↓
Provider Factory
       ↓
Resolved Provider (Demo or API)
```

The UI and page components consume only the **Service Layer** and are completely unaware of where the data originates. This allows switching between running fully offline with mock data, connecting directly to the backend APIs, or using a mix of both (Hybrid Mode) without altering a single UI component.

---

## 1. Operating Modes

The system operates in one of three modes, configured via the `VITE_DATA_PROVIDER` environment variable:

1. **Demo Mode** (`VITE_DATA_PROVIDER=demo`)
   - Uses curated mock data for stable presentations and stakeholder demonstrations.
   - All CRUD operations mutate stateful, in-memory arrays during the user session.
2. **API Mode** (`VITE_DATA_PROVIDER=api`)
   - Connects directly to the live Express backend and PostgreSQL database.
   - For modules where backend endpoints are not yet built (e.g. Parish Management, User Management, Analytics, and Diocese Dashboard), the API providers gracefully fall back to the mock datasets and print warnings to the console.
3. **Hybrid Mode** (`VITE_DATA_PROVIDER=hybrid`)
   - Allows individual modules to use either mock data or backend APIs dynamically based on a mapping configuration.

---

## 2. Configuration & Hybrid Mapping

The active provider mode and the Hybrid configuration are defined in [demo.ts](file:///c:/Users/me/Documents/testimonium/testimonium-admin-portal/src/config/demo.ts):

```typescript
export type ProviderMode = 'demo' | 'api';

// Configured from environment variable
export const DATA_PROVIDER = (import.meta.env.VITE_DATA_PROVIDER || 'demo').toLowerCase() as 'demo' | 'api' | 'hybrid';

// Module-level mapping for Hybrid Mode
export const HYBRID_CONFIG: Record<string, ProviderMode> = {
  dashboard: 'api',
  notifications: 'api',
  documents: 'api',
  schedules: 'api',
  calendar: 'api',
  activityLog: 'api',
  dioceseDashboard: 'demo',
  analytics: 'demo',
  parishes: 'demo',
  users: 'demo',
};
```

---

## 3. Provider Factory

The [providerFactory.ts](file:///c:/Users/me/Documents/testimonium/testimonium-admin-portal/src/providers/providerFactory.ts) acts as the single source of truth for provider resolution:

```typescript
const resolveProvider = <T>(
  moduleKey: string,
  demoInstance: T,
  apiInstance: T
): T => {
  if (DATA_PROVIDER === 'api') {
    return apiInstance;
  }
  if (DATA_PROVIDER === 'hybrid') {
    const mode = HYBRID_CONFIG[moduleKey] || 'demo';
    return mode === 'api' ? apiInstance : demoInstance;
  }
  return demoInstance;
};
```

Every service resolves its provider at runtime using this factory. For example:
```typescript
import { providerFactory } from '@/providers/providerFactory';

export const DashboardService = {
  async getStats() {
    return providerFactory.getDashboardProvider().getStats();
  }
};
```

---

## 4. How to Add or Replace API Providers (Phase 6 Workflow)

In Phase 6, when new backend endpoints (such as Diocese Parishes or User Management) are completed, future developers only need to update the corresponding API Provider file without changing any frontend UI pages or service method signatures.

### Steps to Replace a Placeholder API Provider:
1. Locate the API Provider (e.g., [ApiUserProvider.ts](file:///c:/Users/me/Documents/testimonium/testimonium-admin-portal/src/providers/api/ApiUserProvider.ts)).
2. Replace the delegated `DemoUserProvider` calls with actual Axios `api` HTTP requests (following the format in `ApiDocumentProvider` or `ApiScheduleProvider`).
3. If necessary, write a DTO mapper inside the file to translate backend database models into standard frontend interface types.
4. Update the [demo.ts](file:///c:/Users/me/Documents/testimonium/testimonium-admin-portal/src/config/demo.ts) `HYBRID_CONFIG` to map the module to `'api'` for testing and verification.

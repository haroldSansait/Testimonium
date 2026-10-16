# TESTIMONIUM Admin Portal ? Data Provider Architecture

The Admin Portal uses the existing API providers exclusively. Services and provider interfaces retain their public contracts.

## Architecture overview

```text
Page Component (UI)
       ?
Service Layer (public contracts)
       ?
Provider Factory
       ?
Existing Api*Provider
       ?
Backend API
```

Pages consume services, which resolve the existing API implementations through [providerFactory.ts](src/providers/providerFactory.ts). Every factory getter returns its corresponding API provider unconditionally, including dashboard, notifications, documents, schedules, calendar, activity log, diocese dashboard, analytics, parishes, users, and availability.

## Configuration

Configure `VITE_API_URL` and Firebase client credentials as documented in [SETUP.md](../SETUP.md). The backend and Firebase must be configured for the existing authenticated workflows.

Demo and Hybrid provider selection, their implementations, and the Admin mock datasets have been removed. `VITE_DATA_PROVIDER` and `HYBRID_CONFIG` are no longer read. There is no provider-selection setting or fallback to fabricated data; existing API error handling remains in effect.

The Parishioner Web Portal also uses its existing `apiServiceProvider` exclusively through [its factory](../testimonium-parishioner-web/src/providers/factory/index.ts). Its `getServiceProvider`, named `services`, and default exports are preserved. `VITE_PROVIDER_MODE` is no longer read.

## Service usage

```typescript
import { providerFactory } from '@/providers/providerFactory';

export const DashboardService = {
  async getStats() {
    return providerFactory.getDashboardProvider().getStats();
  }
};
```

## Maintaining providers

Keep provider interfaces in [interfaces.ts](src/providers/interfaces.ts) and service method signatures stable. Implement authorized backend integration changes in the corresponding [API provider](src/providers/api), using the established HTTP client and DTO mappings. Validate affected frontend contracts and builds. Adding a provider does not require any mode flag or module mapping.

# TESTIMONIUM Parishioner Mobile — Architecture

**Baseline:** 24 August 2026
**Target application:** `testimonium-parishioner-app`
**Runtime:** Expo SDK 57, React Native 0.86, React 19, TypeScript 6, Expo Router.

## 1. Architectural objective

The mobile app is a thin, native parishioner client communicating exclusively with the TESTIMONIUM `/api/v1` Express backend.

```text
Expo / React Native Parishioner App (Expo SDK 57)
        │
        │ Firebase Native Client Auth (@react-native-firebase/auth)
        │ Bearer Firebase ID Token + Idempotency-Key
        ▼
Express 5 REST API (/api/v1)
        │
        ├──> Prisma 7 ──> PostgreSQL (18 Models)
        ├──> Firebase Admin SDK (Token verification & user claims)
        ├──> Cloudflare R2 (Document attachments & payment receipts)
        └──> OCR Provider (Asynchronous receipt enrichment)
```

The mobile client never maintains direct database connections and never stores cloud storage credentials.

## 2. Implemented folder structure

```text
testimonium-parishioner-app/
├── app/                                 # Expo Router route hierarchy
│   ├── (auth)/                          # Unauthenticated auth routes
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── welcome.tsx
│   ├── (onboarding)/                    # Auth gating & compliance routes
│   │   ├── verify-email.tsx
│   │   ├── legal.tsx
│   │   └── profile-completion.tsx
│   ├── (app)/                           # Authenticated parishioner routes
│   │   ├── _layout.tsx                  # Root Stack (modals/drill-downs above tabs)
│   │   ├── (tabs)/                      # 5-tab bottom navigation
│   │   │   ├── _layout.tsx
│   │   │   ├── (home)/index.tsx
│   │   │   ├── (requests)/index.tsx
│   │   │   ├── (schedule)/index.tsx
│   │   │   ├── (parishes)/index.tsx
│   │   │   └── (profile)/index.tsx
│   │   ├── parishes/
│   │   │   └── [parishId].tsx           # Parish Detail
│   │   ├── requests/
│   │   │   ├── new.tsx                  # Document Request Wizard
│   │   │   └── [requestId]/
│   │   │       ├── index.tsx            # Request Detail & Timeline
│   │   │       └── payment.tsx          # Payment & Receipt Upload
│   │   ├── schedule/
│   │   │   ├── new.tsx                  # Scheduling Wizard
│   │   │   └── [id].tsx                 # Schedule Detail & Reschedule Response
│   │   ├── events/
│   │   │   ├── index.tsx                # Events List
│   │   │   └── [id].tsx                 # Event Detail
│   │   ├── notifications.tsx            # In-App Notifications Inbox
│   │   └── profile/
│   │       ├── edit.tsx                 # Edit Profile
│   │       ├── settings.tsx             # App Settings
│   │       ├── terms.tsx                # Terms of Service
│   │       └── privacy.tsx              # Privacy Policy
│   ├── +not-found.tsx
│   └── _layout.tsx                      # App root (Providers, Theme, Auth Gates)
├── src/
│   ├── components/
│   │   └── ui/                          # Reusable design system primitives
│   ├── features/                        # Domain feature modules
│   │   ├── auth/                        # Auth forms, legal modals, onboarding
│   │   ├── home/                        # Home dashboard & quick actions
│   │   ├── parishes/                    # Directory, search, details, api, queryKeys
│   │   ├── requests/                    # Wizard, cards, timeline, api, presentation
│   │   ├── schedule/                    # Wizard, slots, detail, api, presentation
│   │   ├── events/                      # Public event feed, cards, api, queryKeys
│   │   ├── notifications/               # Notification inbox, api, queryKeys
│   │   └── profile/                     # Profile details, settings, legal views
│   ├── services/
│   │   ├── api/                         # Centralized apiClient and normalized errors
│   │   ├── auth/                        # Native Google Sign-In adapter
│   │   └── media/                       # Image picker and HEIC-to-JPEG converter
│   ├── theme/                           # Colors, spacing, typography, ecclesiastical tokens
│   ├── types/                           # Shared domain and API contract types
│   ├── utils/                           # Date formatting, validators, presentation mappers
│   └── config/                          # Environment variables and typed configs
```

## 3. Layer boundaries and responsibilities

### Route layer (`app/`)
- Pure routing and parameter unpacking.
- Delegates all business logic and UI rendering to feature screens (`src/features/*`).
- Handles deep links and navigation stack composition.

### Feature layer (`src/features/*`)
- Encapsulates domain components, screens, hooks, query keys, and presentation mappers.
- Manages local form state, multi-step wizards, and optimistic UI transitions.
- Interacts with backend services exclusively through typed API functions.

### API & service layer (`src/services/*`)
- Centralizes HTTP requests, bearer token injection, `Idempotency-Key` headers, and timeout handling.
- Normalizes backend error payloads into strongly-typed `AppError` objects.
- Handles media conversions (HEIC to JPEG) and multipart upload payload construction.

### Server-state layer (TanStack Query)
- Controls caching, query deduplication, background revalidation, and mutation lifecycle.
- Uses structured query keys (`parishKeys`, `requestKeys`, `scheduleKeys`, `eventKeys`, `notificationKeys`).
- Immediately cancels and purges all queries upon sign-out to prevent cross-account cache leaks.

## 4. Error normalization and boundaries

All API and network errors are normalized into `AppError`:

```ts
export type AppErrorKind =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'AUTH'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'RATE_LIMIT'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'SERVER'
  | 'UNKNOWN';

export interface AppError {
  kind: AppErrorKind;
  status?: number;
  code?: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryable: boolean;
}
```

UI screens incorporate `ErrorBoundary` wrappers and `InlineError` retry components to ensure errors in one section (e.g. upcoming events) do not crash the entire application.

## 5. Auth and session state machine

The application evaluates authentication state deterministically via `useAuthBootstrap`:

```text
[App Launch]
    │
    ▼
[NO_FIREBASE_USER] ──> Render (auth) group
    │
    ▼ (Firebase user authenticated)
[BOOTSTRAP_CHECK] ──> GET /auth/profile
    │
    ├─> Needs Email Verification ──> (onboarding)/verify-email
    ├─> Needs Legal Acceptance    ──> (onboarding)/legal
    ├─> Needs Profile Details     ──> (onboarding)/profile-completion
    │
    ▼
[AUTHENTICATED_READY] ──> Render (app)/(tabs)
```

## 6. Concurrency and race condition prevention

- **Double-submit locking:** Action buttons and mutation triggers disable immediately upon invocation.
- **Idempotency keys:** Scheduling creations supply unique UUID `Idempotency-Key` headers matching backend database constraints.
- **Auth mutex:** `interactiveOperationRef` suppresses passive auth observer updates during active login, registration, or Google JIT flows.
- **Single-flight verification:** Foreground email verification checks are debounced to prevent concurrent token refresh races.
- **Session isolation:** Logout invalidates the active `generationRef`, cancels pending network queries, clears TanStack cache, and resets navigation state to auth root.

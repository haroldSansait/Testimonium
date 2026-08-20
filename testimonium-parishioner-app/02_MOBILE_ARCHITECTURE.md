# TESTIMONIUM Parishioner Mobile — Architecture

**Baseline:** 20 August 2026  
**Current scaffold:** `testimonium-parishioner-app` (Expo/React Native scaffold).

## 1. Architectural objective

Build the mobile app as a thin, native parishioner client over the existing TESTIMONIUM backend.

```text
Expo / React Native Parishioner App
        |
        | Firebase client authentication
        | Bearer Firebase ID token
        v
Express API /api/v1
        |
        +--> Prisma --> PostgreSQL
        +--> Firebase Admin token verification
        +--> Cloudflare R2
        +--> OCR provider for receipts
```

The app must never connect directly to PostgreSQL or use R2 credentials.

## 2. Source-of-truth boundaries

### Backend owns
- role and authorization outcome;
- tenant/staff access rules;
- profile record and profile-completion status;
- document requirements;
- document-request workflow state;
- fee snapshot;
- payment state;
- duplicate receipt evidence;
- OCR result persistence;
- staff verification;
- scheduling availability;
- slot capacity;
- conflicts;
- parish event visibility;
- notifications.

### Mobile owns
- native presentation;
- local form draft UI;
- navigation;
- temporary selection state;
- optimistic visual affordances only where rollback is safe;
- read-cache policy;
- camera/gallery/file acquisition;
- client-side validation for immediate UX feedback;
- accessibility;
- device-specific behavior.

### Firebase client owns
- authentication session/token lifecycle through the selected Firebase SDK integration.

Do not manually reproduce Firebase token persistence.

## 3. Recommended project shape

First inspect the existing scaffold before moving files. If no established feature structure exists, prefer:

```text
testimonium-parishioner-app/
├── app/ or src/navigation/              # route definitions only
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── feedback/
│   │   └── domain/
│   ├── features/
│   │   ├── auth/
│   │   ├── home/
│   │   ├── parishes/
│   │   ├── requests/
│   │   ├── payments/
│   │   ├── schedules/
│   │   ├── events/
│   │   ├── notifications/
│   │   └── profile/
│   ├── services/
│   │   ├── api/
│   │   ├── firebase/
│   │   └── media/
│   ├── hooks/
│   ├── state/
│   ├── theme/
│   ├── types/
│   ├── utils/
│   └── config/
├── assets/
├── app.json/app.config.*
└── package.json
```

If the scaffold already uses Expo Router, keep route files thin and place business/UI logic under feature modules. If it already uses React Navigation, do not migrate to Expo Router solely for style preference.

## 4. Layer rules

### Route/navigation layer
Responsible for:
- route composition;
- auth/onboarding gating;
- tab/stack layout;
- deep-link mapping.

Must not:
- call raw `fetch` directly;
- own business rules;
- duplicate API response normalization.

### Feature layer
Responsible for:
- feature screens;
- feature-specific hooks;
- forms;
- domain presentation.

### API/service layer
Responsible for:
- base URL;
- auth headers;
- safe JSON parsing;
- request IDs if used;
- timeout/abort handling;
- normalized errors;
- endpoint methods.

### Server-state layer
Recommended responsibility:
- queries;
- invalidation;
- freshness;
- deduplication;
- mutation lifecycle.

If TanStack Query is not already installed, evaluate it during scaffold audit. Do not install it blindly before confirming the existing stack.

### Local state
Use component state/context/lightweight store for:
- UI toggles;
- unsaved form draft;
- filter/sort state;
- temporary selections.

Do not mirror whole backend resources into a second permanent local store unless there is a demonstrated need.

## 5. API client design

Use a centralized API client.

Conceptual responsibilities:

```ts
api.request({
  method,
  path,
  body,
  signal,
  auth: true
})
```

For authenticated calls:
1. obtain the current Firebase user;
2. request a valid ID token from Firebase SDK;
3. send `Authorization: Bearer <token>`;
4. parse the standard `{ success, data, message, errors }` shape;
5. normalize failures into one app error type.

### 401 retry rule
At most one forced token refresh retry may be attempted for an authenticated request when appropriate.

Never create:
```text
401 -> refresh -> retry -> 401 -> refresh -> retry ...
```

After one failed refresh/retry:
- invalidate app auth state;
- route to reauthentication/session-expired UX.

### Mutation retry rule
Do not automatically retry non-idempotent POST/PATCH/PUT/DELETE requests after ambiguous transport failure unless the endpoint explicitly supports idempotency.

Why:
- a request may have reached the server even if the client did not receive the response;
- automatic retries can create duplicate drafts, uploads, or schedule requests.

For an ambiguous mutation failure:
1. show recoverable error;
2. refetch relevant resource/state where possible;
3. let the user retry intentionally.

## 6. Auth bootstrap state machine

Avoid the class of race previously seen on web between Firebase auth observers and backend login/profile bootstrap.

Recommended conceptual states:

```text
BOOTING
NO_FIREBASE_USER
FIREBASE_USER_PENDING_BACKEND
BACKEND_PROFILE_READY
PROFILE_COMPLETION_REQUIRED
EMAIL_VERIFICATION_REQUIRED
AUTHENTICATED_READY
SESSION_ERROR
```

### Existing/restored Firebase session
```text
Firebase restores user
-> GET /auth/profile
-> store authoritative BackendUserProfile
-> route based on backend + Firebase verification state
```

### Interactive sign-in
```text
user initiates sign-in
-> Firebase sign-in
-> interactive backend POST /auth/login owns bootstrap/login semantics
-> set authoritative profile
-> observer must not race and overwrite with stale profile
```

Use an explicit in-flight guard/shared promise if needed after inspecting the actual scaffold.

## 7. Error model

Use a normalized app error structure, for example:

```ts
type AppError = {
  kind:
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
  status?: number;
  code?: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryable: boolean;
};
```

Do not expose raw stack traces, SQL, Prisma errors, Firebase internals, or R2 credentials.

## 8. Boundary between DTOs and UI models

Do not let raw API response shapes leak everywhere.

Use:
- endpoint response types;
- small mappers/normalizers where needed;
- domain view models only when presentation needs differ.

Avoid massive generic "ApiData" types.

## 9. Feature dependency direction

Preferred:

```text
screens
  -> feature hooks
      -> API/domain services
          -> auth/config utilities
```

Avoid:

```text
API service -> screen component
```

and avoid circular feature dependencies.

## 10. Forms

For multi-step requests:
- keep one draft model;
- validate each step for UX;
- revalidate full payload before network mutation;
- treat backend validation as final;
- preserve draft in memory during navigation;
- if local persistence of drafts is later added, classify fields and avoid storing unnecessary sensitive data.

Do not persist uploaded file blobs/URIs indefinitely.

## 11. Race-condition rules

### Double submission
Disable all duplicate submit paths while a mutation is in flight.

### Scheduling
Never treat a previously loaded slot as guaranteed. Backend can reject due to concurrent booking. On conflict:
- explain slot is no longer available;
- refetch slots;
- return user to slot selection.

### Profile
After mutation, use returned authoritative profile or refetch before leaving onboarding.

### Requests/payment
After mutation, update cache from returned data or invalidate/refetch. Do not locally invent next status.

### Logout
Cancel/ignore late protected queries so an old response cannot repopulate protected state after logout.

## 12. Performance principles

- Lazy-load heavy feature screens where supported.
- Avoid loading full request histories for cards.
- Paginate/list incrementally if backend supports it.
- Compress/resize display images for rendering, but do not silently alter evidence uploads.
- Memoize only measured hotspots.
- Do not prefetch every parish/request on launch.

## 13. Observability

Development:
- structured console logging behind a development guard;
- never log auth tokens, receipt OCR raw text, private document URLs, or full sensitive payloads.

Production:
- if crash reporting is introduced, redact PII and auth/session data.
- attach app version/build and request correlation ID if backend exposes one.

## 14. Web parity rule

"Parity" means equivalent capability and business behavior, not identical layout.

Mobile may intentionally use:
- bottom tabs instead of sidebar;
- sheets instead of desktop modals;
- native date/time pickers;
- camera/gallery actions;
- mobile map gestures.

Do not port desktop DOM/component architecture into React Native.

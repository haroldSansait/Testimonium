# TESTIMONIUM Parishioner Mobile — Engineering Rules

**Status:** Binding baseline for mobile development and maintenance.
**Last reconciled:** 24 August 2026

## 1. General principles

1. The backend Express API and PostgreSQL Prisma schema are the operational source of truth.
2. The mobile app is a client of the existing backend; do not create duplicate business rules or client-side authority engines.
3. Keep feature modules self-contained within `src/features/*` and routes thin inside `app/*`.
4. Always handle loading, empty, error, and retry states for all async and server-dependent UI.
5. All mutations must guard against double-taps and concurrent submission races.
6. Verify all code changes with TypeScript (`npm run typecheck`), ESLint (`npm run lint`), and Jest test suites (`npm test -- --runInBand`).

## 2. Security and credentials

Never:
- ship backend Firebase Admin private keys or service accounts;
- ship Cloudflare R2 access keys or secret tokens;
- ship database credentials or direct connection strings;
- connect directly to PostgreSQL or Supabase from the client;
- manually store Firebase ID tokens or refresh tokens in insecure storage;
- put backend secrets into `EXPO_PUBLIC_*` environment variables;
- trust client-supplied role or tenancy parameters for authorization;
- log tokens, passwords, raw OCR text, or sensitive document attachments.

## 3. Authentication and session lifecycle

- Native Firebase client authentication (`@react-native-firebase/auth`) proves identity.
- The TESTIMONIUM backend resolves and enforces the application role (`PARISHIONER` required).
- Interactive login and registration use explicit backend endpoints (`POST /auth/login`, `POST /auth/register`).
- Restored sessions fetch the current backend profile (`GET /auth/profile`).
- An active `interactiveOperationRef` mutex must suppress passive `onAuthStateChanged` listeners during login and registration.
- On sign-out, immediately cancel pending queries, clear TanStack cache, clear local session state, and sign out Firebase and Google SDKs.
- Token refresh on `401 Unauthorized` is limited to exactly one single-flight attempt; never loop token refreshes.

## 4. API communication and error handling

- Centralize all requests through `src/services/api/apiClient.ts`.
- Attach `Authorization: Bearer <firebase-id-token>` and optional `Idempotency-Key` headers.
- Parse backend error responses and normalize them into typed `AppError` objects.
- Do not automatically retry non-idempotent mutations after ambiguous network transport failures.
- Distinctly handle 400 (Validation), 401 (Auth), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 413 (File Too Large), 429 (Rate Limit), and 5xx (Server Error).

## 5. Document request and payment rules

- Document fees must be displayed directly from the backend request fee snapshot.
- Supporting document uploads allow PDF, PNG, JPEG, and WebP (up to 5 MB per file, max 5 files).
- Receipt uploads accept JPEG and PNG (up to 5 MB, max 1 file).
- iOS HEIC/HEIF images must be converted client-side to standard JPEG before transmission to the receipt endpoint.
- OCR results are asynchronous evidence enrichment; never display "Payment Verified" to the user until the backend transaction state is explicitly confirmed by staff.
- Correction notes and required checklist IDs must be sourced directly from the backend request payload.

## 6. Scheduling and calendar rules

- Available slots must be fetched dynamically from `GET /schedule-requests/available-slots`.
- Parish scheduling configuration (enabled canonical services, time slots, daily/per-slot limits) is authoritative from `GET /schedule-requests/configuration`.
- Schedule creations must provide an `Idempotency-Key` header to prevent duplicate slot bookings.
- When slot conflicts occur, refetch slots and present clear, actionable messaging to the user.
- Date and time formatting must use canonical Manila timezone helpers (`src/utils/date.ts`).

## 7. Media and temporary file management

- Clean up temporary converted image files from device storage after upload completion or cancellation.
- Never write private document uploads or payment receipts to the user's public device photo gallery.
- Show clear file previews (filename, size, type) before initiating uploads.
- When progress bytes are unavailable, use accessible indeterminate loading indicators rather than simulated percentages.

## 8. UI, accessibility, and navigation

- Maintain a minimum touch target of 44×44 pt for all interactive controls.
- Provide descriptive `accessibilityLabel` attributes for all icon-only buttons.
- Ensure text scales gracefully with system accessibility font scaling.
- Never use color alone to convey workflow or validation status.
- Modal back navigation must provide safe tab-root fallbacks (`navigateBackOrReplace`).
- Use the canonical ecclesiastical color palette (`#7B1C2A` primary maroon accent) across components.

## 9. Definition of done

A feature is considered done when:
1. It adheres to the authoritative backend contract.
2. It enforces secure auth and role boundaries.
3. It includes robust loading, empty, and error handling states.
4. It passes all unit and integration tests, TypeScript typechecks, and linter rules.
5. All relevant documentation in this pack is updated to reflect the change.

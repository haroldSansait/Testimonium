# TESTIMONIUM Deployment Guide

**Last reconciled:** 8 October 2026

Deploy the backend, the two Vite web applications, and the Expo mobile application independently. All browser and mobile requests target the same backend API version, currently `/api/v1`.

## Production topology

```text
app.example.org   -> parishioner-web/dist (SPA)
admin.example.org -> admin-portal/dist (SPA)
api.example.org   -> reverse proxy -> Node/Express :5000
                                   -> PostgreSQL/Supabase, Firebase Admin, R2 (Public & Private Identity), OCR.Space, SMTP, Gemini AI
Mobile App        -> Expo Native / EAS -> api.example.org/api/v1
```

Use TLS for every public origin. Configure `CORS_ORIGINS` with the exact deployed portal origins.

## Backend configuration

Create `testimonium-backend/.env` using its `.env.example`. The application requires a database URL, Firebase Admin credentials, and R2 credentials to start correctly.

| Variable group | Required production settings |
| --- | --- |
| Runtime | `NODE_ENV=production`, `PORT`, `TRUST_PROXY=1`, `CORS_ORIGINS` |
| Database | `DATABASE_URL` or `SUPABASE_DATABASE_URL`; set `DATABASE_URL` for Prisma CLI compatibility |
| Firebase Admin | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, public-asset `R2_BUCKET_NAME`, distinct non-public `R2_IDENTITY_BUCKET_NAME`, `R2_PUBLIC_URL` |
| OCR | `OCR_ENABLED`, `OCR_PROVIDER`; when `ocrspace`, also `OCR_SPACE_API_KEY` and optional size/timeout/retry settings |
| Transactional Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_GREETING_TIMEOUT_MS`, `SMTP_SOCKET_TIMEOUT_MS` |
| Email Worker | `EMAIL_WORKER_POLL_MS`, `EMAIL_WORKER_BATCH_SIZE`, `EMAIL_WORKER_LEASE_SECONDS`, `EMAIL_MAX_ATTEMPTS` |
| AI / RAG Chatbot | `CHATBOT_ENABLED` (boolean, default `false` until verified), `GEMINI_API_KEY`, `AI_GENERATION_PROVIDER` (`gemini`), `AI_GENERATION_MODEL` (`gemini-3.5-flash-lite`), `CALOY_ALLOWED_GENERATION_MODELS` (optional allowlist), `AI_SEMANTIC_ROUTER_MODEL` (`gemini-3.5-flash-lite`), `AI_EMBEDDING_PROVIDER` (`gemini`), `AI_EMBEDDING_MODEL` (`gemini-embedding-2`), `AI_EMBEDDING_DIMENSIONS` (`768`), `CHATBOT_MIN_SIMILARITY` (default `0.65`), `CHATBOT_MAX_CONTEXT_CHUNKS` (`4`), `CHATBOT_WORKER_POLL_MS`, `CHATBOT_WORKER_BATCH_SIZE`, `CHATBOT_WORKER_LEASE_SECONDS`, `CHATBOT_LOG_RAW_TEXT` (`false` for privacy) |
| Protection & Policy | `ADMIN_EMAIL_VERIFICATION_REQUIRED`, `GOVERNMENT_ID_RATE_LIMIT_MAX` (default `6`), `GOVERNMENT_ID_RATE_LIMIT_WINDOW_MS` (default `600000`), general rate-limit maxima, and `RATE_LIMIT_STORE` as appropriate for the deployment topology |
| Maintenance | `ENABLE_ACTIVITY_PURGE=false`, `ACTIVITY_LOG_RETENTION_DAYS=365` |

Never set `ENABLE_DEV_AUTH=true` in production. It bypasses Firebase token verification.

## Portal and mobile client configuration

Vite and Expo variables are embedded at build time. Set them in each client’s environment before building.

| Client | API setting | Provider setting | Other required settings |
| --- | --- | --- | --- |
| Parishioner web | `VITE_API_BASE_URL=https://api.example.org/api/v1` | `VITE_PROVIDER_MODE=api` | Firebase client variables; optional `VITE_ADMIN_PORTAL_URL` |
| Admin portal | `VITE_API_URL=https://api.example.org/api/v1` | `VITE_DATA_PROVIDER=api` | Firebase client variables |
| Parishioner mobile | `EXPO_PUBLIC_API_BASE_URL=https://api.example.org/api/v1` | N/A (direct API) | `google-services.json` (Android) / GoogleService-Info.plist (iOS) |

Client variables are public configuration. Never put service-account keys, R2 secrets, or database URLs in them.

## Release procedure

1. Install pinned dependencies across workspace components:

   ```bash
   npm ci
   npm ci --prefix testimonium-backend
   npm ci --prefix testimonium-parishioner-web
   npm ci --prefix testimonium-admin-portal
   npm ci --prefix testimonium-parishioner-app
   ```

2. Apply database migrations before starting code that depends on them using the direct PostgreSQL migration connection (normally port 5432 via direct `DATABASE_URL`, not through transaction poolers on port 6543):

   ```bash
   cd testimonium-backend
   npx prisma migrate status
   npx prisma migrate deploy
   npx prisma generate
   ```

   *Note: Ensure all recent migrations through `20260928180000_enforce_single_mother_parish`, `20260929210000_add_government_id_verification` (which provisions `government_id_verifications` table, indexes, and enums), and `20261004120000_add_legal_policies` (which provisions `legal_policies` table, `LegalPolicyType` enum, and seeds v1.0 Terms and Privacy policies) are fully applied before running application services.*

3. Start or restart the backend with a process manager. Example PM2 command:

   ```bash
   pm2 start server.js --name testimonium-api --cwd /srv/testimonium/testimonium-backend
   pm2 save
   ```

4. Build and publish each frontend’s `dist/` directory:

   ```bash
   npm run build --prefix testimonium-parishioner-web
   npm run build --prefix testimonium-admin-portal
   ```

5. Build and submit mobile application releases using EAS CLI:

   ```bash
   cd testimonium-parishioner-app
   # Production Android build (AAB)
   eas build --platform android --profile production
   # Preview / internal distribution build (APK)
   eas build --platform android --profile preview
   ```

   *Note: The mobile app requires native camera permissions (`permissions: ["CAMERA"]`, `minSdkVersion: 26` configured in `app.config.ts`) to operate the interactive camera scanner and card detector (`GovernmentIdCameraScanner`). Verify EAS build profiles configure these native permissions correctly.*

6. Verify `GET /api/v1/health`, an authenticated portal session, an R2 upload in a non-production test request, secure attachment downloads, Government ID verification flow, and reverse-proxy SPA fallbacks.

## Reverse-proxy requirements

- Proxy `/api/` to the backend; preserve `Authorization`, `Host`, and forwarding headers.
- Support unbuffered streaming for file downloads (`/requests/:id/attachments/:attachmentId/download`, `/document-requests/:id/attachments/:attachmentId/download`, `/users/:id/identity/front-image`, and `/users/:id/identity/back-image`).
- Serve each Vite `dist/` directory with `try_files $uri $uri/ /index.html` so client-side routes work after refresh.
- Set a body-size limit of at least 5 MB. Current general attachment, receipt, and Government ID limits are 5 MB per file; payment QR uploads and council officer portrait uploads are limited to 2 MB.
- Enable `TRUST_PROXY=1` only when the proxy correctly supplies forwarding headers.

## Background workers (Email Outbox, Knowledge Embedding & Caloy Telemetry Retention)

The API process starts three dedicated background workers after initializing the HTTP listener, and stops all gracefully before disconnecting Prisma on server shutdown (`SIGINT`, `SIGTERM`):
1. **`EmailOutboxWorker`**: Processes the PostgreSQL transactional email outbox. Multiple API replicas are supported: workers claim due rows with `FOR UPDATE SKIP LOCKED` and complete them only when their processing token still owns the active lease. The worker processes all seven `EmailType` notification triggers across document and scheduling workflows while honoring recipient user preferences (`email_notifications_enabled`). Configure bounded SMTP timeouts and credentials in the deployment secret manager.
2. **`knowledgeEmbeddingWorker`**: Periodically polls for `CONFIRMED` knowledge sources with chunks in `PENDING` status (`CHATBOT_WORKER_POLL_MS`, default 10s). Uses `FOR UPDATE SKIP LOCKED` with unique processing tokens and expiring leases (`CHATBOT_WORKER_LEASE_SECONDS`) to safely calculate 768-dimensional embeddings via Gemini `gemini-embedding-2` without race conditions across clustered instances. Transitions chunks to `READY` or `FAILED` with retry backoff.
3. **`CaloyTelemetryRetentionWorker`**: Startup starts a one-minute scheduler; it does not schedule an unconditional startup purge. Automatic deletion is eligible only during 03:00-03:59 Asia/Manila and at most once per Manila calendar day. Instances claim `CALOY_TELEMETRY_RETENTION:YYYY-MM-DD` for the daily decision, then both automatic and manual callers must claim and renew the global `CALOY_TELEMETRY_PURGE` lease while deleting in 5,000-row batches. Lease expiry uses the PostgreSQL clock, and loss of ownership stops future batches. Successful daily markers remain claimed; failed attempts release the marker for retry. Runtime-config database uncertainty always skips destructive retention. Retention is disabled by default (`automaticRetentionEnabled=false`) and accepts 14-365 days.

## AI / RAG Chatbot deployment and worker sequence

The Caloy chatbot and Knowledge Base follow a strictly additive, phased rollout order:
1. **Additive Migration**: Apply migration `20260910120000_add_rag_chatbot` to enable the `pgvector` extension, add `vector(768)` columns, knowledge tables, and enums.
2. **Caloy Control Center Migration**: Apply migration `20260913150000_add_caloy_control_center` to create `caloy_runtime_config` (unseeded, empty table), `system_leases`, `ai_usage_events`, and add `response_type` and `trace_id` to `chatbot_logs`.
3. **Backend Deployment**: Deploy the API with `CHATBOT_ENABLED=false` (safe default). In this state, the server starts normally without requiring Gemini credentials, and public queries return safe unavailable responses. Admin endpoints under `/api/v1/chatbot/admin/*` remain fully accessible to Diocese Coordinators.
4. **Admin Portal Deployment**: Deploy the Admin Portal with the centralized Caloy Control Center (`/caloy`, Overview, Analytics, Knowledge Base, AI Settings, Logs). Legacy `/knowledge-base` and `/knowledge-base/:id` routes automatically redirect via client-side replace navigation to `/caloy/knowledge-base` and `/caloy/knowledge-base/:id`. Conversation Review is completely excluded.
5. **Secret Configuration**: Configure `GEMINI_API_KEY` in the backend environment/secret manager for controlled development/staging.
6. **Corpus Ingestion**: Ingest reviewed knowledge procedures via `node scripts/import_knowledge.js --file corpus/initial_corpus.json` (always imported as `DRAFT` + `PROVISIONAL`).
7. **Governance Lifecycle**: In the Admin Portal, the Diocese Coordinator reviews and confirms sources (`CONFIRMED`). The background embedding worker embeds current-version chunks into `READY` status. Once all chunks are ready, the Coordinator publishes the source (`ACTIVE`).
8. **Runtime Configuration Semantics**: A successful database read returning no row resolves settings from validated environment values (`runtimeOverridePresent: false`, `version: 0`). A later read failure uses the immutable last-known-good snapshot and exposes degraded status; a cold read failure disables Caloy and automatic retention. Environment values must not masquerade as a verified database fallback. The first coordinator save atomically creates singleton row `id=1` with `expectedVersion=0`; later saves use optimistic concurrency. Settings mutation and its required audit are one transaction.
9. **Model Switching, Readiness & Concurrency**: The response generation model can be switched only within the deliberate known-compatible server catalog; neither `CHATBOT_GENERATION_MODEL` nor `CALOY_ALLOWED_GENERATION_MODELS` can introduce an unknown model. Runtime fallbacks are also catalog-validated, and missing Gemini credentials keep Caloy unavailable. Per-model immutable adapter/composer factories isolate concurrent requests. Semantic routing and embeddings remain fixed/read-only. The configured 5-28 second chatbot deadline is one monotonic budget shared by all AI work and retries.
10. **Telemetry & Privacy**: All provider calls (including retry attempts) record privacy-safe telemetry in `ai_usage_events`. Admin logs API returns metadata only and never exposes raw questions, responses, user IDs, session IDs, or API secrets.
11. **Public Enablement**: Switch `CHATBOT_ENABLED=true` in production only after owner sign-off.

The additive migration `20260913150000_add_caloy_control_center` must be applied by the deployment owner before real Control Center QA. Source validation does not prove PostgreSQL lease concurrency, migration application, live HTTP behavior, real Gemini calls, or browser/device behavior.

## Legal Policies Rollout Sequence

Legal policies require a coordinated multi-tier deployment sequence to prevent user lockouts or version mismatches:
1. **Database Migration:** Apply migration `20261004120000_add_legal_policies` to create the `legal_policies` table, enum `LegalPolicyType`, and seed initial Terms of Service v1.0 and Privacy Policy v1.0 effective 2026-08-01.
2. **Backend Deployment:** Deploy Express backend providing `GET /api/v1/legal-policies/current`, coordinator management routes (`GET /manage`, `PATCH /:policyType`), and registration/JIT legal acceptance version verification.
3. **Parishioner Web Deployment:** Deploy Parishioner Web portal containing `LegalGate`, updated registration workflow, and legal acceptance modals.
4. **Mobile Release:** Deploy Expo mobile client with native legal onboarding and policy viewer screens.
5. **Admin Portal Deployment:** Deploy Admin Portal containing the Legal Policies Editor under Settings (`/settings`), guarded by `MANAGE_LEGAL_POLICIES` (restricted to Diocese Coordinator). Coordinators may edit and publish revised policy versions (`v{revision}.0`) only after client versions supporting dynamic policy gates are live.

## Operational checks and rollback

- Keep database backups and verify a restore path before migrations; see [DATABASE.md](DATABASE.md).
- Back out an application release by serving the previous frontend build and restarting the previous backend release. Do not reverse a migration unless a tested down-migration or restore plan exists.
- Monitor API health, structured backend logs, R2 upload errors, OCR failures, and rate-limit behavior after release.
- Ensure that `R2_IDENTITY_BUCKET_NAME` is configured as a dedicated private bucket distinct from `R2_BUCKET_NAME` with no public domain or R2.dev access. Verify that coordinator image streaming routes (`/users/:id/identity/front-image` and `/users/:id/identity/back-image`) stream securely and return `404 IDENTITY_IMAGE_NOT_FOUND` on missing files and `503 IDENTITY_STORAGE_UNAVAILABLE` on storage errors.
- For production identity verification, ensure `OCR_ENABLED=true`, `OCR_PROVIDER=ocrspace`, and `OCR_SPACE_API_KEY` are valid; the stub OCR provider is strictly rejected for Government ID verification. Verify that card side diagnostics (`FRONT_IS_BACK`, `BACK_IS_FRONT`, `SIDES_SWAPPED`, etc.) and rate limits operate correctly.
- Verify `GET /api/v1/legal-policies/current` returns authoritative Terms and Privacy policies in plain text, and that the reverse proxy permits unauthenticated access.
- `RATE_LIMIT_STORE=memory` is process-local; use a shared strategy before horizontally scaling rate-limited API instances.
- Ensure that the single Mother Parish invariant (`parishes_single_mother_parish_idx`) is respected during seed operations and parish modifications.
- Note that Priests have parish-scoped read-only access to document requests, and document status changes to `READY_FOR_SIGNING` trigger an in-app notification to the active primary priest.

For R2 CORS and lifecycle configuration, see [CLOUDFLARE_R2.md](CLOUDFLARE_R2.md).

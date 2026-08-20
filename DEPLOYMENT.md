# TESTIMONIUM Deployment Guide

**Last reconciled:** 20 August 2026

Deploy the backend and the two Vite applications independently. All browser requests must target the same backend API version, currently `/api/v1`.

## Production topology

```text
app.example.org -> parishioner-web/dist
admin.example.org -> admin-portal/dist
api.example.org -> reverse proxy -> Node/Express :5000
                                  -> PostgreSQL/Supabase, Firebase Admin, R2, OCR.Space (optional)
```

Use TLS for every public origin. Configure `CORS_ORIGINS` with the exact deployed portal origins.

## Backend configuration

Create `testimonium-backend/.env` using its `.env.example`. The application requires a database URL and Firebase Admin credentials to start correctly. R2 is required for the implemented file-upload flows.

| Variable group | Required production settings |
| --- | --- |
| Runtime | `NODE_ENV=production`, `PORT`, `TRUST_PROXY=1`, `CORS_ORIGINS` |
| Database | `DATABASE_URL` or `SUPABASE_DATABASE_URL`; set `DATABASE_URL` for Prisma CLI compatibility |
| Firebase Admin | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| OCR | `OCR_ENABLED`, `OCR_PROVIDER`; when `ocrspace`, also `OCR_SPACE_API_KEY` and optional size/timeout/retry settings |
| Protection | rate-limit maxima and `RATE_LIMIT_STORE` as appropriate for the deployment topology |

Never set `ENABLE_DEV_AUTH=true` in production. It bypasses Firebase token verification.

## Portal configuration

Vite variables are embedded at build time. Set them in each portal’s environment before building.

| Portal | API setting | Provider setting | Other required settings |
| --- | --- | --- | --- |
| Parishioner web | `VITE_API_BASE_URL=https://api.example.org/api/v1` | `VITE_PROVIDER_MODE=api` | Firebase client variables; optional `VITE_ADMIN_PORTAL_URL` |
| Admin portal | `VITE_API_URL=https://api.example.org/api/v1` | `VITE_DATA_PROVIDER=api` | Firebase client variables |

`VITE_*` values are public client configuration. Never put service-account keys, R2 secrets, or database URLs in them.

## Release procedure

1. Install pinned dependencies:

   ```bash
   npm ci
   npm ci --prefix testimonium-backend
   npm ci --prefix testimonium-parishioner-web
   npm ci --prefix testimonium-admin-portal
   ```

2. Apply database migrations before starting code that depends on them:

   ```bash
   cd testimonium-backend
   npx prisma migrate deploy
   npx prisma generate
   ```

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

5. Verify `GET /api/v1/health`, an authenticated portal session, an R2 upload in a non-production test request, and the reverse-proxy SPA fallback.

## Reverse-proxy requirements

- Proxy `/api/` to the backend; preserve `Authorization`, `Host`, and forwarding headers.
- Serve each Vite `dist/` directory with `try_files $uri $uri/ /index.html` so client-side routes work after refresh.
- Set a body-size limit of at least 5 MB. Current general attachment and receipt limits are 5 MB per file; payment QR uploads are limited to 2 MB.
- Enable `TRUST_PROXY=1` only when the proxy correctly supplies forwarding headers.

## Operational checks and rollback

- Keep database backups and verify a restore path before migrations; see [DATABASE.md](DATABASE.md).
- Back out an application release by serving the previous frontend build and restarting the previous backend release. Do not reverse a migration unless a tested down-migration or restore plan exists.
- Monitor API health, structured backend logs, R2 upload errors, OCR failures, and rate-limit behavior after release.
- `RATE_LIMIT_STORE=memory` is process-local; use a shared strategy before horizontally scaling rate-limited API instances.

For R2 CORS and lifecycle configuration, see [CLOUDFLARE_R2.md](CLOUDFLARE_R2.md).

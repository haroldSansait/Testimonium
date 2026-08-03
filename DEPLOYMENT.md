# TESTIMONIUM Production Deployment Manual

This manual provides a comprehensive, step-by-step guide for deploying the TESTIMONIUM platform to production across all tiers: **Backend API**, **Admin Portal**, and **Parishioner Web Portal**.

---

## Architecture Overview

```
                        ┌───────────────────────────────┐
                        │   Cloudflare / Nginx Proxy    │
                        └───────────────┬───────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
┌─────────────────────────┐ ┌───────────────────────┐ ┌────────────────────────┐
│  Parishioner Web Portal │ │     Admin Portal      │ │      Backend API       │
│   (Vite Single-Page)    │ │  (Vite Single-Page)   │ │  (Node.js / Express)   │
└─────────────────────────┘ └───────────────────────┘ └───────────┬────────────┘
                                                                  │
                                                ┌─────────────────┴─────────────────┐
                                                ▼                                   ▼
                                     ┌─────────────────────┐             ┌─────────────────────┐
                                     │ Supabase PostgreSQL │             │   Cloudflare R2     │
                                     │ (Canonical Storage) │             │ (Document Uploads)  │
                                     └─────────────────────┘             └─────────────────────┘
```

---

## 1. Environment Variables Reference

### Backend API (`testimonium-backend/.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `PORT` | Yes | Port to listen on | `5000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname?schema=public` |
| `SUPABASE_DATABASE_URL` | Optional | Fallback database URL | `postgresql://user:pass@host:5432/dbname` |
| `TRUST_PROXY` | Recommended | Enable reverse proxy headers | `1` or `true` |
| `CORS_ORIGINS` | Recommended | Comma-separated allowed web origins | `https://admin.testimonium.org,https://app.testimonium.org` |
| `GLOBAL_RATE_LIMIT_MAX` | Optional | Max requests per 15 min per IP | `5000` |
| `AUTH_READ_RATE_LIMIT_MAX` | Optional | Max authenticated GET requests per 15 min | `2500` |
| `AUTH_WRITE_RATE_LIMIT_MAX` | Optional | Max authenticated write requests per 15 min | `500` |
| `ANON_READ_RATE_LIMIT_MAX` | Optional | Max anonymous GET requests per 15 min | `800` |
| `ANON_WRITE_RATE_LIMIT_MAX` | Optional | Max anonymous write requests per 15 min | `100` |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | Optional | Max login token exchange attempts per 15 min per IP | `10` |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID | `testimonium-app` |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email | `firebase-adminsdk-xxx@testimonium-app.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase service account private key | `"-----BEGIN PRIVATE KEY-----\n..."` |
| `R2_ACCOUNT_ID` | Yes | Cloudflare Account ID | `b6ab36a02c914579977dd08c3959e2f7` |
| `R2_ACCESS_KEY_ID` | Yes | Cloudflare R2 S3 Access Key | `abc123def456...` |
| `R2_SECRET_ACCESS_KEY` | Yes | Cloudflare R2 S3 Secret Key | `secret789...` |
| `R2_BUCKET_NAME` | Yes | Cloudflare R2 bucket name | `testimonium-documents` |
| `R2_PUBLIC_URL` | Yes | Public HTTPS URL endpoint for bucket | `https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev` |
| `OCR_ENABLED` | Optional | Enable/disable OCR processing | `true` |
| `OCR_PROVIDER` | Optional | Provider selection (`ocrspace` or `stub`) | `ocrspace` |
| `OCR_SPACE_API_KEY` | Conditional | API key if `OCR_PROVIDER=ocrspace` | `K888888888888` |
| `LOG_LEVEL` | Optional | Pino logger minimum level | `info` |

### Admin Portal (`testimonium-admin-portal/.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Yes | Target backend API endpoint | `https://api.testimonium.org/api/v1` |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web Client API key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth Domain | `testimonium-app.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase Project ID | `testimonium-app` |

### Parishioner Web Portal (`testimonium-parishioner-web/.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Yes | Target backend API endpoint | `https://api.testimonium.org/api/v1` |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web Client API key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth Domain | `testimonium-app.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase Project ID | `testimonium-app` |

---

## 2. Backend API Deployment Procedure

### Option A: Process Manager (PM2 on Linux Server)

1. **Clone repository & Install Production Dependencies**:
   ```bash
   cd /var/www/testimonium/testimonium-backend
   npm ci --omit=dev
   ```

2. **Run Database Migrations**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Start Process via PM2**:
   ```bash
   pm2 start server.js --name testimonium-backend -i max --env production
   pm2 save
   ```

4. **Verify Process Status & Logs**:
   ```bash
   pm2 status
   pm2 logs testimonium-backend
   ```

### Option B: Docker Container Deployment

```dockerfile
# testimonium-backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 5000
CMD ["node", "server.js"]
```

---

## 3. Reverse Proxy Setup (Nginx Configuration)

To handle SSL termination, rate limiting headers, and WebSocket/HTTP proxying, configure Nginx as follows:

```nginx
# /etc/nginx/sites-available/testimonium-api.conf
server {
    listen 80;
    server_name api.testimonium.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.testimonium.org;

    ssl_certificate /etc/letsencrypt/live/api.testimonium.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.testimonium.org/privkey.pem;

    # Upload Payload Limits (Receipts & Supporting Documents)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # Forward Original Client Context for Rate Limiting & Logger
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for heavy OCR or R2 operations
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

---

## 4. Frontend Deployment (Admin & Parishioner Portals)

### Build Commands

```bash
# Build Admin Portal
cd testimonium-admin-portal
npm ci
npm run build
# Output artifacts in testimonium-admin-portal/dist

# Build Parishioner Web Portal
cd testimonium-parishioner-web
npm ci
npm run build
# Output artifacts in testimonium-parishioner-web/dist
```

### Static Hosting (Nginx Config for SPA Routing)

```nginx
server {
    listen 443 ssl http2;
    server_name admin.testimonium.org;

    root /var/www/testimonium/testimonium-admin-portal/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 5. Rate Limiting Configuration & Operational Tuning

TESTIMONIUM uses a 3-layer adaptive rate limiting architecture across all environments. Every environment (Development, Staging, Production) uses the exact same production-safe rate limits by default to eliminate configuration drift and ensure identical user experience.

### Configurable Environment Variables & Defaults

| Variable | Default Value | Description |
| :--- | :---: | :--- |
| `GLOBAL_RATE_LIMIT_MAX` | `5000` / 15m | Layer 1 fallback for unknown endpoints and DDoS mitigation |
| `AUTH_READ_RATE_LIMIT_MAX` | `2500` / 15m | Layer 3 GET limit for authenticated staff and parishioners |
| `AUTH_WRITE_RATE_LIMIT_MAX` | `500` / 15m | Layer 3 POST/PUT/DELETE limit for authenticated staff/parishioners |
| `ANON_READ_RATE_LIMIT_MAX` | `800` / 15m | Layer 3 GET limit for unauthenticated public traffic |
| `ANON_WRITE_RATE_LIMIT_MAX` | `100` / 15m | Layer 3 POST/PUT/DELETE limit for unauthenticated public traffic |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | `10` / 15m | Layer 2 login token exchange limit (per IP) |
| `PASSWORD_RESET_RATE_LIMIT_MAX` | `3` / 1h | Layer 2 password reset trigger limit (per IP) |
| `USER_CREATION_RATE_LIMIT_MAX` | `5` / 1h | Layer 2 staff user creation limit (per IP) |
| `OCR_RATE_LIMIT_MAX` | `10` / 10m | Layer 2 OCR document verification limit |
| `RECEIPT_UPLOAD_RATE_LIMIT_MAX` | `5` / 15m | Layer 2 payment proof receipt upload limit |
| `PARISH_IMAGE_UPLOAD_RATE_LIMIT_MAX` | `5` / 1m | Layer 2 parish cover image upload limit |
| `MAP_SAVE_RATE_LIMIT_MAX` | `20` / 1m | Layer 2 diocese parish map config save limit |
| `RATE_LIMIT_STORE` | `memory` | Rate limit backend (`memory` locally, `redis` in production) |

### Deployment Scaling Examples

- **Standard Parish / Diocese Deployment (Default)**:
  No extra configuration needed. All services use production-safe defaults.
- **High-Volume Multi-Diocese Deployment**:
  Override limits in `.env` or container environment:
  ```env
  GLOBAL_RATE_LIMIT_MAX=20000
  AUTH_READ_RATE_LIMIT_MAX=10000
  AUTH_WRITE_RATE_LIMIT_MAX=2000
  RATE_LIMIT_STORE=redis
  ```

---

## 6. Pre-Flight Production Checklist

- [ ] `NODE_ENV=production` is set across all services.
- [ ] PostgreSQL connection string uses SSL (`?sslmode=require`).
- [ ] Firebase credentials verified and private key newlines correctly unescaped.
- [ ] Cloudflare R2 bucket CORS policy allows admin and parishioner web origins.
- [ ] Global API Rate limiting tested (`/api/v1/health` returns `200 OK`, rate limits logged on startup).
- [ ] Pino structured logs verified (JSON output without plaintext password links or tokens).
- [ ] Health check endpoint `/api/v1/health` returns operational status.

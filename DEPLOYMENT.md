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
| `DATABASE_URL` | Yes | PostgreSQL connection string (pooling) | `postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres?schema=public&sslmode=require` |
| `DIRECT_URL` | Optional | Direct connection string for Prisma migrations | `postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres?schema=public` |
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
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase service account private key (PEM string) | `"-----BEGIN PRIVATE KEY-----\n..."` |
| `R2_ACCOUNT_ID` | Yes | Cloudflare Account ID | `b6ab36a02c914579977dd08c3959e2f7` |
| `R2_ACCESS_KEY_ID` | Yes | Cloudflare R2 S3 Access Key | `abc123def456...` |
| `R2_SECRET_ACCESS_KEY` | Yes | Cloudflare R2 S3 Secret Key | `secret789...` |
| `R2_BUCKET_NAME` | Yes | Cloudflare R2 bucket name | `testimonium-documents` |
| `R2_PUBLIC_URL` | Yes | Public HTTPS URL endpoint for bucket | `https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev` |
| `OCR_ENABLED` | Optional | Enable/disable OCR processing | `true` |
| `OCR_PROVIDER` | Optional | Provider selection (`ocrspace`, `google_vision`, or `stub`) | `ocrspace` |
| `OCR_SPACE_API_KEY` | Conditional | API key if `OCR_PROVIDER=ocrspace` | `K888888888888` |
| `OCR_SPACE_ENGINE` | Optional | OCR.Space engine mode (`1` or `2`) | `2` |
| `OCR_TIMEOUT` | Optional | OCR API call timeout in ms | `10000` |
| `OCR_MAX_SIZE_KB` | Optional | Maximum image payload size in KB | `900` |
| `OCR_COMPRESSION_WIDTH` | Optional | Sharp resize width target | `1200` |
| `OCR_COMPRESSION_QUALITY` | Optional | Sharp JPEG compression quality | `80` |
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

2. **Run Database Migrations & Generate Prisma Client**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Start Process via PM2**:
   ```bash
   pm2 start server.js --name testimonium-backend -i max --env production
   pm2 save
   ```

4. **Verify Process Status & Health Check**:
   ```bash
   pm2 status
   curl -I http://localhost:5000/api/v1/health
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
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 5000
CMD ["node", "server.js"]
```

---

## 3. Frontend Web Applications Build & Hosting

### 1. Build Admin Portal

```bash
cd /var/www/testimonium/testimonium-admin-portal
npm ci
npm run build
# Output generated in /var/www/testimonium/testimonium-admin-portal/dist
```

### 2. Build Parishioner Web Portal

```bash
cd /var/www/testimonium/testimonium-parishioner-web
npm ci
npm run build
# Output generated in /var/www/testimonium/testimonium-parishioner-web/dist
```

---

## 4. Reverse Proxy Setup (Nginx Configuration)

```nginx
# /etc/nginx/sites-available/testimonium.conf

# 1. Backend API
server {
    listen 443 ssl http2;
    server_name api.testimonium.org;

    ssl_certificate /etc/letsencrypt/live/api.testimonium.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.testimonium.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 15M;
    }
}

# 2. Admin Portal
server {
    listen 443 ssl http2;
    server_name admin.testimonium.org;

    ssl_certificate /etc/letsencrypt/live/admin.testimonium.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.testimonium.org/privkey.pem;

    root /var/www/testimonium/testimonium-admin-portal/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# 3. Parishioner Web Portal
server {
    listen 443 ssl http2;
    server_name app.testimonium.org;

    ssl_certificate /etc/letsencrypt/live/app.testimonium.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.testimonium.org/privkey.pem;

    root /var/www/testimonium/testimonium-parishioner-web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 5. Cloudflare R2 Bucket Security & CORS

Ensure your R2 bucket CORS settings permit browser uploads from production domains:

```json
[
  {
    "AllowedOrigins": [
      "https://admin.testimonium.org",
      "https://app.testimonium.org"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

# TESTIMONIUM Portal Suite — Complete Setup & Deployment Guide

> **Target Audience:** System Analysts, Developers, and QA Engineers  
> **Environment Context:** Laptop (Backend, Admin Portal, Parishioner Web) + Mobile Device (Parishioner App via Expo)  
> **Repository:** `testimonium` (Unified Monorepo Workspace)

---

## 1. System Architecture & Port Mapping

The **TESTIMONIUM** suite is designed for the Roman Catholic Diocese of San Carlos. When evaluating or testing progress, the stack is divided across your laptop and physical mobile device as follows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SYSTEM ANALYST LAPTOP                           │
│                                                                             │
│   ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────┐   │
│   │ Parishioner Web Portal │  │      Admin Portal      │  │ Backend API │   │
│   │  http://localhost:5173 │  │  http://localhost:5174 │  │ :5000/api/v1│   │
│   └───────────┬────────────┘  └───────────┬────────────┘  └──────┬──────┘   │
│               │                           │                      │          │
│               └───────────────────┬───────┴──────────────────────┤          │
│                                   ▼                                         │
│                      PostgreSQL (Supabase) + Prisma                         │
│                      Firebase Auth + Cloudflare R2                          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
           Cloudflare HTTPS Quick Tunnel (or Local Wi-Fi Network)
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                           PHYSICAL MOBILE DEVICE                            │
│                                                                             │
│                  Parishioner Mobile App (Expo SDK 57)                       │
│                        Metro Server (:8081)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Development Port Reference

| Component | Directory | Dev URL | Port |
| :--- | :--- | :--- | :--- |
| **Backend API** | `testimonium-backend` | `http://localhost:5000/api/v1` | `5000` |
| **Parishioner Web Portal** | `testimonium-parishioner-web` | `http://localhost:5173` | `5173` |
| **Admin Portal** | `testimonium-admin-portal` | `http://localhost:5174` | `5174` |
| **Parishioner Mobile App** | `testimonium-parishioner-app` | `http://localhost:8081` (Metro) | `8081` |

---

## 2. Prerequisites & Tools Required

Ensure your laptop has the following software installed before proceeding:

1. **Node.js**: `v20.x` or `v22.x LTS` (Node `>=22.13.0` recommended). Verify with:
   ```bash
   node -v
   npm -v
   ```
2. **Git**: Installed and configured on your system.
3. **Database**: Access to a PostgreSQL instance (e.g., [Supabase](https://supabase.com) PostgreSQL connection string or local PostgreSQL 15+).
4. **Cloudflare CLI (`cloudflared`)** *(Recommended for Mobile testing)*:
   - **Windows:** Download `cloudflared.exe` from [Cloudflare Releases](https://github.com/cloudflare/cloudflared/releases) and place it on your system `PATH` or at `C:\tmp\testimonium-cloudflared\cloudflared.exe`.
   - **macOS:** `brew install cloudflared`
   - **Linux:** `sudo apt-get install cloudflared`
5. **Mobile Device Setup**:
   - Install **Expo Go** on your iOS (App Store) or Android (Google Play Store) phone.
   - For custom native development client testing, an Android device with USB debugging or an iOS simulator/device registered on Expo.

---

## 3. Quick Start (Automated Setup)

### Step 3.1: Clone and Install Dependencies

From the repository root, install dependencies for all sub-projects in one command:

```bash
# 1. Clone repository
git clone <REPO_URL>
cd testimonium

# 2. Install dependencies across root, backend, web, admin, and mobile
npm run install:all
```

> *Tip: `npm run install:all` automatically executes `npm install` in the root workspace, `testimonium-backend`, `testimonium-parishioner-web`, `testimonium-admin-portal`, and `testimonium-parishioner-app`.*

---

## 4. Environment Configuration (`.env`)

Each sub-application contains its own configuration file. Create the `.env` files from their respective `.env.example` templates.

```bash
# Quick copy commands (PowerShell / Windows CMD / Bash)
cp testimonium-backend/.env.example testimonium-backend/.env
cp testimonium-admin-portal/.env.example testimonium-admin-portal/.env
cp testimonium-parishioner-web/.env.example testimonium-parishioner-web/.env
cp testimonium-parishioner-app/.env.example testimonium-parishioner-app/.env
```

### 4.1 Backend Configuration (`testimonium-backend/.env`)

Edit `testimonium-backend/.env` with your database and service credentials:

```env
PORT=5000
NODE_ENV=development

# ── Database (Supabase PostgreSQL or Local PostgreSQL) ───────
# Direct PostgreSQL connection string for Prisma
DATABASE_URL="postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres?sslmode=require"
SUPABASE_DATABASE_URL="postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres?sslmode=require"

# ── Cloudflare R2 S3-Compatible Storage (Receipts & Documents)
R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="testimonium-documents"
R2_PUBLIC_URL="https://pub-xxxx.r2.dev"

# ── Firebase Admin SDK (Backend Token Verification) ──────────
FIREBASE_PROJECT_ID="testimonium-xxxx"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxx@testimonium-xxxx.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

# ── Local Development Toggles ────────────────────────────────
# Set ENABLE_DEV_AUTH=true ONLY for local offline mock authentication bypass
ENABLE_DEV_AUTH=false
ADMIN_EMAIL_VERIFICATION_REQUIRED=false

# ── Activity Log Maintenance ─────────────────────────────────
ENABLE_ACTIVITY_PURGE=false
ACTIVITY_LOG_RETENTION_DAYS=365
```

### 4.2 Admin Portal Configuration (`testimonium-admin-portal/.env`)

Edit `testimonium-admin-portal/.env`:

```env
# Backend API Base URL
VITE_API_URL=http://localhost:5000/api/v1

# Data Provider Mode ("api" for live backend, "demo" for offline mock state)
VITE_DATA_PROVIDER=api

# Firebase Client SDK
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="testimonium-xxxx.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="testimonium-xxxx"
VITE_FIREBASE_STORAGE_BUCKET="testimonium-xxxx.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
```

### 4.3 Parishioner Web Portal Configuration (`testimonium-parishioner-web/.env`)

Edit `testimonium-parishioner-web/.env`:

```env
# Backend API Base URL (Note key name: VITE_API_BASE_URL)
VITE_API_BASE_URL=http://localhost:5000/api/v1

# Data Provider Mode ("api" for live backend, "demo" for offline mock state)
VITE_PROVIDER_MODE=api

# Admin Portal Gateway Link
VITE_ADMIN_PORTAL_URL=http://localhost:5174

# Firebase Client SDK
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="testimonium-xxxx.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="testimonium-xxxx"
VITE_FIREBASE_STORAGE_BUCKET="testimonium-xxxx.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
```

### 4.4 Parishioner Mobile App Configuration (`testimonium-parishioner-app/.env`)

Edit `testimonium-parishioner-app/.env`:

```env
# For testing on a physical phone, this MUST be a reachable URL.
# When using `npm run dev:mobile`, this value is automatically populated.
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:5000/api/v1
EXPO_PUBLIC_ENV=development

# Google Sign-In gate (keep false unless web client ID is configured)
EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED=false
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

---

## 5. Database Migration & Seeding

Once the `DATABASE_URL` is set in `testimonium-backend/.env`, apply Prisma migrations and seed the initial parishes, roles, staff accounts, schedules, and test events:

```bash
# Navigate to the backend directory
cd testimonium-backend

# 1. Deploy database schema migrations
npx prisma migrate deploy

# 2. Generate Prisma Client bindings
npx prisma generate

# 3. Seed database with parishes, mass schedules, and user roles
node prisma/seed.js

# Return to repository root
cd ..
```

### Default Seeded Staff Accounts (for testing Admin Portal)

The seed script creates the following staff accounts. You can sign in using these emails via Firebase Auth (or your local authentication setup):

| Role | Email | Assigned Parish / Entity | Capabilities |
| :--- | :--- | :--- | :--- |
| **DIOCESE_COORDINATOR** | `coordinator@testimonium.org` | *Diocese-Wide (All Parishes)* | Full system administration, audit logs, parish registry, map config, diocese analytics. |
| **PRIEST** | `priest.mountains@testimonium.org` | Our Lady of the Mountains Quasi-Parish | Approve/reject sacramental document requests, accept scheduling requests, calendar management. |
| **SECRETARY** | `secretary.mountains@testimonium.org` | Our Lady of the Mountains Quasi-Parish | Document verification, payment receipt check with OCR, intake processing, schedule management. |
| **PRIEST** | `priest.stjoseph@testimonium.org` | St. Joseph Parish (Canlaon City) | Parish oversight, request review, priest scheduling. |
| **SECRETARY** | `secretary.stjoseph@testimonium.org` | St. Joseph Parish (Canlaon City) | Document intake, receipt verification, parish calendar. |
| **PRIEST** | `priest.miraculousmedal@testimonium.org` | Our Lady of the Miraculous Medal Parish | Parish oversight, sacramental certificates. |
| **SECRETARY** | `secretary.miraculousmedal@testimonium.org` | Our Lady of the Miraculous Medal Parish | Document processing, scheduling intake. |

---

## 6. Running the Analyst's Laptop Stack

### 6.1 All-in-One Command (Recommended)

Run the backend and both web portals concurrently from the root directory:

```bash
npm run dev
```

This single command boots:
- 🔵 **Backend API** at `http://localhost:5000`
- 🟢 **Parishioner Web Portal** at `http://localhost:5173`
- 🟣 **Admin Portal** at `http://localhost:5174`

### 6.2 Running Individual Components (Alternative)

If you prefer separate terminal windows:

```bash
# Terminal 1 — Backend API
npm run backend

# Terminal 2 — Parishioner Web Portal
npm run parishioner

# Terminal 3 — Admin Portal
npm run admin
```

### 6.3 Verify Laptop Web Stack

Open your browser and verify the following URLs:

1. **Backend Health Check:**  
   Navigate to [`http://localhost:5000/api/v1/health`](http://localhost:5000/api/v1/health)  
   Expected JSON response: `{"status":"healthy", "timestamp":"..."}`
2. **Parishioner Web Portal:**  
   Navigate to [`http://localhost:5173`](http://localhost:5173)  
   Test the public parish directory, certificate request wizard, and scheduling preview.
3. **Admin Portal:**  
   Navigate to [`http://localhost:5174`](http://localhost:5174)  
   Log in with `coordinator@testimonium.org` or `secretary.mountains@testimonium.org`.

---

## 7. Testing the Mobile App on a Physical Phone

The mobile application (`testimonium-parishioner-app`) is built with React Native and Expo SDK 57. Because the backend runs on your laptop and the app runs on a physical phone, the phone must be able to reach the laptop's backend API.

### Method A: Automated Cloudflare Quick Tunnel (Recommended)

We have built a dedicated launcher script that automates the entire mobile testing flow:

```bash
npm run dev:mobile
```

#### What `npm run dev:mobile` does automatically:
1. Verifies if `http://localhost:5000` is running (starts the backend if it is not).
2. Spawns a secure **Cloudflare Quick Tunnel** (`https://<generated-id>.trycloudflare.com`) pointing to port 5000.
3. Verifies public HTTPS health of the tunnel (`/api/v1/health`).
4. Updates `testimonium-parishioner-app/.env` with the new public URL (`EXPO_PUBLIC_API_BASE_URL`).
5. Starts the **Expo Metro development server** with `--tunnel` enabled.

#### How to open on your phone:
1. Open the **Expo Go** app on your phone (or camera app on iOS).
2. Scan the **QR code** displayed in your laptop terminal.
3. The app will bundle and load directly on your phone with live backend connectivity over HTTPS.

---

### Method B: Local Wi-Fi Network (LAN IP)

If you do not have `cloudflared` installed or want to connect directly over local Wi-Fi:

1. Connect both your laptop and phone to the **same Wi-Fi network**.
2. Find your laptop's Local IP Address:
   - **Windows:** Run `ipconfig` (Look for `IPv4 Address`, e.g., `192.168.1.50`).
   - **macOS/Linux:** Run `ifconfig` or `ip a` (Look for `inet 192.168.x.x`).
3. Update `testimonium-parishioner-app/.env`:
   ```env
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:5000/api/v1
   ```
4. Start the mobile development server:
   ```bash
   npm run mobile
   ```
5. Scan the QR code in Expo Go.

> ⚠️ **Windows Firewall Note:** Ensure Windows Defender Firewall allows inbound connections to Node.js / Port 5000 on private networks.

---

## 8. Step-by-Step Feature Testing Guide for Analyst

### 8.1 Testing the Admin Portal (`http://localhost:5174`)

1. **Diocese Coordinator Level:**
   - Sign in as `coordinator@testimonium.org`.
   - **Dashboard:** Inspect diocese-wide request volumes, revenue snapshots, and parish metrics.
   - **Parish Registry:** Edit parish metadata, contact info, patron saints, feast days, and mass schedules.
   - **Interactive Map Configuration:** Adjust GPS coordinates, map pins, and zoom levels for San Carlos City, Canlaon City, Vallehermoso, and Don Salvador Benedicto.
   - **User Management:** Review parish staff assignments, roles, and status (Active/Suspended).
   - **Activity Audit Logs:** Inspect system event history and retention filters.

2. **Parish Secretary / Priest Level:**
   - Sign in as `secretary.mountains@testimonium.org` or `priest.mountains@testimonium.org`.
   - **Document Requests:** Filter incoming requests (Baptismal, Confirmation, Marriage, Death certificates).
   - **Payment & Receipt Review:** View uploaded GCash / bank receipts, inspect automated OCR extraction results, and toggle manual payment verification (`VERIFIED` / `REJECTED`).
   - **Schedule Requests:** Review baptism, wedding, or blessing requests; approve dates or send reschedule proposals.
   - **Parish Calendar:** View daily/weekly scheduled sacramental events.

---

### 8.2 Testing the Parishioner Web Portal (`http://localhost:5173`)

1. **Parish Directory:**
   - Browse parishes by municipality (San Carlos City, Canlaon City, etc.).
   - View parish details, patron saints, mass schedules, and priest assignments.
2. **Document Request Wizard:**
   - Select a certificate type (e.g., Baptismal Certificate).
   - Step through applicant info, purpose of request, and document options.
   - Attach supporting IDs and view the fee summary.
   - Upload proof of payment / receipt.
3. **Parish Scheduling:**
   - Request an appointment for a sacrament (e.g., Baptism or Wedding).
   - Pick available date slots based on parish capacity rules.
4. **Status Tracker:**
   - Track request status in real-time using the tracking reference number.

---

### 8.3 Testing the Mobile App (Phone)

1. **Authentication:**
   - Sign up / sign in as a parishioner.
2. **Home & Directory Feed:**
   - Discover upcoming parish fiesta events, seminars, and holy hour schedules.
3. **Camera & Receipt Upload:**
   - Submit a certificate request and take a live photo of a payment receipt.
   - Notice automatic image optimization and upload pipeline to Cloudflare R2.
4. **Notifications & In-App Alerts:**
   - Receive in-app notifications when a document is approved or rescheduled by the parish staff.

---

## 9. Running Automated Test Suites

Validate codebase integrity and API contracts by running the automated test suites:

```bash
# 1. Run backend unit & integration tests (Auth, Uploads, Scheduling, Concurrency)
npm run test --prefix testimonium-backend

# 2. Run mobile launcher & tunnel unit tests
npm run test:dev-mobile

# 3. Run mobile application Jest tests
npm run test --prefix testimonium-parishioner-app

# 4. Run typechecking and linting
npm run build:all
```

---

## 10. Troubleshooting & FAQ

### Q1: `Port 5000 is already in use`
**Cause:** An orphaned Node process or Apple AirPlay receiver (on macOS) is occupying port 5000.  
**Solution:**
- **Windows:** Open PowerShell as Administrator and run:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
  ```
- **macOS:** Disable "AirPlay Receiver" in *System Settings → General → AirDrop & AirPlay*, or kill the process:
  ```bash
  kill -9 $(lsof -ti :5000)
  ```

### Q2: `PrismaClientInitializationError: Can't reach database server`
**Cause:** Incorrect database URL, missing password, or network firewall blocking port 5432/6543.  
**Solution:**
- If using Supabase, ensure you use the Transaction Pooler or Direct Connection string with `?sslmode=require`.
- Test direct connection with `npx prisma db pull` in `testimonium-backend`.

### Q3: `Firebase: Error (auth/invalid-api-key)`
**Cause:** Missing or placeholder Firebase credentials in the frontends' `.env` files.  
**Solution:**
- Set `VITE_FIREBASE_API_KEY` and project keys in both `testimonium-admin-portal/.env` and `testimonium-parishioner-web/.env`.
- Alternatively, for rapid UI testing without Firebase, set `VITE_DATA_PROVIDER=demo` in Admin Portal and `VITE_PROVIDER_MODE=demo` in Parishioner Web.

### Q4: Mobile App displays `Network request failed` or cannot reach backend
**Cause:** The phone is attempting to connect to `localhost`, which refers to the phone itself rather than your laptop.  
**Solution:**
- Use `npm run dev:mobile` which automatically sets up a Cloudflare HTTPS tunnel for the phone.
- Or set `EXPO_PUBLIC_API_BASE_URL` in `testimonium-parishioner-app/.env` to your laptop's LAN IP (`http://192.168.x.x:5000/api/v1`).

### Q5: `cloudflared was not found on PATH`
**Cause:** The Cloudflare tunnel CLI is not installed on the system.  
**Solution:**
- Download `cloudflared` from [Cloudflare](https://github.com/cloudflare/cloudflared/releases) and place it at `C:\tmp\testimonium-cloudflared\cloudflared.exe` or add its folder to your system `PATH`.

---

## 11. Monorepo Scripts Reference

Summary of available root `package.json` commands:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs Backend, Parishioner Web, and Admin Portal concurrently. |
| `npm run dev:mobile` | Launches Backend + Cloudflare Quick Tunnel + Mobile Expo Metro dev server. |
| `npm run backend` | Starts only the Express/Prisma backend server. |
| `npm run parishioner` | Starts only the Parishioner Web Vite development server (`:5173`). |
| `npm run admin` | Starts only the Admin Portal Vite development server (`:5174`). |
| `npm run mobile` | Starts only the Expo React Native Metro bundler (`:8081`). |
| `npm run install:all` | Installs dependencies across all subprojects. |
| `npm run build:all` | Builds production bundles for both web portals. |
| `npm run test:dev-mobile`| Executes automated test assertions for the mobile dev launcher. |

---

*For further architecture details, consult [API_DOCUMENTATION.md](API_DOCUMENTATION.md), [DATABASE.md](DATABASE.md), and [testimonium-parishioner-app/00_MOBILE_DOCS_INDEX.md](testimonium-parishioner-app/00_MOBILE_DOCS_INDEX.md).*

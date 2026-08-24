# TESTIMONIUM Parishioner Mobile — Environment, Build & Release

**Last reconciled:** 24 August 2026
**Target application:** `testimonium-parishioner-app`

## 1. Objective

Provide reproducible local development, preview testing, and production builds with full native capability isolation and zero client secret leakage.

## 2. Environment configuration & variables

Environment variables are managed in `.env` (using `.env.example` as the canonical template) and accessed via typed helpers in `src/config/environment.ts`:

| Variable | Description | Default | Required for Production |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_API_BASE_URL` | Base URL of TESTIMONIUM backend API | None; required | Yes (HTTPS) |
| `EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED` | Feature flag gating native Google Sign-In | `false` | When Google OAuth configured |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth Web Client ID for Firebase exchange | `""` | When Google OAuth enabled |

> [!NOTE]
> All `EXPO_PUBLIC_*` variables are embedded into client JS bundles and must not contain backend secrets (e.g. database credentials, Firebase Admin private keys, Cloudflare R2 secrets).

### Physical device development (`npm run dev:mobile`)

When testing on a physical Android phone, `localhost` and `127.0.0.1` resolve to the device rather than the host computer. The root workspace provides a launcher for physical device testing:

```powershell
# Run from repository root for physical mobile testing
npm run dev:mobile
```

`npm run dev:mobile` coordinates the local development session:
1. Reuses or launches the TESTIMONIUM Express backend on port 5000.
2. Starts a Cloudflare Quick Tunnel (`cloudflared`) exposing a temporary HTTPS tunnel endpoint (`https://*.trycloudflare.com`).
3. Verifies backend health (`/api/v1/health`) through the tunnel.
4. Updates `EXPO_PUBLIC_API_BASE_URL` in `testimonium-parishioner-app/.env`.
5. Starts the Expo Metro development client (`npx expo start --dev-client --tunnel`).

## 3. Native plugins & EAS configuration

### `app.config.ts` Plugins:
- `@react-native-firebase/app`
- `@react-native-firebase/auth`
- `@react-native-google-signin/google-signin`

### EAS Profiles (`eas.json`):
- `development`: `developmentClient: true`, `distribution: "internal"` (for building custom Expo Dev Client).
- `preview`: `distribution: "internal"`, `channel: "preview"`, `android: { buildType: "apk" }` (for internal testing).
- `production`: `channel: "production"` (for release App Bundle / IPA).

## 4. Verification commands and release gates

```bash
# Typecheck
npm run typecheck

# Jest test suite (22 suites, 161 tests)
npm test -- --runInBand

# ESLint verification (0 errors, 0 warnings)
npm run lint

# Export static Android bundle
npx expo export --platform android

# Native prebuild generation
npm run prebuild
```

## 5. Verification status matrix

- **STATIC CODEBASE:** PASS
- **TYPECHECK:** PASS (`npm run typecheck`)
- **UNIT & INTEGRATION TESTS:** PASS (22 suites, 161 tests passing)
- **LINT:** PASS (`npm run lint`, 0 errors, 0 warnings)
- **METRO BUNDLE EXPORT:** PASS (`npx expo export --platform android`)
- **PHYSICAL RUNTIME QA:** ACTIVE (Tested via development APK & Quick Tunnel)

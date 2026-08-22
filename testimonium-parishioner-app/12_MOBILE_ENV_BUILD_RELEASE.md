# TESTIMONIUM Parishioner Mobile â€” Environment, Build & Release

## 1. Objective

Provide reproducible local development, preview testing, and production builds with full native capability isolation and zero client secret leakage.

## 2. Environment Configuration & Variables

Environment variables are managed in `.env` (using `.env.example` as canonical template) and accessed via typed helpers in `src/config/environment.ts`:

| Variable | Description | Default | Required for Production |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_API_BASE_URL` | Base URL of TESTIMONIUM backend API | None; required | Yes (HTTPS) |
| `EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED` | Feature flag gating native Google Sign-In | `false` | When Google OAuth configured |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth Web Client ID for Firebase exchange | `""` | When Google OAuth enabled |

> [!NOTE]
> All `EXPO_PUBLIC_*` variables are embedded into client JS bundles and must not contain backend secrets (e.g. database credentials, Firebase Admin private keys, Cloudflare R2 secrets).

### Physical Android development

`localhost`, `127.0.0.1`, and `::1` resolve to the phone, not the laptop. Use the root launcher for a physical Android development-client session:

```powershell
# Normal web/backend development, from the repository root
npm run dev

# Physical Android development, from the repository root
npm run dev:mobile
```

`npm run dev:mobile` supervises one local development session:

```text
TESTIMONIUM backend -> temporary HTTPS Cloudflare Quick Tunnel -> mobile .env API URL -> Expo development client Metro
```

It reuses a healthy backend already listening on port 5000; otherwise it starts the existing backend package only. It finds `cloudflared` on `PATH` first, then falls back to `C:\tmp\testimonium-cloudflared\cloudflared.exe`. After Cloudflare publishes a temporary `https://*.trycloudflare.com` host, the launcher verifies `/api/v1/health`, updates only `EXPO_PUBLIC_API_BASE_URL` in `testimonium-parishioner-app/.env`, and starts `npx expo start --dev-client --tunnel` from the mobile app.

The Quick Tunnel host changes whenever it restarts and is development-only infrastructure, never production configuration. Your physical Android development APK must already be installed. Normal JavaScript, UI, and API changes do not require an EAS rebuild; native dependency or native configuration changes are the exception. Press `Ctrl+C` to stop only processes started by this launcher. If port 8081 is already occupied, stop the existing Metro session first; the launcher will not kill it or switch ports.

## 3. Native Plugins & EAS Configuration

### `app.config.ts` Plugins:
- `@react-native-firebase/app`
- `@react-native-firebase/auth`
- `@react-native-google-signin/google-signin`

### EAS Profiles (`eas.json`):
- `development`: `developmentClient: true`, `distribution: "internal"` (for building custom Expo Dev Client).
- `preview`: `distribution: "internal"`, `channel: "preview"`, `android: { buildType: "apk" }` (for internal testing).

## 4. Development Workflow & Commands

```bash
# Typecheck
npm run typecheck

# Jest test suite (single-band for stability)
npm test -- --runInBand

# ESLint verification (zero errors, zero warnings)
npm run lint

# Expo Doctor health check (21/21 checks)
npx expo-doctor

# Local Metro / JS bundle verification (Platform Android)
npx expo export --platform android

# Native Prebuild generation
npm run prebuild

# Run local development client on Android / iOS
npm run android:dev
npm run ios:dev
```

## 5. Verification Status Matrix

### Static & Tooling Verification:
- **STATIC VERIFIED** â€” PASS
- **TYPECHECK** â€” PASS (`npm run typecheck`)
- **UNIT/INTEGRATION TESTS** â€” PASS (`npm test -- --runInBand`)
- **LINT** â€” PASS (`npm run lint`, 0 errors, 0 warnings)
- **EXPO DOCTOR** â€” PASS (`npx expo-doctor`, 21/21 checks)
- **JS/METRO ANDROID BUNDLE** â€” PASS (`npx expo export --platform android`, 1,381 modules bundled)
- **GIT DIFF CHECK** â€” PASS (`git diff --check`)

### Runtime & Native Target Verification:
- **ANDROID NATIVE COMPILE** â€” PENDING (Requires Gradle / EAS Build)
- **EMULATOR** â€” PENDING
- **PHYSICAL DEVICE** â€” PENDING
- **REAL FIREBASE/BACKEND** â€” PENDING
- **GOOGLE SIGN-IN RUNTIME** â€” PENDING (Requires Android OAuth client with SHA-1 in Firebase Console)
- **iOS** â€” PENDING

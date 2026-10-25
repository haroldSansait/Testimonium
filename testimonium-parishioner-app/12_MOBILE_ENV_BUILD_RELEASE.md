# TESTIMONIUM Android v1.0.0 — Environment, Build & Release

Reconciled: 25 October 2026. Target: `testimonium-parishioner-app/`.
Distribution: signed standalone APK through `https://testimonium.site`. A public APK URL and website download/QR hosting follow verification of the real signed artifact.

## Identity and versioning

| Setting | Release value |
| --- | --- |
| Display name / versionName | TESTIMONIUM / `1.0.0` |
| Android application ID | `com.testimonium.app` |
| Expo slug / scheme / owner | `testimonium` / `testimonium` / `agos-testimonium` |
| EAS project | `c5ceefeb-6a8a-46b4-a53f-af529ac894b1` |
| Firebase project | `testimonium-b46b0` |
| Android minimum | API 26 (Android 8.0); native/device compatibility requires verification |
| Local bootstrap versionCode | `1`; **not a claim about the final APK build number** |

The mobile `eas.json` uses `cli.appVersionSource: "remote"` and release `autoIncrement: true`. Existing EAS Android version history is authoritative and has not been inspected in this task. Local `versionCode: 1` is a valid bootstrap for an uninitialized project, not a reset of an existing remote number. With no remote history, EAS can initialize from this seed and increment to 2 on the first build. An existing higher remote number continues incrementing. Do not force it to 1 to match the public version name.

Before building, compare remote history with any previous APK's versionCode. If remote state is absent or lower, the owner must initialize it to at least the highest prior code. Record the actual code from the completed APK. Settings reads installed version/build through `expo-application`, without fabricated version or local build-number fallbacks.

## Profiles and production environment

Run EAS commands from the mobile directory. Repository-root `eas.json` is separate and unchanged.

| Profile | Purpose |
| --- | --- |
| `development` | Existing development-client APK and Metro workflow |
| `preview` | Existing internal testing profile |
| `production` | Release configuration, production EAS environment, remote signing and numbering; default Android AAB if separately requested |
| `release-apk` | Inherits production; internal distribution and `android.buildType: "apk"` |

`release-apk` inherits `developmentClient: false`, with no custom Gradle command overriding the release task. It embeds JavaScript/assets and requires no Metro or development client. Internal distribution describes EAS artifact delivery; the signed APK can subsequently be hosted publicly. No automatic Play submission is configured.

The profile selects the EAS **production** environment. These public values are pinned in the mobile `eas.json`, so a local tunnel cannot silently become the release endpoint:

| Variable | Release value |
| --- | --- |
| `EXPO_PUBLIC_ENV` | `production` |
| `EXPO_PUBLIC_API_BASE_URL` | `https://testimonium-e9s5.onrender.com/api/v1` |
| `EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED` | `true` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `900241750208-kclu82sicn6amkchcv2hd3h1fh8c7fft.apps.googleusercontent.com` (existing type-3 Web OAuth client) |
| `EXPO_NO_DOTENV` | `1` |

No EAS dashboard variable creation is required for the pinned values. Keep duplicate production EAS variables aligned; the profile is the public release configuration authority. The enabled Google gate and Web client ID are inherited by `release-apk`. This OAuth client ID is public client configuration. Never place Firebase Admin credentials, database URLs, R2 secrets, signing passwords or backend credentials in `EXPO_PUBLIC_*` or Expo `extra`.

`scripts/release-policy.cjs` rejects missing/wrong production settings, HTTP, LAN/loopback/tunnel endpoints, duplicate API prefixes and disabled client-variable inlining. It also requires Google Sign-In enabled and the exact type-3 Web OAuth client ID in the committed Firebase configuration for `com.testimonium.app`; missing, mismatched and Android OAuth IDs are rejected. It runs in Expo config resolution and the EAS post-install hook. The runtime API helper also rejects a different production endpoint. The API client appends request paths without adding another `/api/v1`.

`npm run release:check` resolves profile inheritance, applies its public environment to a child Expo config process and checks app/Firebase identity, versions and assets. `npm run release:export` runs the same preflight and `npx expo export --platform android --no-bytecode --clear` under the release environment. Clearing Metro's transform cache prevents a prior disabled-Google export from supplying stale inlined environment values. The exported Android bundle is checked for the matching Web client ID and inlined Google flag. This is a local JS/asset check; EAS builds retain their normal optimized bytecode build. Neither command starts a cloud build or modifies credentials.

### Development

From the repository root, `npm run dev:mobile` retains the existing local backend, Cloudflare Quick Tunnel, health check, mobile `.env` URL update and Metro development-client launch. `.env.example` remains the development template. Release settings are not written into the developer's `.env`. Do not use `NODE_ENV` alone to select the backend environment.

## Branding and native packaging

Approved source: `assets/images/TESTIMONIUM_official_logo.png` (unchanged).

- `assets/images/android/icon.png`: 1024×1024, approved artwork on cream `#FBF4F5`.
- `assets/images/android/adaptive-foreground.png`: 1080×1080 transparent layer with the full source centered in 640×640. Source margins add clearance inside Android's 66dp safe circle on a 108dp layer. Background: `#FBF4F5`.
- `assets/images/android/splash-logo.png`: 512×512 approved logo with cream circular backing for contrast on crimson `#7B1C2A`. `expo-splash-screen` uses contain sizing and width 200.
- No monochrome icon is supplied rather than guessing a replacement silhouette. Onboarding/welcome UI is unchanged.

`scripts/generate-android-branding.cjs` records mechanical resizing/padding using existing Expo tooling's `jimp-compact`; no redrawing or recoloring. Device launcher masks and splash rendering still require signed-APK inspection.

Existing RN Firebase/Auth, Google Sign-In, Expo Notifications, pickers, VisionCamera/Worklets, Nitro Modules/Image, OpenCV, Reanimated and Gesture Handler remain. SDK 57's Expo DOM wrapper defaults to bundled `@expo/dom-webview`; no map/WebView replacement is needed. Android export includes native JS and the Leaflet DOM bundle/assets. OSM tiles and fallback markers use HTTPS and require internet.

`CAMERA` and `POST_NOTIFICATIONS` remain. Receipt/gallery and Government ID access remain intact. Image-picker microphone permission is disabled because the app uses still images. Release config also removes the development overlay (`SYSTEM_ALERT_WINDOW`) permission while retaining it in development. Cleartext traffic is disabled through `expo-build-properties`. Scanner/API diagnostics and raw callback/storage error logs are development-only. Firebase ID tokens remain obtained through native Auth for authenticated API requests; uploads retain private backend authorization/storage flows.

## Signing, Firebase and Google

The owner has confirmed that the existing EAS release keystore's SHA-1 and SHA-256 exactly match Firebase's registered fingerprints for `com.testimonium.app`. The committed `google-services.json` already contains the matching Android (type 1) OAuth client and the type-3 Web OAuth client used above. Production Google Sign-In is enabled. The Firebase file, authentication implementation, keystore and signing identity are unchanged.

Continue using that persistent release key for updates. Keep its backup, alias and passwords private, and never rotate it per build. No keystore regeneration, Firebase Console mutation or Firebase-file refresh is needed for this configuration fix. Native `webClientId` uses the Web OAuth client, not the Android client ID.

`release:check` validates the enabled gate and exact Web client ID against the Firebase Android registration. `release:export` also checks that the Google client ID and feature flag are inlined in the Android JS. Signing/fingerprint matching is owner-confirmed; these local checks do not independently inspect EAS/Firebase account state or prove signed-device authentication. Verify Google login, existing account/legal/profile gates, persistence and sign-out on the signed APK alongside the unchanged email/password flow.

## Owner-operated PowerShell commands

Use an installed EAS CLI satisfying the mobile `cli.version` constraint. Record its version and the source revision. Account commands below are for the owner and were not executed here.

```powershell
Set-Location 'C:\Users\me\Documents\testimonium\testimonium-parishioner-app'
eas --version
eas whoami
eas project:info
# Confirm the existing owner and project ID before account actions.
eas build:list --platform android --limit 10
eas build:version:get --platform android --profile release-apk
eas credentials --platform android
```

Inspect/reuse credentials in the interactive menu; do not select creation/replacement without approval. Only if remote numbering needs initialization to the highest historical code:

```powershell
eas build:version:set --platform android --profile release-apk
```

Local verification (`npm ci` first if dependencies are not installed):

```powershell
npm run typecheck
npm run lint
npm test -- --runInBand
npm run release:check
npm run release:export
npx expo-doctor
```

Only after owner approval and signing/version checks, run from this same directory:

```powershell
eas build --platform android --profile release-apk
```

Do not append `--auto-submit`, use development profile for public distribution or run from the repository root. Download the completed build's **APK** artifact from its EAS page. Record build ID, source revision, CLI version, profile, actual versionCode, certificate SHA-256 and artifact checksum. No signed APK was produced by this preparation task.

After downloading, replace the sample local path with the real artifact path:

```powershell
$releaseApk = (Resolve-Path -LiteralPath '.\artifacts\TESTIMONIUM-1.0.0.apk').Path
Get-FileHash -LiteralPath $releaseApk -Algorithm SHA256
# Android SDK build-tools must be on PATH:
apksigner verify --verbose --print-certs $releaseApk
aapt dump badging $releaseApk
adb install -r $releaseApk
```

Confirm package, versionName `1.0.0`, actual remote versionCode, correct signer and absence of a debuggable flag. A checksum identifies bytes; it does not replace certificate verification. Keep the final checksum with the real published download when hosting is authorized.

`INSTALL_FAILED_UPDATE_INCOMPATIBLE` can mean a development APK uses a different signer. Different certificates cannot update each other under the same package. Prefer the intended persistent release signer where available. Uninstall/reinstall removes local state, saved sessions and local drafts; explain the tradeoff and obtain the user's decision before uninstalling. Do not erase data automatically. `INSTALL_FAILED_VERSION_DOWNGRADE` instead requires a higher versionCode.

## Signed-APK acceptance — pending

Test a physical supported Android device after the native build succeeds:

- Cold launch with Metro stopped; launcher masks, crimson splash, unchanged welcome tour, Settings installed version/build.
- Email/password and enabled Google registration/login, verification/legal/profile gates, persistence and sign-out/account switching.
- Directory DOM map, OSM tiles, custom church markers, native parish sheet, council/certificate/office hours, gestures/navigation.
- Map Schedule Rite parish preselection, schedule wizard, availability/profile guards, document-request wizard, uploads, receipt camera/gallery.
- Government ID camera permission, VisionCamera/OpenCV/Nitro processing, front/back capture and private uploads.
- Notification permission denial/re-enable, `testimonium-important` channel, FCM registration against production, important-event background display, cold/warm tap navigation and logout token cleanup. In-app notifications remain intact.

Local `production` differs from `main` and lacks FCM worker/device services and the Android push migration present on `main`. The owner must separately verify/deploy backend code, worker activation, Firebase Admin FCM configuration and the required schema. This task does not establish live Render revision or live database state and does not modify/deploy them.

For future APKs: retain package/project identity and signing key, update public version/package metadata intentionally, retain remote auto-increment, review release policy, build, verify signer/checksum and test an in-place upgrade. Download/QR publication follows signed-device verification.

## Google Sign-In configuration correction — 25 October 2026

Passed: `npm run typecheck`; four focused suites / 42 tests (release policy, environment, Google authentication and Android native config); `npm run release:check`; `npm run release:export`; changed-file ESLint with zero warnings; `git diff --check`. Export inspection confirms the matching Web OAuth ID and Google feature flag are inlined alongside the preserved production API URL, with no development tunnel. The initial export exposed stale disabled-Google Metro transforms; adding `--clear` corrected the local export and its bundle assertions passed. No EAS build, signing/Console change or physical-device login was performed for this correction.

## Earlier release-preparation validation recorded on 25 October 2026

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | No errors; fails zero-warning policy on pre-existing `src/__tests__/schedule.test.ts:333` require-import warning |
| Changed-file ESLint | Passed with zero warnings |
| `npm test -- --runInBand` | 52 suites passed, 1 failed; 520 tests passed, 3 failed |
| Release-policy/environment/native-config focused tests | 3 suites / 23 tests passed |
| `npm run release:export` | Passed preflight plus `npx expo export --platform android --no-bytecode`; 2,175 native modules, 175 DOM modules, 56 assets |
| Exported Android JS inspection | Approved API URL present and inlined; no `.trycloudflare.com` endpoint |
| Android-only native config introspection | Passed; HTTPS only, camera/notification/internet permissions retained, microphone/overlay removal directives present |
| Adaptive icon alpha geometry | Maximum artwork radius 284.57px, inside the 330px (33dp) safe radius |
| `npx expo-doctor` | 20/21; SDK patch-version drift in 11 packages |
| `git diff --check` | Passed |
| Official `@expo/eas-json` schema and Android profile resolution | Passed; validator installed only under ignored `.expo/eas-validation`, no project dependency or EAS account access |
| Signed APK/native compilation/physical device/live backend | Not performed; pending owner build and device verification |

The three unchanged carousel-refinement tests use fixed October 18–19 event fixtures; they are outside the real three-day window on October 25. Their feature/test files were not changed to conceal failures. The scanner config test was updated to include the intentional HTTPS setting and passes. Doctor's existing patch drift concerns eslint-config-expo, Expo, dev client, document picker, font, image picker, linking, router, splash, jest-expo and React Native. No broad dependency upgrade was performed. The two directly declared native dependencies reuse validated versions (Application 57.0.3 and Font 57.0.1).

All-platform `expo config --type introspect` also attempts iOS and fails because this Android project has no `ios.googleServicesFile`. Equivalent Android-only introspection passed; no fabricated iOS Firebase configuration was added. It also reports the existing missing `expo-system-ui` warning for the app's light interface preference. These local checks do not prove final Android manifest merging, native compilation or device behavior.

References: [Expo APK builds](https://docs.expo.dev/build-reference/apk/), [remote versioning](https://docs.expo.dev/build-reference/app-versions/), [EAS environments](https://docs.expo.dev/eas/environment-variables/usage/), [dotenv controls](https://docs.expo.dev/guides/environment-variables/), [Android adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive), [Firebase Android setup](https://firebase.google.com/docs/android/setup).

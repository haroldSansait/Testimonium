# TESTIMONIUM Parishioner Mobile

Expo/React Native foundation for the parishioner mobile application.

## Shipped mobile experience

- The supported native target is Android. This redesign does not add iOS or HEIC support; receipt images remain JPEG/PNG only.
- The parishioner UI uses the shared white-and-maroon design system, responsive layout primitives, accessible touch targets, and reduced-motion-aware transitions.
- A device-scoped product tour appears on first launch. Settings can replay it in preview mode without resetting completion, so sign-out does not make onboarding return.
- Home shows exactly three `Asia/Manila` calendar days of public events by merging one existing monthly feed, or two only when the window crosses a month. The full Events screen continues to use the existing monthly feed.
- Parish Directory filtering is limited to the backend-supported search and parish-type controls. There is no municipality filter.
- The redesign is Mobile-only: it introduces no backend routes, API contract changes, Prisma/schema changes, or migrations.

## Local setup

1. Copy `.env.example` to `.env` and provide the public Firebase client configuration and an API base URL reachable from the device.
2. Run `npm install`.
3. Run `npm start` to start Metro, then use a native development build for Firebase authentication.

The Government ID scanner uses VisionCamera, VisionCamera Worklets, Nitro Modules, and on-device OpenCV. After installing or changing these native dependencies, create and install a fresh Android development build (for example, the existing EAS `development` APK profile) before testing; Expo Go and an older installed development client cannot load the scanner.

Phase 0 supports email/password sign-in only. Google Sign-In is deferred because the committed Android Firebase configuration does not yet contain OAuth clients; enable Google auth, register signing fingerprints, and download refreshed platform configuration before Phase 1.

`EXPO_PUBLIC_*` configuration is embedded in a client build. Never add server secrets, service-account JSON, database URLs, or storage credentials to this project.

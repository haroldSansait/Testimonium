# TESTIMONIUM Parishioner Mobile

Expo/React Native foundation for the parishioner mobile application.

## Local setup

1. Copy `.env.example` to `.env` and provide the public Firebase client configuration and an API base URL reachable from the device.
2. Run `npm install`.
3. Run `npm start` to start Metro, then use a native development build for Firebase authentication.

Phase 0 supports email/password sign-in only. Google Sign-In is deferred because the committed Android Firebase configuration does not yet contain OAuth clients; enable Google auth, register signing fingerprints, and download refreshed platform configuration before Phase 1.

`EXPO_PUBLIC_*` configuration is embedded in a client build. Never add server secrets, service-account JSON, database URLs, or storage credentials to this project.
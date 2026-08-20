# TESTIMONIUM Parishioner Mobile — Environment, Build & Release

## 1. Objective

Create reproducible development, preview/testing, and production mobile builds without exposing server secrets.

The project is an Expo/React Native scaffold. Inspect existing `app.json`, `app.config.*`, `eas.json`, package IDs, Firebase files, and scripts before modifying build configuration.

## 2. Environment model

Recommended environments:
- development;
- preview/staging;
- production.

Each should have:
- correct API base URL;
- correct Firebase client project/config;
- correct app identifiers/build profiles;
- environment label for diagnostics.

Do not let development builds accidentally hit production if avoidable.

## 3. Environment variables

Client-visible values may include:
- API base URL;
- Firebase client config identifiers;
- feature flags that are safe to expose.

Server secrets must never be included:
- database URL;
- Firebase Admin private key;
- R2 access key/secret;
- OCR provider server key;
- push provider server secret.

Anything named `EXPO_PUBLIC_*` is visible to the app bundle and must be treated as public configuration.

## 4. API base URL

Recommended mobile-specific config variable:

```text
EXPO_PUBLIC_API_BASE_URL
```

Only adopt this if it matches existing scaffold conventions.

Normalize base URL in one config module.

Do not hardcode localhost in feature services.

For physical-device local testing:
- `localhost` refers to the phone itself;
- use reachable development host/tunnel as appropriate.

## 5. Firebase platform config

Android/iOS Firebase configuration must match:
- package/bundle identifiers;
- OAuth redirect settings;
- SHA fingerprints where required;
- Google sign-in configuration.

Do not reuse web redirect assumptions blindly.

## 6. App identifiers

Choose stable identifiers before store submission.

Do not invent/rename after production release without understanding store implications.

Track:
- Android application ID;
- iOS bundle identifier;
- Expo project ID if used;
- app display name;
- scheme for deep linking.

## 7. Build profiles

Recommended if using EAS:

### development
- dev client;
- dev backend;
- debugging.

### preview
- installable internal QA build;
- staging/preview backend;
- production-like optimizations.

### production
- store build;
- production API/Firebase;
- no debug tooling.

Do not put secrets directly in `eas.json`.

## 8. Versioning

Track:
- human app version;
- Android versionCode;
- iOS buildNumber.

Define release policy before first store build.

Example semantic intention:
- patch: bug fix;
- minor: backward-compatible features;
- major: substantial UX/contract changes.

Do not treat mobile app version as backend API version.

## 9. API compatibility

Backend is currently `/api/v1`.

Before backend breaking changes:
- consider old installed mobile versions;
- avoid immediately breaking live clients;
- add backward-compatible fields/endpoints or versioning strategy when needed.

Mobile introduces a new concern web clients do not have: users may stay on old builds for weeks/months.

## 10. Feature flags

Use only when needed.

Safe feature flag examples:
- map enabled;
- native push enabled;
- RAG assistant enabled.

Critical security authorization must not be feature-flag-only on client.

## 11. Production hardening

Before release:
- HTTPS API;
- dev auth disabled;
- production Firebase config;
- production backend CORS/network rules as applicable;
- no debug menu in production;
- no sensitive console logging;
- no hardcoded test accounts;
- correct R2/server secrets only on backend;
- crash reporting redaction if enabled.

## 12. Store permissions

Only request permissions used by a visible feature.

Potential:
- camera;
- photo library;
- notifications (future);
- location (only if "near me"/map feature uses it).

Provide user-facing permission descriptions.

Do not request location/camera on first app launch without context.

## 13. Privacy/store declarations

Before publishing, reconcile:
- collected account/profile data;
- uploaded sacramental/request documents;
- receipt/payment evidence;
- location permission if used;
- diagnostics/crash data;
- push tokens if later implemented.

Store privacy answers must reflect actual code/backend behavior.

## 14. Release checklist

### Code
- clean status;
- reviewed commit;
- lint/type/tests;
- no debug secrets.

### Backend
- production reachable;
- migrations applied;
- health endpoint healthy;
- auth provider configured;
- R2/OCR configured as intended.

### Mobile
- correct API base;
- correct Firebase;
- login/register;
- profile;
- requests;
- receipt;
- schedule;
- logout;
- app restart.

### Devices
- Android physical;
- iOS if in scope.

### Documentation
- current API docs;
- current mobile decision log;
- release notes.

## 15. Rollback

Mobile store rollback is slower than web rollback.

Before release:
- backend changes should remain backward compatible where practical;
- keep previous production build information;
- use feature flags for risky optional features;
- avoid destructive schema migrations without rollback/data plan.

## 16. First release recommendation

Do an internal/closed test before public production.

Suggested sequence:
1. developer build;
2. team preview build;
3. small parishioner pilot;
4. fix telemetry/UX issues;
5. broader release.

Do not make RAG/chatbot part of first release critical path.

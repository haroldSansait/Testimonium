# TESTIMONIUM Parishioner Mobile — Testing & QA

## 1. Quality strategy

Testing must cover:
- business-contract correctness;
- auth/session correctness;
- race conditions;
- mobile-native behavior;
- accessibility;
- network failure;
- Android/iOS differences;
- upload/media differences;
- security boundaries.

## 2. Test layers

### Unit
For:
- status label mapping;
- API error normalization;
- date/time formatting;
- file validation;
- route target mapping;
- form validation;
- response normalization.

### Component
For:
- request cards;
- status badges;
- file picker review UI;
- payment instructions;
- empty/error states;
- auth forms.

### Integration
For:
- API client + auth token;
- login bootstrap;
- profile refresh;
- request create/submit;
- receipt upload state;
- schedule conflict handling;
- notification routing.

### End-to-end
Use an Expo-compatible E2E approach selected after scaffold/tool audit.

Candidate tools may include Maestro or Detox, but do not add both.

Prioritize real-device critical-path scenarios.

## 3. Auth matrix

Test:
- fresh email registration;
- email verification;
- profile completion;
- existing email login;
- Google login;
- Google account switching if supported;
- logout;
- app relaunch restored session;
- expired/revoked session;
- backend profile failure;
- 401 retry once;
- 403 no retry loop;
- user A logout → user B login cache isolation.

## 4. Request workflow matrix

Test:
- create valid draft;
- validation error;
- add 1 supporting file;
- add max supported files;
- oversized file;
- unsupported type;
- submit;
- correction state;
- resubmit corrections;
- cancel eligible;
- forbidden/invalid cancel;
- tracking by ID/list;
- history accuracy.

## 5. Payment matrix

Test:
- payment config present;
- QR absent;
- QR present;
- 5 MB boundary;
- PNG receipt;
- JPEG receipt;
- HEIC receipt selection on iOS;
- conversion path;
- upload success;
- upload timeout/ambiguous failure;
- duplicate taps;
- backend duplicate receipt flag behavior as observable;
- OCR pending/failure does not show verified;
- payment correction state.

## 6. Scheduling matrix

Test:
- load available slots;
- empty slots;
- parish closure;
- date validation;
- successful submit;
- double tap submit;
- concurrent slot loss/conflict;
- reschedule proposal;
- accept;
- decline;
- refresh after response;
- timezone/date display.

## 7. Event/parish matrix

Test:
- parish list;
- search/filter;
- detail;
- event discovery;
- month boundary;
- empty events;
- map with/without location permission if included;
- location denied.

## 8. Notification matrix

Test:
- unread list;
- mark one read;
- mark all;
- reference to request;
- reference to schedule;
- stale/deleted reference;
- badge count.

## 9. Network matrix

At minimum:
- offline before screen load;
- offline after cache;
- timeout;
- DNS/server unavailable;
- 429;
- 500;
- connection loss during upload;
- connection loss after mutation may have reached server.

Mutation UX must not create automatic duplicate retries.

## 10. Device matrix

Minimum recommended:

### Android
- small/older phone width;
- common mid-size phone;
- recent Android version;
- physical device for camera/file flows.

### iOS
If iOS is in project scope:
- small-screen simulator/device;
- modern iPhone;
- physical device for HEIC/camera/auth when possible.

Also test:
- portrait;
- landscape only where supported;
- font scaling;
- dark mode if app supports it;
- reduced motion.

## 11. Viewport/layout checks

React Native uses device points rather than browser pixels, but verify representative widths approximately corresponding to:
- compact phones;
- standard phones;
- large phones;
- tablets if supported.

Tablet support should be intentional; do not stretch phone cards across huge widths without max content layout.

## 12. Accessibility QA

Test:
- screen reader labels;
- logical reading order;
- 44×44-ish touch targets;
- font scale 130–200% for critical screens;
- no color-only statuses;
- contrast;
- modal/sheet dismissal;
- keyboard focus where external keyboard is relevant;
- form error announcement.

## 13. Performance QA

Watch:
- cold start;
- auth bootstrap duration;
- long request lists;
- calendar/event rendering;
- image memory;
- large file selection;
- repeated navigation memory leaks;
- excessive refetches.

Do not optimize based only on synthetic benchmarks. Measure real device behavior.

## 14. Security regression

Verify mobile cannot:
- call staff mutations through exposed UI;
- read another user's request by changing local route ID;
- trust client role values;
- expose R2 secrets;
- log auth tokens;
- retain user A cache after logout.

Backend should still reject direct tampering.

## 15. Build gates

Before feature commit:
- lint;
- TypeScript;
- feature/unit tests;
- relevant build/start checks;
- diff/format check.

Before milestone:
- Android build/install;
- critical-path manual QA;
- iOS build if in scope;
- backend regression tests for touched contract;
- web portal builds if backend contract changed.

## 16. Manual test evidence

Completion reports should distinguish:

```text
Statically verified
Simulator verified
Android physical device verified
iOS physical device verified
Backend integration verified
Not verified
```

Never collapse them into "tested" without detail.

## 17. Bug severity

### Critical
- auth bypass;
- cross-user data exposure;
- destructive unintended mutation;
- credential/secret leak.

### High
- unable to login/register;
- duplicate payment/request/schedule mutation;
- trapped onboarding;
- wrong user's data displayed.

### Medium
- incorrect status UX;
- inaccessible critical control;
- upload format bug;
- stale data requiring restart.

### Low
- spacing/animation/copy issue with workaround.

# TESTIMONIUM Parishioner Mobile — Decisions & Change Control

**Purpose:** Prevent stale architecture assumptions as mobile and backend evolve.

## 1. Baseline snapshot

As of 20 August 2026:

- Backend: Express 5, Prisma 7, PostgreSQL, Firebase Admin, R2, OCR.
- Parishioner web: React/Vite/Firebase.
- Admin portal: React/Vite/Firebase.
- Mobile: Expo/React Native scaffold exists.
- API namespace: `/api/v1`.
- Roles: PARISHIONER, SECRETARY, PRIEST, DIOCESE_COORDINATOR.
- Mobile target role: PARISHIONER.
- R2 uploads go through backend.
- OCR does not auto-verify payments.
- Native push device registration is not documented yet.
- RAG chatbot is deferred pending knowledge-base readiness.

## 2. Decision status labels

Use:
- `PROPOSED`
- `ACCEPTED`
- `SUPERSEDED`
- `REJECTED`
- `DEFERRED`

## 3. Initial decisions

### M-001 — Existing backend is the mobile backend
**Status:** ACCEPTED

Mobile consumes `/api/v1`; it does not get a separate business backend.

### M-002 — Mobile is parishioner-only
**Status:** ACCEPTED

Staff remains in admin portal unless future product scope explicitly changes.

### M-003 — API/business rules remain authoritative
**Status:** ACCEPTED

Mobile does not duplicate fee, status, tenancy, schedule conflict, payment verification, or profile-completion rules.

### M-004 — Native mobile UX, not pixel web port
**Status:** ACCEPTED

Use mobile navigation and controls while preserving capability/brand parity.

### M-005 — RAG assistant deferred
**Status:** ACCEPTED

No production chatbot until knowledge governance/corpus exists.

### M-006 — Native push deferred until backend support
**Status:** ACCEPTED

Implement in-app notifications first.

### M-007 — Direct R2 upload prohibited
**Status:** ACCEPTED

All uploads remain through backend.

### M-008 — Offline mutations deferred
**Status:** ACCEPTED

No background queue for transactional workflows in v1.

## 4. Decisions still requiring scaffold audit

### M-009 — Navigation library
**Status:** PROPOSED

Decision after inspecting scaffold:
- keep Expo Router if already established;
- keep React Navigation if already established;
- do not migrate without reason.

### M-010 — Server-state library
**Status:** PROPOSED

Evaluate TanStack Query if no equivalent exists.

### M-011 — Firebase mobile integration
**Status:** PROPOSED

Choose based on existing scaffold, Expo compatibility, and Google auth requirements.

### M-012 — Map library
**Status:** PROPOSED

Evaluate mobile-native map solution only after parish list/detail is stable.

### M-013 — E2E tool
**Status:** PROPOSED

Choose one compatible tool (e.g. Maestro or Detox) after build workflow is clear.

## 5. Change protocol

When a backend/API change occurs:
1. record reason;
2. update backend code;
3. migration if schema changes;
4. backend tests;
5. update `API_DOCUMENTATION.md`;
6. update relevant mobile doc;
7. update mobile provider/types;
8. consider compatibility with already released app versions;
9. record decision if architectural.

## 6. Documentation precedence

Highest practical authority:
1. live backend route/validator/controller/service + Prisma schema;
2. reconciled API/database docs;
3. mobile architecture docs;
4. implementation plan;
5. UI copy/comments.

If lower-level docs conflict, fix them.

## 7. ADR template

Add entries below as needed.

```md
## M-0XX — Decision title

**Date:** YYYY-MM-DD
**Status:** PROPOSED | ACCEPTED | SUPERSEDED | REJECTED | DEFERRED

### Context
What changed or what problem exists?

### Decision
What are we doing?

### Alternatives considered
- Option A
- Option B

### Security / data impact
Any auth, privacy, tenancy, persistence, or migration effects.

### Mobile compatibility impact
Does this affect released clients?

### Consequences
Positive and negative.

### Follow-up
Tests/docs/migrations/tasks.
```

## 8. Feature change template

```md
### Feature
Name:

### Old behavior
...

### New behavior
...

### Backend contract changed?
Yes/No

### Schema changed?
Yes/No

### Security/role impact
...

### Mobile docs to update
...

### Release compatibility
...
```

## 9. Known architectural watch items

Track during mobile work:
- Firebase mobile Google account-selection behavior;
- exact mobile session timeout policy;
- HEIC receipt conversion;
- R2 public URL confidentiality;
- native push backend support;
- API idempotency if offline/retry needs grow;
- old mobile-version compatibility after API changes;
- parish/event map data shape;
- RAG knowledge governance.

## 10. Rule for future updates

When the product owner provides a newer project document or confirmed implementation walkthrough:
- treat the newer confirmed behavior as the new baseline;
- update the relevant mobile doc rather than preserving outdated assumptions;
- mark superseded architecture decisions explicitly when important.

## 8. Phase 0 implementation reconciliation � 20 August 2026

- **M-009 Expo Router:** ACCEPTED. Implemented with Expo SDK 57 and `Stack.Protected`; the root bootstrap gate exposes auth, onboarding, or parishioner tabs only after a deterministic state.
- **M-010 TanStack Query:** ACCEPTED. Query retries are conservative and mutations never auto-retry. All future private query keys must include Firebase UID.
- **M-011 Firebase mobile integration:** ACCEPTED (native development build required). Firebase JavaScript SDK 12 no longer exports React Native persistence, so the supported native `@react-native-firebase/app` + `auth` stack is used with platform-managed persistent auth. The obsolete `firebase/auth/react-native` import is not used.
- **SDK/tooling:** Expo SDK 57, React 19.2.3, React Native 0.86.2, and TypeScript 6.0.3 were selected by Expo's resolver for the current Node 25.8.1 runtime.
- **Deferred:** Google authentication (Firebase Android OAuth clients are absent), EAS configuration, SecureStore/session-limit policy, forms, image handling, proactive network monitoring, product features, and RAG.
- **Auth safety:** Interactive email login owns its backend `POST /auth/login`; passive restores use only `GET /auth/profile`. Auth generation and UID checks discard stale results. A failed backend bootstrap clears local protected data and signs Firebase out.
- **Environment:** `.env.example` contains public client configuration only. No server/database/storage credentials are present.

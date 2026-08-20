# TESTIMONIUM Parishioner Mobile — Documentation Index

**Baseline date:** 20 August 2026  
**Target application:** `testimonium-parishioner-app`  
**Status:** Mobile planning baseline; update as implementation evolves.

## Purpose

This documentation pack defines the initial product, architecture, engineering, design, integration, security, testing, and release rules for the TESTIMONIUM parishioner mobile application.

It is intentionally based on the current repository documentation and implemented backend contract as of 20 August 2026:

- `README.md`
- `API_DOCUMENTATION.md`
- `CLOUDFLARE_R2.md`
- `Testimonium_Database_Schema.md`
- `testimonium_context.md`

The operational source of truth remains the live backend route modules/controllers/validators/services and `testimonium-backend/prisma/schema.prisma`. When documentation and code disagree, reconcile the documentation to the implemented backend before changing the mobile client.

## Core architectural principle

> The mobile app is another parishioner client of the existing TESTIMONIUM backend. It must not become a second business-rules engine.

The backend remains authoritative for authentication/authorization outcomes, profile completion, tenancy, document requirements, request state transitions, fees, payment state, duplicate-receipt handling, scheduling availability, capacity, conflicts, and workflow permissions.

## Documents in this pack

| File | Purpose |
| --- | --- |
| `01_MOBILE_PRODUCT_SCOPE.md` | Mobile v1 scope, goals, non-goals, user journeys, acceptance criteria. |
| `02_MOBILE_ARCHITECTURE.md` | Runtime architecture, module boundaries, folder structure, API/auth/data flow, error boundaries. |
| `03_MOBILE_ENGINEERING_RULES.md` | Binding implementation rules for developers and coding agents. |
| `04_MOBILE_DESIGN_SYSTEM.md` | Mobile visual language, accessibility, responsive/native interaction rules, component guidance. |
| `05_MOBILE_NAVIGATION_AND_SCREEN_MAP.md` | Proposed information architecture, route groups, tab/stack behavior, deep-link targets. |
| `06_MOBILE_BACKEND_API_CONTRACT.md` | Current backend endpoints relevant to mobile, integration rules, error/retry policy. |
| `07_MOBILE_AUTH_SESSION_SECURITY.md` | Firebase auth, backend bootstrap, session handling, secure storage, race prevention. |
| `08_MOBILE_STATE_DATA_OFFLINE.md` | Server state, local state, caching, offline behavior, invalidation, mutation policy. |
| `09_MOBILE_UPLOADS_PAYMENTS_MEDIA.md` | R2-backed uploads, image/document selection, receipt rules, QR/payment UX, HEIC handling. |
| `10_MOBILE_NOTIFICATIONS_DEEPLINKING.md` | Current in-app notifications and future native push/deep-link design. |
| `11_MOBILE_TESTING_QA.md` | Test pyramid, role/security regressions, device matrix, accessibility and release QA. |
| `12_MOBILE_ENV_BUILD_RELEASE.md` | Environment model, Expo/EAS recommendations, secrets, build channels, release checklist. |
| `13_MOBILE_IMPLEMENTATION_ROADMAP.md` | Phased implementation order with exit criteria and dependency gates. |
| `14_MOBILE_RAG_FUTURE.md` | Deferred RAG assistant architecture, prerequisites, safety and knowledge governance. |
| `15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md` | Current decisions, open questions, documentation update rules, architecture decision log template. |

## Current mobile product boundary

The mobile app is **parishioner-facing**. Staff functions remain in `testimonium-admin-portal`.

Current backend roles are:

- `PARISHIONER`
- `SECRETARY`
- `PRIEST`
- `DIOCESE_COORDINATOR`

The mobile app should authenticate parishioners and consume parishioner-safe/authenticated discovery APIs. Do not expose staff mutation screens simply because the API has staff endpoints.

## Deferred feature

The AI chatbot/RAG feature is intentionally deferred. No mobile implementation should add a placeholder LLM flow that creates a false dependency on an incomplete knowledge base. See `14_MOBILE_RAG_FUTURE.md`.

## How to use this pack with coding agents

For planning:
1. Give the agent this index plus the documents relevant to the task.
2. Tell it to inspect actual repository code before proposing file changes.
3. Treat backend contracts and security rules as binding.
4. Require an implementation plan before cross-layer changes.
5. Require lint/type/build/test output and a truthful list of unverified runtime behavior.

For execution:
- Include `03_MOBILE_ENGINEERING_RULES.md`.
- Include the feature-specific document.
- Include `06_MOBILE_BACKEND_API_CONTRACT.md` for any API feature.
- Include `07_MOBILE_AUTH_SESSION_SECURITY.md` for auth/session/profile work.
- Include `09_MOBILE_UPLOADS_PAYMENTS_MEDIA.md` for files, receipts, camera, QR, or payment work.

## Baseline change rule

These documents are a snapshot, not immutable doctrine. As TESTIMONIUM changes:

- newest confirmed backend behavior supersedes older notes;
- schema changes require migrations and documentation updates;
- endpoint changes require API documentation updates;
- mobile architecture changes should be recorded in `15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md`;
- do not silently preserve obsolete mobile assumptions for backward compatibility unless explicitly required.

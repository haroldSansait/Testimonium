# TESTIMONIUM Parishioner Mobile — Documentation Index

**Baseline date:** 24 August 2026
**Target application:** `testimonium-parishioner-app`
**Status:** Phases 1–7 fully implemented, statically and unit verified (22 suites, 161 tests passing).

## Purpose

This documentation pack defines the product scope, architecture, engineering rules, design system, navigation structure, API contracts, security lifecycle, data management, media handling, notifications, QA matrix, build workflows, and decision log for the TESTIMONIUM parishioner mobile application.

It is fully reconciled with the current repository documentation and implemented backend contracts as of 24 August 2026:

- `README.md`
- `API_DOCUMENTATION.md`
- `CLOUDFLARE_R2.md`
- `Testimonium_Database_Schema.md`
- `testimonium_context.md`

The operational source of truth remains the live backend route modules, controllers, validators, services, and `testimonium-backend/prisma/schema.prisma`.

## Core architectural principle

> The mobile app is another parishioner client of the existing TESTIMONIUM backend. It must not become a second business-rules engine.

The backend remains authoritative for authentication/authorization outcomes, profile completion, tenancy, document requirements, request state transitions, fee snapshots, payment state, duplicate-receipt detection, scheduling configuration, availability, slot capacity, conflicts, and workflow permissions.

## Documents in this pack

| File | Purpose |
| --- | --- |
| `01_MOBILE_PRODUCT_SCOPE.md` | Product scope, user journeys, implemented features, non-goals, and acceptance criteria. |
| `02_MOBILE_ARCHITECTURE.md` | Runtime architecture, folder structure, API/auth/data flow, error boundaries, and state model. |
| `03_MOBILE_ENGINEERING_RULES.md` | Binding implementation rules for mobile developers and coding agents. |
| `04_MOBILE_DESIGN_SYSTEM.md` | Mobile visual language, design tokens, UI components, accessibility, and interaction rules. |
| `05_MOBILE_NAVIGATION_AND_SCREEN_MAP.md` | Information architecture, route groups, tab/stack hierarchy, deep links, and modal flows. |
| `06_MOBILE_BACKEND_API_CONTRACT.md` | Endpoints consumed by mobile, payload contracts, idempotency, and error handling. |
| `07_MOBILE_AUTH_SESSION_SECURITY.md` | Native Firebase auth, Google JIT login, email verification, session gating, and cache isolation. |
| `08_MOBILE_STATE_DATA_OFFLINE.md` | Server state with TanStack Query, query-key discipline, cache clearing, and offline strategy. |
| `09_MOBILE_UPLOADS_PAYMENTS_MEDIA.md` | Cloudflare R2 uploads, HEIC-to-JPEG conversion, receipt capture, QR display, and OCR review copy. |
| `10_MOBILE_NOTIFICATIONS_DEEPLINKING.md` | In-app notification inbox, read/unread status, reference-based deep linking, and future push prep. |
| `11_MOBILE_TESTING_QA.md` | Quality strategy, test pyramid (22 suites, 161 tests), device matrix, accessibility, and QA checklist. |
| `12_MOBILE_ENV_BUILD_RELEASE.md` | Environment configuration, Quick Tunnel mobile dev launcher, EAS build profiles, and release gates. |
| `13_MOBILE_IMPLEMENTATION_ROADMAP.md` | Implementation phase tracker (Phases 0–7 completed, Phase 8 physical QA in progress). |
| `14_MOBILE_RAG_FUTURE.md` | Deferred RAG assistant architecture, knowledge governance prerequisites, and safety rules. |
| `15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md` | Architecture decision records (M-001 through M-026), reconciliation history, and change control. |

## Current mobile product boundary

The mobile app is strictly **parishioner-facing**. Staff functions remain in `testimonium-admin-portal`.

Current backend roles are:
- `PARISHIONER`
- `SECRETARY`
- `PRIEST`
- `DIOCESE_COORDINATOR`

The mobile app authenticates parishioners and consumes parishioner-safe discovery and operational APIs. Any non-parishioner role is safely blocked at the session bootstrap level.

## Deferred feature

The AI chatbot/RAG feature is intentionally deferred. No mobile implementation should add a placeholder LLM flow that creates a false dependency on an incomplete knowledge base. See `14_MOBILE_RAG_FUTURE.md`.

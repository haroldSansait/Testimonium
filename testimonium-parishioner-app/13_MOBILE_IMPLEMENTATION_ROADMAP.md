# TESTIMONIUM Parishioner Mobile — Implementation Roadmap

## 0. Phase 0 — Scaffold Audit & Foundations

### Goal
Understand the existing `testimonium-parishioner-app` scaffold before implementation.

### Audit
- Expo SDK/version.
- TypeScript config.
- navigation library.
- Firebase packages.
- existing theme/components.
- existing env config.
- testing tools.
- EAS config.
- package scripts.

### Implement
- final folder boundaries;
- theme tokens;
- API client skeleton;
- normalized error type;
- auth provider/bootstrap skeleton;
- app-level loading/error boundary;
- base navigation shell.

### Exit criteria
- app launches;
- no placeholder architecture conflicts;
- dev API config works;
- lint/type checks clean.

---

## 1. Phase 1 — Authentication & Onboarding

### Scope
- login;
- registration;
- Google auth if supported;
- email verification;
- legal acceptance;
- profile completion;
- session restore;
- logout.

### Key risks
- auth observer race;
- backend bootstrap race;
- profile completion loop;
- user cache leakage;
- Google account selection behavior.

### Exit criteria
- new and existing accounts work;
- app restart restore works;
- logout clears state;
- no protected-screen flash;
- backend profile is authoritative.

---

## 2. Phase 2 — Mobile Shell, Home & Parish Directory

### Scope
- bottom tabs;
- Home;
- parish directory;
- parish detail;
- events preview;
- notifications badge shell.

### Optional
- mobile-native map after list view is stable.

### Exit criteria
- parishioner can browse parishes/events;
- no admin controls exposed;
- shell/accessibility stable.

---

## 3. Phase 3 — Document Request Core

### Scope
- request list;
- request detail;
- request creation draft;
- requirements;
- applicant/purpose fields;
- supporting files;
- review/submit;
- history;
- cancel.

### Key risks
- duplicate drafts;
- draft ID lifecycle;
- file picker behavior;
- stale status.

### Exit criteria
- full non-payment request lifecycle works against API.

---

## 4. Phase 4 — Payment & Receipt Capture

### Scope
- payment config;
- amount/QR;
- camera/library receipt;
- HEIC conversion;
- multipart upload;
- under-review state;
- payment correction state.

### Key risks
- iOS HEIC;
- >5 MB images;
- ambiguous upload retry;
- false OCR/verification copy.

### Exit criteria
- receipt upload is reliable on physical Android;
- iOS path tested if in scope;
- no duplicate submission;
- status truth maintained.

---

## 5. Phase 5 — Scheduling

### Scope
- schedule list/detail;
- event/service type;
- parish/date;
- available slots;
- submit;
- reschedule response.

### Key risks
- slot race;
- timezone;
- stale available slots;
- duplicate submit.

### Exit criteria
- conflict path handled;
- backend remains slot authority;
- reschedule response works.

---

## 6. Phase 6 — Notifications & Event Calendar

### Scope
- notifications list;
- read/unread;
- references;
- event calendar/list;
- internal deep-link framework.

### Native push
Deferred unless backend device-token support is designed and implemented.

### Exit criteria
- in-app notifications useful without background polling abuse;
- reference routing safe.

---

## 7. Phase 7 — Profile, Settings & Polish

### Scope
- profile edit;
- legal info;
- session/logout UX;
- final empty/error/loading states;
- accessibility;
- reduced motion;
- performance.

### Exit criteria
- complete parishioner feature set polished.

---

## 8. Phase 8 — Device QA & Release Engineering

### Scope
- physical Android;
- iOS if applicable;
- camera/file auth;
- app resume/background;
- network loss;
- staging build;
- production build pipeline.

### Exit criteria
- preview build used by team;
- no critical/high bugs;
- store/privacy config reconciled.

---

## 9. Phase 9 — Native Push (Optional Later)

Prerequisites:
- backend device-token model;
- registration/unregistration endpoints;
- server push provider;
- privacy review;
- deep-link routing already stable.

Do not block mobile v1 on this.

---

## 10. Phase 10 — RAG Assistant (Deferred)

Prerequisites defined in `14_MOBILE_RAG_FUTURE.md`.

Do not begin implementation just because a chat UI is easy to build.

---

# Recommended implementation workflow for each phase

1. User writes/updates product intent.
2. Planning model audits actual repository and creates implementation plan.
3. Review plan for architecture/security/races/error handling.
4. Execute with implementation model.
5. Focused independent review only for high-risk changes.
6. Manual/device test proportional to risk.
7. Commit.
8. Update mobile docs/decision log.

# Suggested first action

Before writing mobile screens, perform **Phase 0 scaffold audit** and produce:
- exact package inventory;
- navigation recommendation based on existing scaffold;
- Firebase mobile auth approach;
- current file tree;
- packages to keep/add/remove;
- foundational implementation plan.

Do not skip this audit because the repository already contains a scaffold.

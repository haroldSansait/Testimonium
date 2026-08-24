# TESTIMONIUM Parishioner Mobile — Phase 8 UI/UX Enhancement Plan

**Plan date:** 24 August 2026  
**Target application:** `testimonium-parishioner-app`  
**Phase:** 8 — Full Mobile UI/UX Enhancement  
**Status:** READY TO START  
**Primary platform for physical verification:** Android  
**Implementation scope:** Mobile presentation/UI/UX only

---

## 1. Phase 8 Objective

Phase 8 is a full UI/UX enhancement of the TESTIMONIUM parishioner mobile application.

The goal is to make the mobile app visually and experientially consistent with the current TESTIMONIUM Parishioner Web design while still behaving like a modern native mobile application.

The redesign covers the complete parishioner experience:

- Welcome
- Login
- Registration
- Forgot Password
- Email Verification
- Legal Acceptance
- Profile Completion
- Home
- Requests
- Document Request Wizard
- Request Details
- Payment / Receipt Upload
- Schedule
- Scheduling Wizard
- Schedule Details / Reschedule Response
- Parish Directory
- Parish Details
- Events
- Event Details
- Notifications
- Profile
- Edit Profile
- Settings
- Terms
- Privacy
- loading / empty / error / retry states
- headers, dialogs, cards, inputs, buttons, navigation bars, status elements, and shared UI primitives

Phase 8 is **not** a feature rewrite.

All functionality proven during Phases 1–7 must remain intact.

---

## 2. Roadmap Reconciliation

This plan supersedes the older roadmap entry that described Phase 8 as Device QA & Release Engineering.

The current project sequence is:

```text
Phase 0–7
Functional mobile implementation
STATUS: COMPLETE

Phase 8
Full Mobile UI/UX Enhancement
STATUS: READY TO START

Phase 9
Full Physical Android + Cross-Client QA

Phase 10
Optional Native Push Notifications

Phase 11
Future RAG / AI Assistant
```

Phase 8 will still include focused physical visual verification while redesign work is happening, but the exhaustive final physical/cross-client regression gate belongs to Phase 9.

---

## 3. Canonical Source Hierarchy

Phase 8 must preserve the existing TESTIMONIUM source-of-truth hierarchy.

### Backend

The backend remains authoritative for:

- authentication and authorization outcomes;
- role and tenancy;
- document requirements;
- document availability;
- request state transitions;
- fee snapshots;
- payment configuration;
- payment state;
- scheduling configuration;
- enabled scheduling services;
- dynamic scheduling slots;
- capacity rules;
- availability dates;
- conflicts;
- reschedule behavior;
- notification references;
- workflow permissions.

### Parishioner Web

The current Parishioner Web is the primary reference for:

- TESTIMONIUM parishioner-facing visual identity;
- terminology;
- content hierarchy;
- feature presentation;
- workflow meaning;
- user-facing labels;
- branding direction;
- corresponding screen structure.

The implementation agent must inspect the current `testimonium-parishioner-web` source before redesigning corresponding mobile screens.

### Mobile

Mobile adapts the same system into native mobile UX.

The goal is **visual and capability parity, not a pixel-for-pixel desktop port**.

Mobile may adapt:

- layout;
- spacing;
- stacking;
- touch interactions;
- navigation presentation;
- modal presentation;
- scrolling;
- responsive behavior;
- native keyboard and safe-area behavior.

Mobile must not invent:

- new workflow semantics;
- new service names;
- new document types;
- new scheduling values;
- new configuration;
- new status meanings;
- new business rules.

---

## 4. Hard Scope Boundaries

Phase 8 is presentation-focused.

### Allowed

- React Native styles
- shared UI primitives
- screen composition
- typography
- spacing
- icons
- safe-area handling
- tab-bar presentation
- responsive layout
- visual loading states
- empty states
- error-state presentation
- accessible interaction improvements
- keyboard handling
- scroll behavior
- animation/micro-interaction where appropriate
- visual consistency with Parishioner Web

### Do Not Modify

- `testimonium-backend`
- Prisma schema
- migrations
- database business logic
- authentication semantics
- request workflow semantics
- payment workflow semantics
- scheduling rules
- scheduling endpoints
- idempotency behavior
- Admin Portal configuration flow
- Parishioner Web behavior
- established API payloads unless a purely typing/presentation fix is absolutely required
- canonical route destinations
- the five-tab information architecture

### Protected Working Areas

Do not casually rewrite the already verified infrastructure for:

- multipart supporting-document upload;
- multipart receipt upload;
- HEIC-to-JPEG conversion;
- payment configuration and QR resolution;
- request pagination;
- OCR flow;
- scheduling configuration;
- scheduling availability;
- dynamic time slots;
- schedule idempotency;
- reschedule accept/decline;
- notification reference routing;
- auth mutex/session lifecycle;
- query cache isolation.

Phase 8 should wrap or restyle these systems, not replace them.

---

# 5. Phase 8 Design Direction

## 5.1 Overall Visual Goal

The redesigned app should feel:

- clean;
- modern;
- polished;
- calm;
- trustworthy;
- ecclesiastical without appearing old-fashioned;
- visually related to the current Parishioner Web;
- native to Android/iOS rather than like a website inside a phone.

The canonical TESTIMONIUM crimson remains:

```text
#7B1C2A
```

The redesign may refine surrounding neutral colors, spacing, shadows, surfaces, radii, and typography, but must preserve recognizable TESTIMONIUM brand identity.

---

## 5.2 Web-to-Mobile Adaptation Rule

For every corresponding Parishioner Web screen:

1. inspect the existing Web screen;
2. identify its visual hierarchy;
3. identify reusable brand elements;
4. identify important labels and workflow cues;
5. translate them to a mobile-native composition;
6. preserve capability and meaning;
7. avoid blindly reproducing desktop widths or desktop navigation patterns.

Examples:

```text
Desktop horizontal card row
→ mobile horizontal carousel or vertical stack

Desktop multi-column form
→ mobile single-column form

Desktop header/navigation
→ mobile AppHeader + bottom tabs / stack navigation

Desktop hover affordance
→ mobile pressed state

Desktop large modal
→ mobile sheet/full-screen modal when appropriate
```

---

# 6. Responsive Layout and Device-Safe Foundation

This is a blocking Phase 8 requirement.

The current app has UI overlap on devices using Android's classic three-button navigation bar:

```text
Back | Home | Recents
```

The TESTIMONIUM bottom navigation must never overlap Android system navigation controls.

## 6.1 Safe Area Audit

Audit the entire application for correct use of:

- root safe-area provider;
- `SafeAreaView`;
- `useSafeAreaInsets()`;
- React Navigation / Expo Router safe-area behavior;
- status-bar inset;
- Android navigation-bar inset;
- bottom tab-bar inset;
- keyboard inset;
- fixed bottom CTA inset.

Do not use arbitrary hardcoded device-specific bottom margins as the primary fix.

The layout must react to actual system insets.

---

## 6.2 Bottom Navigation Requirement

The five-tab navigation remains exactly:

```text
Home
Requests
Schedule
Parishes
Profile
```

The bottom tab bar must:

- remain above Android three-button system navigation;
- remain correct under Android gesture navigation;
- respect iOS home-indicator safe area;
- keep icons and labels vertically centered;
- use consistent icon size;
- maintain sufficient touch targets;
- avoid clipped labels;
- avoid excessive bottom whitespace;
- not cover scrollable page content.

If the current tab bar has a fixed height, audit it.

Its layout should account for the actual bottom inset rather than assuming one device configuration.

Scrollable tab screens must also receive enough bottom content padding so their final content is not hidden behind the tab bar.

---

## 6.3 Fixed Bottom Actions

Any screen with a fixed CTA or bottom action area must account for:

```text
bottom safe-area inset
+
action container spacing
+
keyboard state where relevant
```

Examples:

- wizard Continue buttons;
- Submit buttons;
- payment submission controls;
- reschedule action buttons;
- confirmation actions.

No CTA may sit underneath:

- system navigation;
- the tab bar;
- the software keyboard.

---

## 6.4 Responsive Width Strategy

Avoid layouts dependent on one phone size.

Prefer:

- Flexbox;
- `useWindowDimensions()`;
- percentage/flexible widths;
- min/max width constraints;
- wrapping where appropriate;
- reusable spacing tokens;
- adaptive columns only where there is enough width.

Avoid:

- large collections of one-off `Dimensions.get(...)` calculations;
- arbitrary negative margins;
- absolute positioning for normal content;
- pixel offsets tuned to one phone;
- fixed widths that clip translated/large text.

Primary portrait validation ranges:

| Device class | Approx. width |
| --- | --- |
| Compact Android | 320–359 dp |
| Common Android | 360–392 dp |
| Large Android / iPhone | 393–430 dp |
| Larger devices | >430 dp |

The app does not need a tablet-specific redesign in Phase 8, but layouts must not catastrophically stretch or overlap on wider devices.

---

# 7. Shared Design-System Refactor

Before redesigning screens independently, establish/refine reusable primitives.

Existing reusable components should be audited before creating replacements.

## 7.1 Tokens

Centralize/refine:

- colors;
- typography;
- spacing;
- radii;
- border widths;
- shadows/elevation;
- icon sizes;
- component heights;
- screen horizontal gutters;
- section spacing;
- safe bottom spacing.

Avoid random hex values and arbitrary spacing scattered across feature screens.

---

## 7.2 Typography

Create a clear hierarchy suitable for mobile:

- display / auth hero;
- screen title;
- section title;
- card title;
- body;
- supporting text;
- caption;
- metadata;
- button text;
- form label.

Typography must support system font scaling without:

- clipping;
- overlapping;
- hiding actions;
- forcing important labels off-screen.

---

## 7.3 Icon System

Audit all icons for:

- visual consistency;
- size consistency;
- stroke/fill consistency;
- vertical alignment;
- baseline alignment with text;
- appropriate touch container;
- active/inactive state consistency.

Centralize common icon sizing instead of assigning slightly different sizes on every screen.

Icon-only buttons require accessible labels.

---

## 7.4 Shared Components to Audit / Enhance

At minimum:

- `AppHeader`
- `Card`
- `IconButton`
- `Badge`
- `SectionHeader`
- `Skeleton`
- `EmptyState`
- `InlineError`
- `LoadingOverlay`
- `Button`
- `Input`
- `StepIndicator`

Potential reusable additions should only be created if they reduce duplication, such as:

- `Screen`
- `ScreenScrollView`
- `FormSection`
- `ListCard`
- `StatusCard`
- `BottomActionBar`
- `SearchField`
- `FilterChip`
- `InfoRow`
- `TimelineItem`

Do not create parallel component systems for individual features.

---

# 8. Screen-by-Screen Enhancement Plan

## 8A — Visual Audit & Foundation

### Tasks

- inspect current Parishioner Web implementation;
- compare Web and Mobile auth, home, feature screens, and shared patterns;
- inventory all mobile screens;
- inventory spacing/icon/alignment inconsistencies;
- inventory absolute positioning and hardcoded screen-size assumptions;
- identify duplicated visual components;
- audit safe-area usage;
- audit keyboard handling;
- audit scroll containers;
- audit tab-bar implementation;
- establish final Phase 8 mobile token set.

### Deliverable

A consistent reusable UI foundation before large screen-by-screen styling begins.

---

## 8B — Welcome, Authentication & Onboarding

### Screens

- `welcome.tsx`
- `login.tsx`
- `register.tsx`
- `forgot-password.tsx`
- `verify-email.tsx`
- `legal.tsx`
- `profile-completion.tsx`

### Goals

Bring authentication visually close to the current Parishioner Web authentication experience while optimizing it for one-handed mobile use.

### Improve

- brand/logo placement;
- hero hierarchy;
- form card/surface presentation;
- input spacing and icons;
- password visibility controls;
- Google Sign-In presentation;
- primary/secondary CTA hierarchy;
- legal links;
- keyboard avoidance;
- scroll behavior on smaller devices;
- validation message spacing;
- loading/disabled states;
- safe-area top and bottom padding.

### Preserve

- Firebase auth implementation;
- Google JIT flow;
- `interactiveOperationRef`;
- email verification behavior;
- legal-acceptance semantics;
- profile completion behavior;
- session bootstrap.

---

## 8C — App Shell, Header & Bottom Navigation

### Goals

Create a polished, stable global shell used throughout the authenticated application.

### Improve

- `AppHeader`;
- screen title alignment;
- back button alignment;
- notification bell placement;
- header spacing;
- status-bar relationship;
- tab icon/label alignment;
- selected/unselected states;
- system safe-area handling;
- content padding relative to bottom tabs.

### Required Outcome

No overlap with Android:

```text
Back | Home | Recents
```

No content hidden underneath the app tab bar.

---

## 8D — Home

### Preserve current Home capability

- personalized greeting;
- quick actions;
- active request tracking;
- parish discovery entry;
- current-month event previews;
- notifications entry.

### Redesign goals

Make Home feel visually close to the current Web Home while using a stronger mobile hierarchy.

Suggested hierarchy:

```text
Header / Greeting
↓
Primary action / important current state
↓
Quick actions
↓
Active requests
↓
Upcoming events
↓
Explore parishes / supporting content
```

Avoid placing too many equal-weight cards on the first viewport.

Priority information should be immediately understandable.

---

## 8E — Requests & Document Workflow

### Screens

- Requests tab
- New Document Request Wizard
- Request Detail
- Correction UI
- Payment entry

### Improve

- request cards;
- filter chips/tabs;
- status presentation;
- tracking-number hierarchy;
- empty state;
- timeline;
- requirement checklist;
- form grouping;
- wizard step presentation;
- upload card;
- file preview;
- correction banners;
- cancellation confirmation;
- sticky/fixed wizard controls with safe-area handling.

### Preserve

The exact five-step workflow:

```text
Parish
→ Document Type & Requirements
→ Applicant Details
→ Attachments
→ Review
```

Do not change request APIs or business rules.

---

## 8F — Payment & Receipt Experience

### Improve

- fee hierarchy;
- parish payment instructions;
- QR card;
- QR enlarge interaction;
- receipt source selection;
- receipt preview;
- upload progress/loading state;
- staff-review messaging;
- correction messaging;
- spacing on small screens;
- fixed submit controls.

### Preserve

- backend payment configuration;
- fee snapshot;
- generic parish-configured QR;
- multipart transport;
- HEIC conversion;
- receipt upload contract;
- OCR semantics;
- mandatory staff verification.

Never introduce fake fallback amounts or fake payment configuration.

---

## 8G — Scheduling

### Screens

- Schedule tab
- Scheduling Wizard
- Schedule Detail
- Reschedule response

### Improve

- upcoming/past list segmentation;
- appointment cards;
- status hierarchy;
- service selection cards;
- calendar visuals;
- available-date states;
- slot cards;
- selected states;
- confirmation summary;
- reschedule proposal presentation;
- accept/decline actions;
- sticky wizard/footer controls;
- loading/conflict states.

### Preserve the exact five-step workflow

```text
Parish
→ Service
→ Date
→ Time Slot
→ Confirmation
```

### Preserve all authoritative scheduling behavior

- enabled services;
- configuration;
- available dates;
- dynamic slots;
- daily capacity;
- per-slot capacity;
- idempotency;
- stale-config revalidation;
- conflict handling;
- reschedule behavior.

No hardcoded service or slot values may be introduced during redesign.

---

## 8H — Parish Directory & Parish Detail

### Improve

- search field;
- filter controls;
- parish cards;
- imagery;
- parish metadata hierarchy;
- office hours;
- contact actions;
- available documents;
- events preview;
- gallery presentation;
- mobile-friendly spacing.

Contact actions must remain clearly touchable:

- phone;
- email;
- maps/location.

---

## 8I — Events & Notifications

### Events

Improve:

- month navigation;
- event card hierarchy;
- date/time formatting;
- location;
- assigned priest presentation where applicable;
- empty/error states;
- event detail composition.

### Notifications

Improve:

- unread distinction;
- notification icon/type hierarchy;
- timestamp placement;
- touch target;
- mark-all-read control;
- empty state;
- safe reference routing presentation.

Preserve:

```text
DOCUMENT_REQUEST → Request Detail
SCHEDULE_REQUEST → Schedule Detail
GENERAL → informational / no fake resource navigation
```

---

## 8J — Profile, Settings & Legal

### Improve

- profile header;
- identity/contact hierarchy;
- account/verification badge;
- settings rows;
- icons;
- dividers;
- edit profile form;
- legal viewer readability;
- app version/build presentation;
- destructive sign-out treatment.

Preserve backend profile synchronization and current legal/session behavior.

---

# 9. Modern Mobile UX Requirements

## 9.1 Touch

Interactive controls must provide at least a 44×44 pt effective target.

Avoid tiny icon-only controls without padded hit areas.

---

## 9.2 Forms

Forms must:

- keep focused inputs visible above the keyboard;
- use correct keyboard type;
- show useful validation near the field;
- avoid giant dead areas;
- maintain consistent label/input spacing;
- provide a clear primary action;
- disable repeated submit while mutation is pending.

---

## 9.3 Feedback

Every server-backed section must retain:

- loading;
- skeleton/progress;
- empty;
- error;
- retry;
- success/confirmation where appropriate.

Do not trade functional feedback for visual minimalism.

---

## 9.4 Motion

Use subtle motion only where it improves clarity:

- button press feedback;
- state transition;
- accordion expansion;
- modal/sheet entry;
- skeleton loading;
- selected chip/card state.

Avoid decorative animation that delays critical tasks.

---

## 9.5 Accessibility

Maintain:

- sufficient color contrast;
- text labels alongside status color;
- system font scaling;
- screen-reader labels for icon buttons;
- logical focus order;
- touch target size;
- readable error states.

---

# 10. Alignment / Overlap Bug Sweep

Phase 8 must deliberately search for and eliminate:

- overlapping text;
- overlapping cards;
- icons not vertically centered;
- icons with inconsistent optical size;
- tab labels clipped by system navigation;
- headers colliding with the status bar;
- CTA buttons covered by system navigation;
- CTA buttons covered by the software keyboard;
- list content hidden under the tab bar;
- floating buttons covering final list items;
- negative margins used as layout repair;
- fixed-width cards that overflow compact phones;
- long names/emails/status labels breaking rows;
- modal content extending beyond safe bounds;
- input controls clipped when font size increases;
- touch areas smaller than their visual control.

---

# 11. Device Adaptation Test Matrix

During Phase 8, visually verify representative dimensions.

## Android priority

### Navigation modes

- classic 3-button navigation;
- gesture navigation.

### Width classes

- compact;
- standard;
- large.

### Conditions

- keyboard open;
- keyboard closed;
- long content;
- empty content;
- loading;
- error;
- large font scaling;
- long parish/user names.

The user's current physical Android device must specifically pass the bottom-tab / three-button-navigation overlap check.

---

# 12. Implementation Sequence

Do not redesign unrelated screens randomly.

Recommended execution order:

```text
8A  Web/Mobile visual audit + design tokens
 ↓
8B  Safe area + responsive Screen foundation
 ↓
8C  Shared components
 ↓
8D  Welcome/Auth/Onboarding
 ↓
8E  App shell + bottom tabs + Home
 ↓
8F  Requests + Document Wizard
 ↓
8G  Payment
 ↓
8H  Scheduling
 ↓
8I  Parish Directory + Parish Detail
 ↓
8J  Events + Notifications
 ↓
8K  Profile + Settings + Legal
 ↓
8L  Full responsive/alignment/accessibility sweep
 ↓
8M  Phase 8 regression + physical visual verification
```

The implementation can be delivered in coherent frontend batches, but all screens must converge on the same shared system.

---

# 13. Phase 8 Regression Protection

UI work must not break working functionality.

For every redesigned feature:

1. confirm the screen still consumes the same canonical API;
2. confirm mutation payload remains unchanged;
3. confirm query keys/invalidation remain unchanged unless a proven UI bug requires adjustment;
4. confirm navigation destination remains correct;
5. confirm loading/error behavior remains present;
6. confirm physical interaction works;
7. confirm backend-driven values remain backend-driven.

Particular attention:

```text
Auth
→ no new redirect/session loops

Requests
→ uploads still work

Payments
→ QR/receipt/HEIC flow still works

Scheduling
→ dynamic service/date/slot flow still works

Notifications
→ references still route correctly

Profile
→ edits still persist and session remains stable
```

---

# 14. Validation Commands

After each coherent implementation batch:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo export --platform android
git diff --check
git status --short
```

Do not run Expo prebuild as part of ordinary Phase 8 UI work.

Do not require Android Studio or a local Gradle build for JS/TS visual changes.

Use the existing physical-device workflow:

```bash
npm run dev:mobile
```

No new EAS build is required for ordinary JS/TS UI changes supported by the existing development client.

If an implementation unexpectedly requires a new native dependency, stop and report the requirement before adding it.

---

# 15. Phase 8 Documentation Updates

At the end of Phase 8, update at minimum:

- `00_MOBILE_DOCS_INDEX.md`
- `01_MOBILE_PRODUCT_SCOPE.md`
- `02_MOBILE_ARCHITECTURE.md` if shared UI structure changes
- `03_MOBILE_ENGINEERING_RULES.md` if new binding UI rules are established
- `04_MOBILE_DESIGN_SYSTEM.md`
- `05_MOBILE_NAVIGATION_AND_SCREEN_MAP.md` only if presentation-level route behavior changes
- `11_MOBILE_TESTING_QA.md`
- `13_MOBILE_IMPLEMENTATION_ROADMAP.md`
- `15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md`

Do not update docs to claim completion before physical verification is performed.

---

# 16. Phase 8 Definition of Done

Phase 8 is complete only when all of the following are true.

## Visual

- Mobile is recognizably aligned with the current Parishioner Web visual direction.
- Auth through Home no longer feels like an unrelated design.
- Feature screens use the same coherent visual system.
- Typography, cards, icons, spacing, forms, buttons, and status elements are consistent.

## Responsive

- No overlap with Android three-button navigation.
- No overlap with gesture navigation/home indicator.
- No hidden content behind bottom tabs.
- No keyboard-covered critical controls.
- Compact and large phones render correctly.
- Long text does not destroy layout.

## UX

- Navigation remains predictable.
- Actions have clear hierarchy.
- Loading/error/empty states are polished.
- Touch targets remain accessible.
- Multi-step workflows remain understandable.
- No redundant or confusing controls are introduced.

## Functional

- Auth flow still passes.
- Document request flow still passes.
- Payment/receipt flow still passes.
- Scheduling flow still passes.
- Reschedule response still passes.
- Notifications still route correctly.
- Parish/event discovery still passes.
- Profile/settings still pass.

## Architecture

- Backend unchanged unless a separate backend bug is discovered and explicitly escalated.
- Prisma unchanged.
- No business logic duplicated into presentation components.
- Admin-configured values remain dynamic.
- Parishioner Web remains functionally unchanged.
- No fake production fallbacks introduced.
- No native dependency added without explicit approval.

## Quality

- Typecheck passes.
- Lint passes.
- Mobile automated tests pass.
- Android Metro export passes.
- `git diff --check` passes.
- Physical Android visual verification passes.

---

# 17. Exit Gate to Phase 9

Once Phase 8 is visually and functionally complete:

```text
Phase 8
UI/UX Enhancement
→ CLOSED
```

Then proceed to:

```text
Phase 9
Full Physical Android + Cross-Client QA
```

Phase 9 will perform the broader end-to-end release-oriented validation across:

- Mobile;
- Parishioner Web;
- Admin Portal;
- backend workflows;
- cross-client state propagation;
- edge cases;
- device/network conditions.

---

# 18. Implementation Agent Guardrail Summary

```text
REDESIGN PRESENTATION.
DO NOT REWRITE THE SYSTEM.

Parishioner Web
→ visual / terminology / capability reference

Backend
→ business-rule authority

Mobile
→ native presentation of the same TESTIMONIUM system

Preserve:
Auth
Requests
Uploads
Payments
Scheduling
Notifications
Events
Profile
Navigation semantics

Fix:
Visual inconsistency
Spacing
Alignment
Icon placement
Safe areas
System-navigation overlap
Keyboard overlap
Responsive behavior
Screen-size adaptation
Accessibility
Loading/empty/error polish
```

The successful result of Phase 8 is a mobile app that looks and feels intentionally designed for modern phones while remaining the same already-verified TESTIMONIUM system underneath.

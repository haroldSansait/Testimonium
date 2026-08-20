# TESTIMONIUM Parishioner Mobile — Design System & UX Rules

**Design direction:** Parishioner-first, welcoming, ecclesiastical, modern, distinct from the admin portal.

## 1. Identity

The parishioner mobile app should share TESTIMONIUM's visual family but should not look like the staff/admin portal.

Use:
- warm/light app surfaces;
- ecclesiastical crimson/maroon as primary accent;
- restrained serif/display typography for major identity moments only;
- clean sans-serif body/interface typography;
- soft cards and separators;
- generous spacing;
- imagery where it adds parish context.

Avoid:
- dark admin-style navigation rails;
- dense desktop tables;
- repeated `TESTIMONIUM` labels at multiple hierarchy levels;
- arbitrary lettermark placeholders;
- heavy shadows everywhere;
- fake "official/secure" claims not backed by product/legal copy.

## 2. Mobile navigation identity

Recommended primary pattern:
- bottom tab navigation for top-level destinations;
- native stack navigation for details/workflows;
- top app bar with contextual title/actions;
- sheets/modals for short choices;
- full screens for transactional forms.

No sidebar on phones.

## 3. Proposed color roles

Do not hardcode until existing parishioner design tokens are inspected.

Semantic roles:
- `primary`: TESTIMONIUM crimson/maroon;
- `primaryPressed`;
- `primarySoft`;
- `background`;
- `surface`;
- `surfaceElevated`;
- `textPrimary`;
- `textSecondary`;
- `border`;
- `success`;
- `warning`;
- `danger`;
- `info`;
- `disabled`.

Status colors must always be paired with text/icon meaning.

## 4. Typography

Recommended hierarchy:
- Display/brand: sparing.
- Screen title: clear, compact.
- Section title.
- Body.
- Supporting/meta.
- Button/label.
- Caption.

Requirements:
- system font scaling must be supported;
- avoid fixed-height text containers;
- important labels should not truncate at moderate accessibility font sizes;
- line height must remain readable.

## 5. Spacing and touch

Use a consistent spacing scale.

Touch target:
- aim for at least 44×44 pt for interactive controls;
- icon glyph may be smaller, hit area should not be.

Keep primary actions away from gesture/navigation conflicts and provide safe-area padding.

## 6. Home screen

Recommended hierarchy:
1. concise greeting;
2. current actionable status or next appointment;
3. quick actions;
4. recent requests;
5. upcoming events;
6. notifications/reminders.

Do not repeat:
- app name in top bar;
- app name in screen title;
- app name in hero eyebrow;
- app name in every card.

One identity moment is enough.

## 7. Cards

Use cards for grouped, scannable information.

Request card should expose:
- document type;
- target parish;
- tracking number or useful identifier;
- current status;
- last meaningful update;
- next action if one exists.

Do not display internal database IDs.

## 8. Status design

Statuses should use:
- readable label;
- icon where helpful;
- semantic color;
- optional concise explanation.

Do not show raw enum names such as `PAYMENT_NEEDS_CORRECTION` to users. Map to human copy.

Do not fabricate status history.

## 9. Empty states

Every list needs a meaningful empty state.

Examples:
- No requests yet → explain how to start.
- No upcoming schedules → entry to schedule.
- No notifications → calm confirmation.
- No events for current month → offer next/previous period or parish discovery.

Avoid empty states that are just icons with no next step.

## 10. Loading

Use:
- skeletons for list/card loading where stable;
- spinner for short blocking operations;
- indeterminate progress for uploads if byte progress is unavailable.

Never simulate a numeric progress percentage.

Do not show a second "AI processing" delay after a backend response is already available.

## 11. Error states

Inline error for:
- field validation;
- failed section query with local retry;
- upload problem.

Full-screen/session error for:
- unrecoverable auth bootstrap;
- required app update if introduced.

Toast/snackbar for:
- non-blocking success;
- minor retryable actions.

Do not rely on toast alone for a form field error.

## 12. Forms

Principles:
- one clear task per screen/step;
- native keyboard types;
- next/submit keyboard actions;
- avoid dense two-column web layouts;
- preserve user input after recoverable failures;
- show validation close to field;
- explain required documents before file picking.

For multi-step workflows:
- show current step;
- allow back without losing valid input;
- final review before irreversible submission;
- do not imply server acceptance until response succeeds.

## 13. Date and time

Use native/mobile-friendly pickers.

Display timezone context when it can matter. Backend scheduling is authoritative.

Do not parse/format dates through ad-hoc string splitting scattered across screens. Use one date/time utility layer.

## 14. Parish directory/map

List should remain fully usable without map interaction.

If map is included:
- selected parish card remains readable;
- map gestures do not trap scroll/navigation;
- location permission is not required merely to browse;
- "near me" should ask permission only when invoked;
- app should work when permission is denied.

Do not expose admin map editing.

## 15. Payment UX

Payment screen hierarchy:
1. amount due;
2. selected/configured payment method;
3. QR image with enlarge action;
4. concise instructions;
5. receipt upload action;
6. verification expectation.

Truthful copy:
- "Receipt submitted for review."
Not:
- "Payment verified" until backend state says so.

## 16. File picker UX

Offer appropriate sources:
- Camera
- Photo library
- Files

Only show sources compatible with the required upload type.

Receipt flow should make JPEG/PNG requirement clear when necessary.

Show:
- filename;
- type;
- size;
- remove/replace.

## 17. Modal/sheet rules

Use bottom sheet/action sheet for:
- choosing source;
- simple selection;
- short contextual options.

Use full screen or large modal for:
- long forms;
- document preview;
- complex request review.

Ensure:
- close control;
- swipe/back behavior;
- unsaved-change guard when needed.

## 18. Motion

Motion should communicate:
- navigation;
- expansion;
- loading;
- success.

Use subtle duration/easing.

Respect reduced-motion preference.

Do not use decorative animation that slows high-frequency workflows.

## 19. Accessibility

Required:
- accessible labels for icons;
- dynamic type/font scaling;
- contrast;
- no color-only status;
- logical screen-reader order;
- accessible modal names;
- loading announcements;
- errors associated with fields;
- large touch targets;
- text alternatives for meaningful images.

Decorative parish imagery should be marked decorative if it adds no content.

## 20. Copy style

Tone:
- respectful;
- concise;
- calm;
- service-oriented;
- non-technical.

Prefer:
- "Submit receipt"
- "Choose another parish"
- "Your payment is under review"
- "This time slot is no longer available. Choose another."

Avoid:
- API vocabulary;
- database terminology;
- raw enum strings;
- "Something went wrong" when a more actionable message is known;
- security/official claims without support.

## 21. Parishioner vs admin distinction

Admin:
- dense;
- operational;
- management-oriented;
- desktop-first patterns acceptable.

Mobile parishioner:
- task-oriented;
- personal;
- spacious;
- mobile-native;
- fewer simultaneous controls;
- clear next action.

Shared:
- TESTIMONIUM identity;
- semantic statuses;
- backend truth;
- accessible color and typography system.

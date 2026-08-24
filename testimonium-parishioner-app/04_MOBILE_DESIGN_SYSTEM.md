# TESTIMONIUM Parishioner Mobile — Design System & UX Rules

**Design direction:** Parishioner-first, welcoming, ecclesiastical, modern, and accessible.
**Last reconciled:** 24 August 2026

## 1. Visual identity and aesthetic tokens

The TESTIMONIUM mobile app uses a warm ecclesiastical design language distinct from the dense admin portal:

- **Primary Accent (`#7B1C2A`):** Canonical TESTIMONIUM deep maroon / crimson.
- **Surface & Backgrounds:**
  - `background`: `#F8F9FA` (Soft warm off-white)
  - `surface`: `#FFFFFF` (Clean elevated card white)
  - `surfaceElevated`: `#F3F4F6`
- **Typography & Text:**
  - `textPrimary`: `#1A1A1A`
  - `textSecondary`: `#6B7280`
  - `textMuted`: `#9CA3AF`
- **Borders & Dividers:**
  - `border`: `#E5E7EB`
  - `borderStrong`: `#D1D5DB`
- **Semantic Statuses:**
  - `success`: `#15803D` (Soft green `#DCFCE7` background)
  - `warning`: `#B45309` (Soft amber `#FEF3C7` background)
  - `danger`: `#B91C1C` (Soft red `#FEE2E2` background)
  - `info`: `#1D4ED8` (Soft blue `#DBEAFE` background)

## 2. Implemented UI components (`src/components/ui/`)

| Component | Purpose & Accessibility Behavior |
| --- | --- |
| `AppHeader` | Top navigation bar with contextual title, back button, and optional trailing actions (e.g. notification bell). |
| `BottomActionBar` | Sticky bottom container with safe-area padding for primary wizard and modal actions. |
| `FilterChip` | Interactive pill chip for category, date, and status filtering with 44pt touch target. |
| `Card` | Bounded surface container with subtle border radius and shadow for grouping content. |
| `IconButton` | Touch-accessible button with minimum 44×44 pt hit area and explicit `accessibilityLabel`. |
| `Badge` | Status indicator combining text, icon, and semantic color pairings with high contrast. |
| `SectionHeader` | Clean title and optional action link header for dividing dashboard sections. |
| `Skeleton` | Shimmer pulse placeholder for smooth, non-jarring loading states. |
| `EmptyState` | Icon, descriptive message, and actionable primary button when collections are empty. |
| `InlineError` | Localized error banner with a clear retry trigger to isolate screen section failures. |
| `LoadingOverlay` | Semi-transparent spinner overlay for blocking asynchronous operations. |
| `Button` | Primary maroon, secondary outline, ghost, and destructive button variants with built-in loading states. |
| `TextInput` | Text input field supporting icons, error messages, and platform-specific keyboard types. |

## 3. Typography scale

- **Title Large:** 24 pt, Bold (Screen headers, Welcome banner)
- **Title Medium:** 18 pt, SemiBold (Section titles, Modal headers)
- **Body Large:** 16 pt, Regular (Form inputs, primary card text)
- **Body Medium:** 14 pt, Regular (Descriptions, timeline remarks)
- **Caption / Meta:** 12 pt, Medium (Timestamps, tracking numbers, requirements checklist)

All text components support iOS Dynamic Type and Android font scaling without breaking layout boundaries.

## 4. Interaction rules and touch targets

- All clickable elements enforce a minimum touch target of 44×44 pt.
- Destructive actions (e.g. cancel request, sign out) require confirmation dialogs.
- Form inputs automatically scroll into view when the software keyboard appears.
- Forms provide immediate client-side validation feedback upon blur or submit attempt.

## 5. Status mapping and presentation

Raw backend enums are always mapped to human-friendly presentation copy via `src/features/requests/presentation.ts` and `src/features/schedule/presentation.ts`:

- `PENDING` → "Pending Staff Review"
- `UNDER_REVIEW` → "Under Review"
- `NEEDS_CORRECTION` → "Correction Required"
- `PAYMENT_PENDING` → "Payment Required"
- `PAYMENT_UNDER_REVIEW` → "Payment Under Review"
- `PAYMENT_VERIFIED` → "Payment Verified"
- `PROCESSING` → "Processing Certificate"
- `READY_FOR_PICKUP` → "Ready for Pickup"
- `COMPLETED` → "Completed"
- `CANCELLED` → "Cancelled"
- `REJECTED` → "Declined"

Status labels are never communicated through color alone; they are always accompanied by descriptive text and icons.

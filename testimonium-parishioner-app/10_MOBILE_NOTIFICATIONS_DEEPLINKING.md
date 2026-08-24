# TESTIMONIUM Parishioner Mobile — Notifications & Deep Linking

**Last reconciled:** 24 August 2026
**Status:** In-app notifications inbox, reference-based routing, and deep linking scheme fully implemented.

## 1. Implemented in-app notification inbox

The parishioner mobile app provides an in-app notification center (`app/(app)/notifications.tsx` rendering `NotificationListScreen`):

- **Header Integration:** Accessible notification bell icon in `AppHeader` navigating to `/notifications`.
- **Inbox List:** Categorized alerts displaying title, message, relative timestamp, and read/unread status indicator.
- **Mark Actions:** Supports marking individual items as read (`PATCH /notifications/:id/read`) and a global "Mark all as read" button (`PATCH /notifications/read-all`).
- **Empty & Error States:** Provides calm confirmation when inbox is empty and localized retry on network failures.

## 2. Notification reference routing

Notifications include reference metadata linking directly to associated resources:

| Reference Type | Destination Route | Fallback Behavior |
| :--- | :--- | :--- |
| `DOCUMENT_REQUEST` | `/(app)/requests/:referenceId` | If request not found / deleted, displays safe unavailable banner. |
| `SCHEDULE_REQUEST` | `/(app)/schedule/:referenceId` | If schedule not found, displays safe unavailable banner. |
| `GENERAL` | Stays on notification list | Opens alert modal if expanded details exist. |

Tapping a notification automatically marks the item as read and navigates to the target screen.

## 3. Deep-linking architecture

The mobile app registers the `testimonium://` custom URL scheme in `app.config.ts`:

- `testimonium://requests/:id` → Opens specific document request
- `testimonium://requests/:id/payment` → Opens request payment screen
- `testimonium://schedule/:id` → Opens schedule booking detail
- `testimonium://parishes/:id` → Opens parish profile
- `testimonium://events/:id` → Opens event detail
- `testimonium://notifications` → Opens notifications inbox

### Logged-out deep link handling
If a deep link is opened while the user is logged out, the destination URL is retained in memory. Following successful authentication and onboarding profile validation, the app immediately routes to the intended target.

## 4. Native push notifications (Future phase)

Native push notifications (FCM / APNs) remain planned for a subsequent backend release when a device token registration table and dispatch worker are introduced on the server.

# TESTIMONIUM Admin Portal API Documentation

This document describes the backend endpoints, validation rules, pagination behaviors, role-based authorization requirements, and error response formats for the TESTIMONIUM sacramental document processing backend.

---

## 1. Authentication & Security

All routes (except health checkpoints) require authentication using **Firebase ID Tokens** passed in the `Authorization` header:

```http
Authorization: Bearer <Firebase_ID_Token>
```

### Dev Auth Guard Bypass
In `development` environments (when `ENABLE_DEV_AUTH=true`), endpoints can be accessed by passing a mock token:
```http
Authorization: Bearer test-token-coordinator
```
This maps the request to the `coordinator@testimonium.org` account profile.

### Role Authorization
Users are restricted to resources matching their assigned role:
- **`DIOCESE_COORDINATOR`**: Full diocese administration, unrestricted reads and writes.
- **`PRIEST`**: Scoped view/edit of their assigned parish database entries only.
- **`SECRETARY`**: Scoped view/edit of their assigned parish document requests and schedules only.

---

## 2. Standardized Response Formats

All API responses follow a uniform JSON structure.

### Success Envelope (Raw Data)
### Standard Success Envelope (Collection/List)
All collection and list endpoints return a standardized paginated envelope under the `data` property to support consistent scaling:

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 48,
    "page": 1,
    "limit": 25,
    "totalPages": 2
  }
}
```
This avoids mixed return types (arrays vs. objects) and ensures future compatibility.

### Standard Success Envelope (Single Resource)
Single resource requests return the object directly:
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Envelope (Standard & Validation Errors)
All validation failures, authentication/authorization failures, not found, or internal errors return:
```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

## 3. Endpoint Specifications

### 3.1 Authentication

#### Get User Profile
- **Route**: `GET /api/v1/auth/profile`
- **Roles**: All logged-in users.
- **Description**: Returns the active profile details.
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": "1",
    "email": "coordinator@testimonium.org",
    "fullName": "Diocese Coordinator",
    "role": "DIOCESE_COORDINATOR",
    "parish": null
  }
}
```

---

### 3.2 Parish Management

#### List Parishes
- **Route**: `GET /api/v1/parishes`
- **Roles**: `DIOCESE_COORDINATOR`
- **Parameters**:
  - `page` (optional, default: `1`)
  - `limit` (optional, default: `25`)
  - `search` (optional) - partial match on name or patron saint
  - `type` (optional) - `Parish`, `Quasi-Parish`, `Mission Station`
  - `status` (optional) - `Active`, `Inactive`, `Archived` (defaults to active parishes if omitted to respect soft-delete)
- **Response**: List of parish DTOs.

#### Get Parish By ID
- **Route**: `GET /api/v1/parishes/:id`
- **Roles**: `DIOCESE_COORDINATOR`
- **Response**: Single parish DTO.

#### Create Parish
- **Route**: `POST /api/v1/parishes`
- **Roles**: `DIOCESE_COORDINATOR`
- **Validation Rules**:
  - `name`: Required, non-empty string.
  - `type`: Required, must be `Parish`, `Quasi-Parish`, or `Mission Station`.
  - `email`: Optional, must be valid email format.
- **Request Body**:
```json
{
  "name": "St. Joseph Parish",
  "type": "Parish",
  "address": "La Castellana - Canlaon Road, Canlaon City",
  "patronSaint": "St. Joseph",
  "contactNumber": "09281234567",
  "email": "stjoseph.canlaon@diocese.org"
}
```
- **Response**: `201 Created` with created parish DTO. Logs `Parish Created` in audit feed.

#### Update Parish
- **Route**: `PUT /api/v1/parishes/:id`
- **Roles**: `DIOCESE_COORDINATOR`
- **Validation Rules**: Partial updates of creation fields plus:
  - `status`: Optional, must be `Active`, `Inactive`, or `Archived`.
- **Response**: `200 OK` with updated parish DTO. Logs `Parish Updated` in audit feed.

#### Archive Parish
- **Route**: `DELETE /api/v1/parishes/:id`
- **Roles**: `DIOCESE_COORDINATOR`
- **Response**: Standard success message. Logs `Parish Archived` in audit feed.

#### Restore Parish
- **Route**: `POST /api/v1/parishes/:id/restore`
- **Roles**: `DIOCESE_COORDINATOR`
- **Response**: Restored parish DTO. Logs `Parish Restored` in audit feed.

---

### 3.3 User Management

#### List Staff Users
- **Route**: `GET /api/v1/users`
- **Roles**: `DIOCESE_COORDINATOR`
- **Parameters**:
  - `page` (optional)
  - `limit` (optional)
  - `search` (optional) - matches full name, email, or parish name
  - `role` (optional) - `DIOCESE_COORDINATOR`, `PRIEST`, `SECRETARY`
  - `status` (optional) - `Active`, `Inactive`
- **Response**: List of staff user DTOs.

#### Create Staff User
- **Route**: `POST /api/v1/users`
- **Roles**: `DIOCESE_COORDINATOR`
- **Validation Rules**:
  - `name`: Required, non-empty.
  - `email`: Required, must be a valid unique email format.
  - `role`: Required, must be `DIOCESE_COORDINATOR`, `PRIEST`, or `SECRETARY`.
  - `parish`: Optional, must match an existing parish name (ignored for Diocese Coordinator).
- **Request Body**:
```json
{
  "name": "Elena Cruz",
  "email": "secretary.stjoseph@testimonium.org",
  "role": "SECRETARY",
  "parish": "St. Joseph Parish"
}
```
- **Response**: `201 Created` with user DTO and Firebase password reset onboarding setup link. Logs `User Created` in audit feed.

#### Update User
- **Route**: `PUT /api/v1/users/:id`
- **Roles**: `DIOCESE_COORDINATOR`
- **Validation Rules**: Partial updates of creation fields.
- **Response**: Updated user DTO. Logs `User Updated` in audit feed.

#### Disable User
- **Route**: `POST /api/v1/users/:id/disable`
- **Roles**: `DIOCESE_COORDINATOR`
- **Response**: Standard success message. Disables user in Firebase Auth and PostgreSQL. Logs `User Disabled` in audit feed.

#### Enable User
- **Route**: `POST /api/v1/users/:id/enable`
- **Roles**: `DIOCESE_COORDINATOR`
- **Response**: Standard success message. Enables user in Firebase Auth and PostgreSQL. Logs `User Enabled` in audit feed.

#### Trigger Reset Password Link
- **Route**: `POST /api/v1/users/:id/reset-password`
- **Roles**: `DIOCESE_COORDINATOR`
- **Response**: Firebase reset link URL. Logs `Password Reset` in audit feed.

---

### 3.4 Transactional & Scoped Endpoints

#### Document Requests
- **Route**: `GET /api/v1/document-requests`
- **Roles**: `DIOCESE_COORDINATOR`, `PRIEST`, `SECRETARY`
- **Authorization Scoping**: Enforced database query level. Priests and Secretaries only see requests where `parishId` matches their profile's assigned parish. Diocese Coordinators see requests for all parishes.
- **Parameters**: `page`, `limit`, `search`, `status`, `documentType`
- **Response**: Paginated list of document requests.

#### Schedule Requests
- **Route**: `GET /api/v1/schedule-requests`
- **Roles**: `DIOCESE_COORDINATOR`, `PRIEST`, `SECRETARY`
- **Authorization Scoping**: Scoped strictly by parish `parishId` for non-coordinators.
- **Parameters**: `page`, `limit`, `search`, `status`
- **Response**: Paginated list of schedule requests.

#### Calendar Event List
- **Route**: `GET /api/v1/calendar`
- **Roles**: `DIOCESE_COORDINATOR`, `PRIEST`, `SECRETARY`
- **Authorization Scoping**: Scoped strictly by parish `parishId` for non-coordinators.
- **Parameters**:
  - `year`: Required, e.g. `2026`
  - `month`: Required, `1` - `12`
- **Response**: List of schedule event objects.

#### Activity Logs
- **Route**: `GET /api/v1/activity-log`
- **Roles**: `DIOCESE_COORDINATOR`
- **Parameters**: `page`, `limit`, `personnel` (name search), `action` (action string search), `startDate` (ISO string), `endDate` (ISO string)
- **Response**: Paginated audit log records.

---

### 3.5 General Notifications

#### List Notifications
- **Route**: `GET /api/v1/notifications`
- **Roles**: All authenticated users.
- **Response**: Notifications scoped to the active user.

#### Mark All Read
- **Route**: `PATCH /api/v1/notifications/read-all`
- **Roles**: All authenticated users.
- **Response**: Standard success message.

#### Mark One Read
- **Route**: `PATCH /api/v1/notifications/:id/read`
- **Roles**: All authenticated users.
- **Response**: Standard success message.

# TESTIMONIUM Phase 2 Database Specification (Revised)

## Architecture Updates
- Firebase Authentication is the sole authentication provider.
- Remove `password_hash` and use `firebase_uid` (UNIQUE, NOT NULL) as the identity link.
- Keep PostgreSQL as the system of record for application data.
- Keep Cloudflare R2 for all uploaded files.
- Store **R2 object keys** (e.g. `requirements/2026/file.pdf`) instead of full URLs.
- Generate public/signed URLs in the backend only.

## Core Revisions
### Users
- Rename `name` → `full_name`
- Add `firebase_uid`
- Remove `password_hash`
- Keep `email`, `role_id`, `parish_id`, `contact_number`, `status`, timestamps.

### Roles
Use enum:
- PARISHIONER
- SECRETARY
- PRIEST
- VICARIATE_ADMIN

### Document Request Status
Use enum:
- PENDING
- UNDER_REVIEW
- PAYMENT_PENDING
- PAYMENT_VERIFIED
- PROCESSING
- READY_FOR_PICKUP
- COMPLETED
- REJECTED
- CANCELLED

### Document Types
Create a Prisma enum instead of free-text VARCHAR.

### Requirements
Replace `file_path` with `r2_object_key`.

### Payment Proof
Replace `payment_proof_path` with `payment_proof_object_key`.

### Notifications
Add `read_at TIMESTAMP NULL`.

### Activity Logs
Add `user_agent VARCHAR(255) NULL`.

## Prisma Guidance
- Use PostgreSQL enums.
- Preserve all existing relationships from the original schema.
- Add indexes on foreign keys and frequently filtered status fields.
- Add unique constraint on `firebase_uid`.
- Use referential actions appropriate for PostgreSQL (Restrict/Cascade where appropriate).

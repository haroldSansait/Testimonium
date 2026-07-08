# Phase 6B.1 --- Seed Organizational Users (Pre-Authentication)

## Objective

Populate the production database with the official organizational users
of the Vicariate of Canlaon **without creating Firebase Authentication
accounts**. PostgreSQL remains the source of truth while authentication
is linked later.

## Scope

Implement this only in the **backend** (`testimonium-backend`).

## Requirements

### Database

-   Seed the Diocese Coordinator.
-   Seed the 7 official parish priests using the approved assignments.
-   Seed one Secretary account for each parish (placeholder names/emails
    are acceptable if official data is unavailable).
-   Assign correct roles and parish relationships.
-   Leave `firebaseUid` (or equivalent authentication identifier) as
    `NULL`.
-   Mark all seeded users as Active.

### Seeder

Update the existing Prisma seed file only. Do not create a separate
seeder.

The seeder must be idempotent: - Do not create duplicates. - Update
existing records when appropriate. - Use upserts where possible.

### Architecture Rules

-   Do NOT create Firebase Authentication users.
-   Do NOT generate passwords.
-   Do NOT send invitations.
-   Do NOT change authentication logic.
-   Do NOT modify frontend code.
-   Do NOT change Provider interfaces.

### Future Compatibility

Design the data so a future onboarding flow can: 1. Create a Firebase
Authentication account. 2. Receive the Firebase UID. 3. Update the
existing PostgreSQL user by email. 4. Store the UID without creating
duplicate users.

## Verification

-   Verify the Diocese Coordinator exists.
-   Verify all 7 priests exist with the correct parish assignments.
-   Verify each parish has one Secretary.
-   Verify role assignments are correct.
-   Verify parish relationships are correct.
-   Verify all Firebase UID fields remain NULL.
-   Verify no duplicate users are created when the seed is executed
    multiple times.

Run: - `npx prisma db seed` - Confirm the records appear in Supabase.

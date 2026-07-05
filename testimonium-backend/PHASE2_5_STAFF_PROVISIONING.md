# TESTIMONIUM Phase 2.5 - Initial Staff Provisioning & Firebase Account Linking

## Objective

Implement a production-ready authentication flow that supports:

- Pre-provisioned staff accounts
- Automatic Firebase account linking on first login
- Automatic Parishioner account creation for new users
- Role-Based Access Control (RBAC)
- Parish-scoped authorization
- Clean separation between Authentication (Firebase) and Authorization (Supabase PostgreSQL)

This phase extends the existing Firebase Just-In-Time (JIT) provisioning system.

---

# Current Scope

For this phase, seed **only the Firebase accounts that currently exist**.

Do **NOT** seed accounts for the remaining parishes yet.

Those will be added in a future phase without changing the authentication architecture.

Current Firebase accounts:

- coordinator@testimonium.org
- secretary.stjoseph@testimonium.org
- priest.stjoseph@testimonium.org

---

# Existing Architecture

Current backend stack:

- Firebase Authentication
- Express.js
- Prisma ORM
- Supabase PostgreSQL

Authentication flow:

Firebase
↓

Firebase ID Token

↓

Express Backend

↓

firebase-admin verification

↓

AuthService

↓

Prisma

↓

Supabase PostgreSQL

---

# Tasks

## 1. Extend Prisma Seed

Modify `prisma/seed.js`.

Keep existing seed logic for:

- Roles
- Parishes

Add a Staff Users section.

Seed ONLY the following three users.

---

### Diocese Coordinator

Email

coordinator@testimonium.org

Role

DIOCESE_COORDINATOR

Parish

NULL

Status

ACTIVE

firebase_uid

NULL

---

### St. Joseph Parish Secretary

Email

secretary.stjoseph@testimonium.org

Role

SECRETARY

Parish

St. Joseph Parish

Status

ACTIVE

firebase_uid

NULL

---

### St. Joseph Parish Priest

Email

priest.stjoseph@testimonium.org

Role

PRIEST

Parish

St. Joseph Parish

Status

ACTIVE

firebase_uid

NULL

---

Use Prisma upsert.

The seed must remain idempotent.

Running `npx prisma db seed` multiple times must never create duplicate staff records.

---

## 2. Refactor AuthService

Replace the current provisioning flow.

Current behavior:

Firebase UID

↓

Lookup by firebase_uid

↓

If not found

↓

Create PARISHIONER

Replace it with:

Verify Firebase Token

↓

Lookup by firebase_uid

↓

If found

Return user

↓

If not found

Lookup by email

↓

Email exists?

YES

↓

firebase_uid is NULL?

↓

Attach Firebase UID

↓

Return existing role

↓

NO

↓

Email does not exist

↓

Create new PARISHIONER

↓

Return created user

---

## 3. Repository Layer

Repositories remain responsible for all Prisma operations.

UserRepository should expose methods similar to:

- findByFirebaseUid()
- findByEmail()
- updateFirebaseUid()
- create()

No controller may access Prisma directly.

---

## 4. Authentication Middleware

Keep authMiddleware focused only on:

- Reading Bearer token
- Verifying Firebase ID Token
- Calling AuthService
- Attaching normalized application user to req.user

Do not implement role logic inside authMiddleware.

---

## 5. Role Middleware

Keep roleMiddleware generic.

Continue supporting:

checkRole([
    "SECRETARY",
    "PRIEST"
])

No hardcoded emails.

No hardcoded Firebase UIDs.

Authorization must always come from PostgreSQL roles.

---

## 6. Security Rules

Authentication

Firebase

Authorization

Supabase PostgreSQL

Email is used ONLY during the first account-linking process.

After linking, every authenticated request must use firebase_uid.

Reject attempts to attach a Firebase UID that already belongs to another user.

---

## 7. Verification

Run:

npx prisma validate

npx prisma generate

npx prisma db seed

node --check services/AuthService.js

node --check repositories/UserRepository.js

node --check middlewares/authMiddleware.js

npm run dev

---

# Manual Verification

## Test 1

Login using

coordinator@testimonium.org

Expected

- Existing database user found by email
- firebase_uid attached
- Role remains DIOCESE_COORDINATOR
- Parish remains NULL

---

## Test 2

Login using

secretary.stjoseph@testimonium.org

Expected

- Existing Secretary record found
- firebase_uid attached
- Role remains SECRETARY
- Parish remains St. Joseph Parish

---

## Test 3

Login using

priest.stjoseph@testimonium.org

Expected

- Existing Priest record found
- firebase_uid attached
- Role remains PRIEST
- Parish remains St. Joseph Parish

---

## Test 4

Register a completely new Firebase account

Expected

Backend automatically creates

Role

PARISHIONER

Status

ACTIVE

Parish

NULL

firebase_uid

Saved

---

## Test 5

Second login of any existing account

Expected

Lookup occurs immediately using firebase_uid.

No email lookup.

No duplicate user records.

---

# Constraints

Do not recreate migrations.

Do not modify existing API routes.

Do not create Firebase users.

Do not remove JIT provisioning.

Do not hardcode roles inside controllers.

Maintain the Repository → Service → Controller architecture.

The implementation must remain modular, scalable, and production-ready.

---

# Future Expansion

This implementation must be designed so that additional parish staff can later be added simply by extending the seed script.

Future staff accounts for the remaining six parishes should require **no changes** to the authentication flow, database schema, or middleware.

---

# Success Criteria

✓ Coordinator account links automatically on first login

✓ St. Joseph Secretary account links automatically on first login

✓ St. Joseph Priest account links automatically on first login

✓ New Parishioners are created automatically

✓ Firebase handles Authentication

✓ PostgreSQL handles Authorization

✓ Role-Based Access Control works correctly

✓ Parish-scoped permissions are preserved

✓ Seed remains idempotent

✓ Architecture remains clean and production-ready
Act as a Senior Backend Software Engineer operating in fully autonomous Agentic Mode.

You are responsible for scaffolding and implementing the backend architecture for our capstone project:

# TESTIMONIUM
A Digital Portal for Parish Sacramental Document Processing for the Vicariate of Canlaon, Diocese of San Carlos.

Your goal is NOT simply to generate files. Your goal is to build a production-quality backend foundation that follows modern software engineering practices while remaining appropriate for a university capstone.

==================================================
TECH STACK
==================================================

Frontend:
- React

Backend:
- Node.js
- Express
- Prisma ORM

Database:
- Supabase PostgreSQL

Object Storage:
- Cloudflare R2 (S3-compatible)

Authentication:
- Firebase Authentication
- Firebase Admin SDK

Notifications:
- Firebase Cloud Messaging (future implementation)

==================================================
PROJECT STRUCTURE
==================================================

You are currently inside:

testimonium-backend/

The repository already contains:

- .env
- server.js
- prisma/schema.prisma

Do NOT overwrite existing secrets inside .env.

Scaffolding must be idempotent.
Running the setup multiple times must not destroy existing work or configurations.

Do not modify files outside the `testimonium-backend` directory, except for updating the root `TASKS.md` if it exists.

==================================================
ENVIRONMENT VARIABLES
==================================================

The .env already contains:

SUPABASE_DATABASE_URL

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL

FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY

Never print these values.

Never hardcode credentials.

Load all configuration from environment variables.

==================================================
ARCHITECTURE
==================================================

Follow separation of concerns.

Controllers must never communicate directly with Prisma or Cloudflare R2.

Use this architecture:

Routes
↓

Controllers
↓

Services
↓

Repositories
↓

Prisma

Cloudflare interactions must be isolated inside dedicated services.

Validation must be separated from controllers.

==================================================
DEPENDENCIES
==================================================

Initialize npm if necessary.

Install production dependencies:

express
cors
dotenv
helmet
compression
morgan
bcryptjs
multer
zod

firebase-admin

@aws-sdk/client-s3

@prisma/client
@prisma/adapter-pg
pg

Install development dependencies:

nodemon
prisma

==================================================
PRISMA
==================================================

Initialize Prisma if necessary.

Configure Prisma for Supabase PostgreSQL.

Generate Prisma Client.

Do NOT create database models or migrations yet.

Create a singleton Prisma Client.

Validate the Prisma configuration before continuing.

==================================================
DIRECTORY STRUCTURE
==================================================

Ensure these folders exist:

config/
controllers/
routes/
middlewares/
services/
repositories/
validators/
utils/
prisma/

==================================================
SERVER CONFIGURATION
==================================================

Configure Express with:

- dotenv
- helmet
- compression
- express.json()
- express.urlencoded()
- morgan (development only)

Configure dynamic CORS whitelist:

- http://localhost:3000
- http://localhost:3001

Use API versioning.

Example:

/api/v1/health

Create a centralized error handler.

==================================================
AUTHENTICATION
==================================================

Authentication is handled by Firebase Authentication.

The backend must verify Firebase ID Tokens using Firebase Admin SDK.

Create middleware that:

- Reads the Authorization header
- Extracts the Bearer token
- Verifies the Firebase ID Token
- Attaches the authenticated user to req.user

Do NOT implement login or signup routes.

Do NOT issue another JWT unless explicitly requested later.

Application roles and permissions will be stored in PostgreSQL and enforced by the backend after Firebase authentication succeeds.

==================================================
FILE STORAGE
==================================================

Prepare Cloudflare R2 integration.

Use:

@aws-sdk/client-s3

Create:

services/R2Service.js

The service should expose placeholder methods:

- upload()
- download()
- delete()
- generateSignedUrl()

Use:

multer.memoryStorage()

Never store uploaded files on disk.

==================================================
HEALTH ENDPOINT
==================================================

Create:

GET /api/v1/health

Verify:

- Express server
- Prisma database connection

Return JSON similar to:

{
  "status": "healthy",
  "database": "connected",
  "timestamp": "..."
}

Do not expose stack traces or sensitive configuration values.

==================================================
PACKAGE CONFIGURATION
==================================================

Use ES Modules.

Set:

"type": "module"

Scripts:

"dev": "nodemon server.js"

"start": "node server.js"

==================================================
TASKS.md
==================================================

Update TASKS.md after every completed milestone.

Include:

- npm initialization
- dependency installation
- Prisma initialization
- Prisma client generation
- folder scaffolding
- middleware creation
- server configuration
- health endpoint
- validation results
- successful startup verification

==================================================
SELF-HEALING
==================================================

If any dependency installation, Prisma, path, runtime, or configuration errors occur:

1. Diagnose the issue.
2. Explain the root cause.
3. Automatically fix the issue.
4. Continue execution.

Do not stop after the first error.

==================================================
ENGINEERING STANDARDS
==================================================

Produce clean, modular, production-ready code.

Avoid duplication.

Avoid hardcoded values.

Prefer maintainability over cleverness.

Document important architectural decisions with concise comments.

Follow modern Express and Prisma best practices.

This scaffold will become the long-term backend foundation for TESTIMONIUM and should be suitable for future turnover to the Vicariate of Canlaon.
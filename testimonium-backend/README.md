# TESTIMONIUM Backend

Backend API for TESTIMONIUM, a digital portal for parish sacramental document processing for the Vicariate of Canlaon, Diocese of San Carlos.

## Prerequisites

- Node.js 18 or newer
- npm
- Supabase PostgreSQL connection string
- Cloudflare R2 bucket and S3-compatible credentials
- Firebase Admin service account credentials

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and fill in local values. Do not commit secrets.

3. Generate Prisma Client:

   ```bash
   npx prisma generate
   ```

4. Validate Prisma configuration:

   ```bash
   npx prisma validate
   ```

5. Start development server:

   ```bash
   npm run dev
   ```

## Development Workflow

- `npm run dev` starts the API with `nodemon`.
- `npm start` starts the API with Node.
- `GET /api/v1/health` verifies the Express server and Prisma database connectivity.
- Controllers should delegate business logic to services.
- Services should delegate database persistence to repositories.
- Repositories are the only layer that should use Prisma.
- Cloudflare R2 operations belong in dedicated services.
- Firebase Authentication is verified by middleware; this backend does not implement login or signup routes.

## Architecture

```text
routes -> controllers -> services -> repositories -> Prisma
```

Important folders:

- `config/`: environment, Prisma, Firebase Admin, and R2 client configuration
- `routes/`: Express route declarations
- `controllers/`: HTTP request/response orchestration
- `services/`: business logic and external service orchestration
- `repositories/`: persistence logic using Prisma
- `middlewares/`: authentication, uploads, errors, and cross-cutting Express middleware
- `validators/`: Zod schemas and request validation helpers
- `utils/`: shared helpers
- `prisma/`: Prisma schema and migration history

## Environment Variables

Use `.env.example` as the source of truth for required variables. The app accepts `SUPABASE_DATABASE_URL` for application code and also supports `DATABASE_URL` for Prisma CLI compatibility.

Never print, hardcode, or commit secret values.

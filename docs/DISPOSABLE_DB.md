# Disposable PostgreSQL + pgvector Workflow

## Objective
Provide an isolated, disposable PostgreSQL environment for running pgvector integration tests, migration safety tests, and vector similarity validation without touching the shared Supabase production or staging databases.

## Security Constraints
- **NEVER** run migration scripts or vector experiments against the shared Supabase database.
- **NEVER** seed the shared database with synthetic test embeddings or knowledge sources.
- Disposable databases are ephemeral: spun up for validation, wiped or destroyed after completion.

## Docker Setup (Recommended)
Use the official pinned pgvector container image:

```bash
docker run --name testimonium-pgvector-disposable \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=testimonium_test \
  -p 54322:5432 \
  -d pgvector/pgvector:pg16
```

### Connection URLs
Both environment variables must point to the same isolated disposable database during test migration and execution:
```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/testimonium_test?schema=public"
export DISPOSABLE_DATABASE_URL="postgresql://postgres:postgres@localhost:54322/testimonium_test?schema=public"
```

## Running Migration & Vector Validation
1. Export both database URLs pointing to the isolated container:
   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/testimonium_test?schema=public"
   export DISPOSABLE_DATABASE_URL="postgresql://postgres:postgres@localhost:54322/testimonium_test?schema=public"
   ```
2. Apply migrations from empty:
   ```bash
   npx prisma migrate deploy
   ```
3. Run the disposable vector integration suite:
   ```bash
   node scripts/vector_disposable.test.js
   ```
4. Stop and remove the container when finished:
   ```bash
   docker stop testimonium-pgvector-disposable && docker rm testimonium-pgvector-disposable
   ```

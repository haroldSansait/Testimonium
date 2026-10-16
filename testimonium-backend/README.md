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

## Transactional email: Gmail API or SMTP

The existing database outbox, templates, preferences, polling, batch sizes, retry
limits and worker lifecycle are shared by both transports. No migration is needed.

For Gmail API, set these in the local backend `.env` and in the Render backend
service's **Environment** settings:

```dotenv
EMAIL_TRANSPORT=gmail_api
GMAIL_CLIENT_ID=<existing private OAuth client ID>
GMAIL_CLIENT_SECRET=<existing private OAuth client secret>
GMAIL_REFRESH_TOKEN=<existing private refresh token>
SMTP_FROM_NAME=TESTIMONIUM
SMTP_FROM_EMAIL=testimonium.system@gmail.com
```

Keep the three existing private Gmail credential values unchanged. Use the grant
already authorized for `https://www.googleapis.com/auth/gmail.send`; no new OAuth
authorization, Firebase change, or interactive login is needed. The sender must be
the authorized `testimonium.system@gmail.com` account. `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and the `SMTP_*_TIMEOUT_MS` settings are
unused in Gmail API mode and may remain unset. Sender fields retain their existing
names for compatibility; the display name defaults to TESTIMONIUM.

Delivery uses Google's supported `google-auth-library` OAuth2 client and the
[`users.messages.send` HTTPS endpoint](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send)
with `userId=me`. Nodemailer composes multipart MIME only; it opens no SMTP socket.
The OAuth client acquires/caches access tokens and refreshes them using the private
refresh token, including after an ordinary process restart. Tokens are held in
memory; the application never rewrites `.env` or persists access tokens.

Each OAuth or Gmail HTTP request has a 20-second timeout, HTTP retries are disabled,
and one refresh/replay on an authorization failure is allowed. The processing
lease covers up to four HTTP phases plus a 30-second margin (at least 110 seconds,
or `EMAIL_WORKER_LEASE_SECONDS` if greater). Rate limits, temporary quota failures,
network failures, timeouts and HTTP 5xx use the existing bounded outbox backoff.
Invalid messages and identifiable permanent authorization failures mark the job
FAILED. Stored Gmail delivery errors contain only a generic category and HTTP
status; raw provider errors, tokens and email content are not logged.

Incomplete credentials, an unsupported transport, or an incorrect Gmail sender
produce a configuration warning and prevent worker startup, preserving queued
rows. Gmail delivery never falls back to SMTP. Correct configuration and restart
the backend to resume queued work. Gmail account sending limits still apply;
prolonged quota failures can exhaust `EMAIL_MAX_ATTEMPTS` just as other retries do.

For legacy SMTP, explicitly set `EMAIL_TRANSPORT=smtp` and use the existing SMTP
host/auth/sender configuration. Omitting `EMAIL_TRANSPORT` also retains SMTP.
The worker controls remain unchanged:

```dotenv
EMAIL_WORKER_POLL_MS=10000
EMAIL_WORKER_BATCH_SIZE=10
EMAIL_WORKER_LEASE_SECONDS=120
EMAIL_MAX_ATTEMPTS=5
```

### Render Free

Configure the six Gmail/sender variables above in the existing backend service's
Environment settings, preserving all unrelated variables and worker overrides.
Do not deploy as part of local transport setup. Once deployment is separately
authorized, restart/redeploy the API so it reads the configured transport. Its
normal worker startup then processes due queued emails.

[Render Free blocks outbound SMTP ports 25, 465 and 587 and sleeps after 15 minutes
without inbound traffic](https://render.com/docs/free). Gmail API uses HTTPS port
443. While the service sleeps, the in-process worker cannot drain the outbox;
delivery waits until the service runs again. There is no new scheduler or keep-alive.

### Verification and one controlled live send

Run `npm run test:email` for mocked OAuth, MIME, error and worker checks. These tests
do not send real emails or access a live database. Passing mocks does not verify
the real account grant, Gmail acceptance, inbox arrival or deployed Render behavior.

**Only after explicit approval for a live email**, stop the backend so its worker
cannot deliver other pending rows. From `testimonium-backend`, with Gmail API
selected in `.env`, replace the recipient below with the one approved address and
run this command exactly once:

```powershell
node --input-type=module -e "import { EmailService } from './services/EmailService.js'; const email = new EmailService(); if (!email.isConfigured()) throw new Error('Email configuration incomplete'); try { const result = await email.send({ to: 'YOUR_APPROVED_TEST_ADDRESS', subject: 'TESTIMONIUM Gmail API delivery test', text: 'One controlled TESTIMONIUM delivery test.', html: '<p>One controlled TESTIMONIUM delivery test.</p>' }); console.log({ messageId: result.messageId }); } catch { console.error('Email test failed; inspect configuration without logging provider errors.'); process.exitCode = 1; }"
```

This invokes only the transport, without starting the worker or modifying the
outbox. Confirm a Gmail message ID, sender, recipient, subject, text/HTML content
and receipt (including spam). Do not print the OAuth client, environment, raw
provider errors or request/response objects. Starting the API afterward resumes
normal queued delivery; it is separate from this single-message test.

The outbox retains its existing at-least-once delivery semantics: an ambiguous
network failure after provider acceptance can result in a duplicate on retry.

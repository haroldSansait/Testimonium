Act as a Senior Software Engineer performing a Phase 1 acceptance review for the TESTIMONIUM backend.

Do NOT modify the code unless you discover a genuine issue that prevents the project from meeting the Phase 1 requirements. If you find an issue, explain it, fix it, and document the change.

Perform the following verification checklist:

1. Project Structure
- Verify that the following exist:
  - config/
  - controllers/
  - middlewares/
  - prisma/
  - repositories/
  - routes/
  - services/
  - utils/
  - validators/
  - .env.example
  - README.md
  - package.json
  - prisma.config.ts
  - server.js
  - TASKS.md

2. package.json
- Verify:
  - "type": "module"
  - "dev": "nodemon server.js"
  - "start": "node server.js"

3. Environment Configuration
- Verify:
  - .env.example exists
  - it contains placeholder values only
  - no secrets exist inside .env.example
  - .env is ignored by Git

4. Dependency Verification
Verify required production packages:

- express
- cors
- dotenv
- helmet
- compression
- morgan
- bcryptjs
- multer
- zod
- firebase-admin
- @aws-sdk/client-s3
- @prisma/client
- @prisma/adapter-pg
- pg

Verify development packages:

- prisma
- nodemon

5. Prisma Verification
Verify:

- prisma validate succeeds
- prisma generate succeeds
- Prisma Client exists
- Prisma configuration follows Prisma 7 conventions

6. Express Middleware
Verify the server includes:

- helmet
- compression
- express.json()
- express.urlencoded()
- development-only morgan
- dynamic CORS configuration
- centralized error handler

7. Firebase Configuration
Inspect config/firebase.js.

Verify:

- Firebase Admin SDK is initialized correctly
- credentials come exclusively from environment variables
- private key correctly restores newlines using replace(/\\\\n/g, "\n")
- singleton initialization
- no hardcoded credentials

8. Cloudflare R2
Inspect:

- config/r2.js
- services/R2Service.js

Verify:

- S3Client configuration
- environment variables are used
- upload()
- download()
- delete()
- generateSignedUrl()

exist.

9. Upload Middleware
Verify:

middlewares/uploadMiddleware.js

uses:

multer.memoryStorage()

and never diskStorage().

10. Authentication Middleware
Inspect:

middlewares/authMiddleware.js

Verify:

- Authorization Bearer token parsing
- Firebase ID Token verification
- decoded user attached to req.user
- no login routes
- no signup routes
- no custom JWT generation

11. Architecture Review
Verify the application follows:

Routes
→ Controllers
→ Services
→ Repositories
→ Prisma

Ensure:

- controllers never import Prisma directly
- repositories own database access
- services contain business logic

12. Syntax Verification
Run:

node --check server.js

Verify there are no syntax errors.

13. Documentation Review
Inspect:

README.md

Verify it documents:

- prerequisites
- installation
- environment variables
- project structure
- development workflow

14. Git Review
Verify:

- .env is not tracked
- secrets are not committed
- only intended backend files are modified

15. TASKS.md Review
Verify TASKS.md accurately reflects the completed scaffold.

16. Engineering Review
Review the scaffold against modern backend engineering practices.

Evaluate:

- maintainability
- scalability
- security
- separation of concerns
- readiness for future turnover to the Vicariate of Canlaon

Deliverables:

- Produce a checklist showing PASS, WARNING, or FAIL for every section.
- Explain every warning or failure.
- Automatically fix only genuine implementation issues.
- If everything passes, conclude with:

"Phase 1 scaffold verified successfully and approved for Phase 2 (Authentication & User Profile implementation)."
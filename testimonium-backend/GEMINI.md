# TESTIMONIUM Backend Engine - Core Agent Guardrails

You are an expert backend engineer building the API for TESTIMONIUM (A Digital Portal for Parish Sacramental Document Processing for the Vicariate of Canlaon, Diocese of San Carlos). You must strictly adhere to the following architectural constraints and conventions for every task you execute.

## 💻 Tech Stack
- **Runtime:** Node.js (v18+ or later)
- **Framework:** Express.js (REST API architecture)
- **Database:** PostgreSQL via Prisma ORM
- **File Storage:** Cloudflare R2 (using S3-Compatible SDK Client)

## 🏗️ Architectural Standards & Folder Structure
We enforce a strict, modular controller-route layout. Do not write monolithic endpoints in `server.js`.
- `/config/` - Database and storage initializations (e.g., `db.js`, `r2.js`)
- `/routes/` - Express route declarations and middleware attachments
- `/controllers/` - Async business logic handlers executing database/storage manipulation
- `/middlewares/` - Authentication checks, validation chains, and error catchers

## 🔒 Crucial Rules & Constraints
1. **Branding Integrity:** The project is officially named TESTIMONIUM. Ensure all logs, error responses, and database seed patterns reflect this name. The automated chatbot helper remains named Caloy.
2. **No Raw SQL:** Never write raw SQL strings. All database queries must use the Prisma Client instance.
3. **Environment Isolation:** Never hardcode passwords, secret keys, or database URLs. Read exclusively from `process.env`. 
4. **Cloudflare R2 Binary Separation:** Do not store physical certificates or image blobs directly inside the PostgreSQL database. Upload raw files to Cloudflare R2 via the S3 streaming client, and save only the resulting public custom domain string URL into the database column.
5. **Error Management:** Wrap all controller logic in `try/catch` blocks. Pass unexpected runtime structural crashes to an explicit, centralized Express error-handling middleware. Never expose internal stack traces to the public response.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env.js";

if (!env.databaseUrl) {
  throw new Error("Missing Supabase database URL configuration.");
}

const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
});

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}

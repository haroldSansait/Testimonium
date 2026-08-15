import { prisma } from "../config/db.js";

async function main() {
  // Add new values to pg_enum DocumentType if not exists
  const newEnums = ['MARRIAGE_BANNS', 'PERMIT_TO_MARRY', 'STATUS_OF_LIBERTY'];
  for (const val of newEnums) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS '${val}'`);
      console.log(`Added enum value ${val}`);
    } catch (e) {
      console.log(`Enum value ${val} already exists or error:`, e.message);
    }
  }

  const enums = await prisma.$queryRaw`
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE typname = 'DocumentType';
  `;
  console.log("Updated DocumentType enum in DB:", enums);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

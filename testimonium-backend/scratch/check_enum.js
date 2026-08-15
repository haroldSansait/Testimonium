import { prisma } from "../config/db.js";

async function main() {
  const enums = await prisma.$queryRaw`
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE typname = 'DocumentType';
  `;
  console.log("DocumentType enum in DB:", enums);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

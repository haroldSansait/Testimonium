// Force the real OCR provider to be used
process.env.OCR_PROVIDER = "ocrspace";

const { OcrProcessingService } = await import("../services/OcrProcessingService.js");
const { prisma } = await import("../config/db.js");

async function run() {
  console.log("=== Testing Real Asynchronous Background OCR Processing ===");
  console.log("Processing receiptId: 11 using OCR.space...");

  // Update status back to PENDING first so it doesn't get skipped
  await prisma.ocrResult.update({
    where: { receiptUploadId: 11 },
    data: { status: "PENDING" }
  });

  await OcrProcessingService.processAsync(11);

  // Check the result
  const finalResult = await prisma.ocrResult.findUnique({
    where: { receiptUploadId: 11 }
  });

  console.log("\n=== Final OCR Result after background run: ===");
  console.log(JSON.stringify(finalResult, null, 2));

  process.exit(0);
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});

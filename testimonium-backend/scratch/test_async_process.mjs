// Make sure OCR_PROVIDER is set to stub for local testing to avoid calling real OCR.space API
process.env.OCR_PROVIDER = "stub";

const { OcrProcessingService } = await import("../services/OcrProcessingService.js");
const { prisma } = await import("../config/db.js");

async function run() {
  console.log("=== Testing Asynchronous Background OCR Processing ===");
  console.log("Processing receiptId: 10...");

  // Update status back to PENDING first so it doesn't get skipped
  await prisma.ocrResult.update({
    where: { receiptUploadId: 10 },
    data: { status: "PENDING" }
  });

  await OcrProcessingService.processAsync(10);

  // Transition back to PENDING so it runs again
  await prisma.ocrResult.update({
    where: { receiptUploadId: 10 },
    data: { status: "PENDING" }
  });

  console.log("\nRunning second time in same process to test cache hit...");
  await OcrProcessingService.processAsync(10);

  // Check the result
  const finalResult = await prisma.ocrResult.findUnique({
    where: { receiptUploadId: 10 }
  });

  console.log("\n=== Final OCR Result after background run: ===");
  console.log(JSON.stringify(finalResult, null, 2));

  process.exit(0);
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});

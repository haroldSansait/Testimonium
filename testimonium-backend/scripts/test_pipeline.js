import { canTransition } from "../services/RequestStateMachine.js";
import { createRequestSchema } from "../validators/requestSchemas.js";
import { StubOcrProvider } from "../services/ocr/StubOcrProvider.js";

async function verify() {
  console.log("========== STARTING VERIFICATION ==========");

  // 1. State Machine transitions validation
  console.log("\n1. Verifying State Machine transitions:");
  const tests = [
    { from: "PENDING", to: "UNDER_REVIEW", expected: true },
    { from: "PENDING", to: "READY_FOR_PICKUP", expected: false },
    { from: "PAYMENT_PENDING", to: "PAYMENT_VERIFIED", expected: true },
    { from: "PAYMENT_VERIFIED", to: "PROCESSING", expected: true },
    { from: "PROCESSING", to: "COMPLETED", expected: false },
    { from: "READY_FOR_PICKUP", to: "COMPLETED", expected: true },
  ];

  tests.forEach(({ from, to, expected }) => {
    const result = canTransition(from, to);
    const pass = result === expected;
    console.log(
      `  - Transition [${from} -> ${to}]: Got ${result} (Expected ${expected}) -> ${
        pass ? "PASS" : "FAIL"
      }`
    );
  });

  // 2. Validator schemas validation
  console.log("\n2. Verifying Zod validation schemas:");
  const validBody = {
    parishId: 1,
    documentType: "BAPTISMAL_CERTIFICATE",
    applicantName: "Juan dela Cruz",
    relationship: "Self",
    purpose: "Passport Application",
  };

  const invalidBody = {
    parishId: "abc", // should fail or coerce
    documentType: "INVALID_TYPE", // should fail
    applicantName: "", // should fail
  };

  try {
    createRequestSchema.parse(validBody);
    console.log("  - Valid request body schema validation: PASS");
  } catch (err) {
    console.log("  - Valid request body schema validation: FAIL", err.errors);
  }

  try {
    createRequestSchema.parse(invalidBody);
    console.log("  - Invalid request body schema validation: FAIL (expected parsing error but passed)");
  } catch (err) {
    console.log("  - Invalid request body schema validation: PASS (correctly caught error)");
  }

  // 3. Stub OCR provider mock verification
  console.log("\n3. Verifying Stub OCR Provider:");
  const ocr = new StubOcrProvider();

  // Test low confidence receipt
  const receipt1 = await ocr.extractFromReceipt(Buffer.from([]), "image/png", "my_receipt.png");
  console.log(
    `  - Receipt 1 (Normal): Got confidence ${receipt1.confidenceScore} -> ${
      receipt1.confidenceScore === 0 ? "PASS" : "FAIL"
    }`
  );

  // Test high confidence GCash receipt
  const receipt2 = await ocr.extractFromReceipt(Buffer.from([]), "image/png", "gcash_payment.png");
  console.log(
    `  - Receipt 2 (GCash test name): Got confidence ${receipt2.confidenceScore} -> ${
      receipt2.confidenceScore > 0.9 ? "PASS" : "FAIL"
    }`
  );
  console.log(`    Parsed details: Ref #${receipt2.referenceNumber}, Amount: ${receipt2.amount}, Provider: ${receipt2.provider}`);

  console.log("\n========== VERIFICATION COMPLETE ==========");
}

verify().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});

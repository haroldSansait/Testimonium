import { OcrProviderFactory } from '../services/ocr/OcrProviderFactory.js';
import { StubOcrProvider } from '../services/ocr/StubOcrProvider.js';
import { OCRSpaceProvider } from '../services/ocr/OCRSpaceProvider.js';

// Test factory returns correct provider based on env
const provider = OcrProviderFactory.create();
console.log("Current provider (from env):", provider.providerName);
console.log("Is OCRSpaceProvider:", provider instanceof OCRSpaceProvider);

// Test stub provider directly  
const stub = new StubOcrProvider();
console.log("\nStub providerName:", stub.providerName);
const stubResult = await stub.extractFromReceipt(Buffer.from("test"), "image/jpeg", "test.jpg");
console.log("Stub ocrSuccess:", stubResult.ocrSuccess);
console.log("Stub failureReason:", stubResult.failureReason);

// Test stub with test filename
const stubGcash = await stub.extractFromReceipt(Buffer.from("test"), "image/jpeg", "gcash_receipt.jpg");
console.log("\nStub with gcash filename - ocrSuccess:", stubGcash.ocrSuccess);
console.log("Contains GCash text:", stubGcash.rawText.includes("GCash"));

import { ReceiptParser } from '../services/ocr/ReceiptParser.js';

const sampleText = [
  "GCash Express Send",
  "Amount: PHP 500.00",
  "Ref No: 901234567890",
  "Date: July 31, 2026",
  "Time: 10:30 AM",
  "Status: Successful"
].join("\n");

// Test 1: normal GCash receipt
const sanitized = ReceiptParser.sanitize(sampleText);
const parsed = ReceiptParser.parse(sanitized);
console.log("=== Test 1: GCash Receipt ===");
console.log(JSON.stringify(parsed, null, 2));
console.log("Confidence:", (parsed.parserConfidence * 100).toFixed(0) + "%");
console.log();

// Test 2: HTML injection sanitization
const malicious = "<script>alert('xss')</script>GCash Amount: PHP 100.00 Ref No: 123456789012";
const safe = ReceiptParser.sanitize(malicious);
console.log("=== Test 2: XSS Sanitization ===");
console.log("Input had script tag:", malicious.includes("<script>"));
console.log("Output has script tag:", safe.includes("<script>"));
console.log("Sanitized:", safe);
console.log();

// Test 3: empty input
const empty = ReceiptParser.parse("");
console.log("=== Test 3: Empty Input ===");
console.log("Confidence:", empty.parserConfidence);
console.log("All fields null:", Object.values(empty).every(v => v === null || v === 0 || v === "PHP"));


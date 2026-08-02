import { prisma } from "../config/db.js";
import { R2Service } from "../services/R2Service.js";
import { ImageCompressionService } from "../services/ImageCompressionService.js";
import { env } from "../config/env.js";

const r2Service = new R2Service();

async function run() {
  console.log("=== Debugging OCR.space API Response ===");
  console.log("Fetching receipt 11 info...");

  const receipt = await prisma.receiptUpload.findUnique({
    where: { id: 11 }
  });

  if (!receipt) {
    console.error("Receipt 11 not found in DB.");
    process.exit(1);
  }

  console.log("Downloading from R2:", receipt.r2ObjectKey);
  const downloadResponse = await r2Service.download(receipt.r2ObjectKey);
  const uint8Array = await downloadResponse.Body.transformToByteArray();
  const buffer = Buffer.from(uint8Array);

  console.log("Compressing image...");
  const compressed = await ImageCompressionService.compress(buffer, receipt.mimeType);

  console.log("Sending compressed buffer directly to OCR.space API using native FormData...");
  const apiKey = env.ocr.spaceApiKey;
  console.log("API Key configured:", apiKey ? "YES" : "NO");

  const formData = new FormData();
  // Create a Blob from the compressed buffer
  const blob = new Blob([compressed.compressedBuffer], { type: "image/jpeg" });
  formData.append("file", blob, "receipt.jpg");
  formData.append("apikey", apiKey);
  formData.append("OCREngine", env.ocr.spaceEngine ?? "2");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("isTable", "false");
  formData.append("language", "eng");

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: formData, // No manual headers, fetch sets multipart boundary automatically
  });

  console.log("HTTP Status Code:", response.status);
  const text = await response.text();
  console.log("Raw Response Text:");
  console.log(text);

  process.exit(0);
}

run().catch(console.error);

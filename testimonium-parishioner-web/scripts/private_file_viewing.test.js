import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("all Request Tracking attachment, correction, and receipt viewers use owned API endpoints", async () => {
  const [tracking, receiptCard] = await Promise.all([
    read("../src/pages/dashboard/RequestTrackingPage.tsx"),
    read("../src/features/payments/components/ReceiptUploadCard.tsx"),
  ]);

  for (const source of [tracking, receiptCard]) {
    assert.doesNotMatch(source, /\.r2\.dev/);
    assert.doesNotMatch(source, /\.r2ObjectKey/);
  }

  assert.match(tracking, /\/attachments\/' \+ att\.id \+ '\/download/);
  assert.match(tracking, /\/attachments\/' \+ existingFile\.id \+ '\/download/);
  assert.match(tracking, /\/receipts\/' \+ selectedRequest\.paymentTransactions\[0\]\.receipts\[0\]\.id \+ '\/download/);
  assert.match(receiptCard, /\/receipts\/' \+ existingReceipt\.id \+ '\/download/);
});

test("secure viewer fetches authenticated blobs, cleans object URLs, and renders failures", async () => {
  const [viewer, client] = await Promise.all([
    read("../src/components/files/SecureFileActions.tsx"),
    read("../src/api/client.ts"),
  ]);

  assert.match(viewer, /client\.getBlob\(endpoint\)/);
  assert.match(viewer, /URL\.createObjectURL\(blob\)/);
  assert.match(viewer, /URL\.revokeObjectURL/);
  assert.match(viewer, /generation !== loadGenerationRef\.current/);
  assert.match(viewer, /role="alert"/);
  assert.match(viewer, /anchor\.download = fileName/);
  assert.match(viewer, /anchor\.target = '_blank'/);
  assert.match(viewer, /objectUrl && !compact/);
  assert.match(client, /headers\.set\("Authorization"/);
  assert.match(client, /await auth\.currentUser\.getIdToken\(\)/);
});

test("production Web file metadata types do not require private R2 object keys", async () => {
  const types = await read("../src/types/index.ts");

  const attachmentStart = types.indexOf("export interface RequestAttachment");
  const transactionStart = types.indexOf("export interface PaymentTransaction");
  const requestStart = types.indexOf("export interface SacramentalRequest");

  assert.doesNotMatch(types.slice(attachmentStart, transactionStart), /r2ObjectKey/);
  assert.doesNotMatch(types.slice(transactionStart, requestStart), /r2ObjectKey/);
});

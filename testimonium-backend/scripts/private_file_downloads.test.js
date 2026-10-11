import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("parishioner private-file routes stay behind authentication and role checks", async () => {
  const routes = await read("../routes/parishionerRequestRoutes.js");

  const authIndex = routes.indexOf("router.use(authenticateFirebaseToken)");
  const roleIndex = routes.indexOf('router.use(checkRole(["PARISHIONER"]))');
  const attachmentIndex = routes.indexOf('router.get("/:id/attachments/:attachmentId/download", downloadAttachment)');
  const receiptIndex = routes.indexOf('router.get("/:id/receipts/:receiptId/download", downloadReceipt)');

  assert.ok(authIndex >= 0);
  assert.ok(roleIndex > authIndex);
  assert.ok(attachmentIndex > roleIndex);
  assert.ok(receiptIndex > roleIndex);
});

test("attachment and receipt downloads enforce owner and parent-request boundaries", async () => {
  const controller = await read("../controllers/ParishionerRequestController.js");

  const attachmentStart = controller.indexOf("export const downloadAttachment");
  const receiptStart = controller.indexOf("export const downloadReceipt");
  const attachmentBlock = controller.slice(attachmentStart, receiptStart);
  const receiptBlock = controller.slice(receiptStart, controller.indexOf("export const getRegistrantIdMetadata"));

  assert.match(attachmentBlock, /requestService\.getRequestById\(requestId,\s*userId\)/);
  assert.match(attachmentBlock, /where:\s*\{\s*id:\s*attachmentId,\s*requestId\s*\}/);
  assert.match(receiptBlock, /requestService\.getRequestById\(requestId,\s*userId\)/);
  assert.match(receiptBlock, /id:\s*receiptId,\s*transaction:\s*\{\s*requestId\s*\}/);
  assert.ok(
    receiptBlock.indexOf("requestService.getRequestById") < receiptBlock.indexOf("prisma.receiptUpload.findFirst"),
    "ownership must be checked before receipt metadata lookup",
  );
});

test("private download handlers reject malformed IDs and map missing R2 objects to 404s", async () => {
  const [controller, r2Service] = await Promise.all([
    read("../controllers/ParishionerRequestController.js"),
    read("../services/R2Service.js"),
  ]);

  assert.match(controller, /const requestId = parsePositiveId\(req\.params\.id\)/);
  assert.match(controller, /const attachmentId = parsePositiveId\(req\.params\.attachmentId\)/);
  assert.match(controller, /const receiptId = parsePositiveId\(req\.params\.receiptId\)/);
  assert.match(controller, /ATTACHMENT_FILE_MISSING/);
  assert.match(controller, /RECEIPT_FILE_MISSING/);
  assert.match(controller, /res\.status\(404\)/);
  assert.match(r2Service, /error\?\.\$metadata\?\.httpStatusCode/);
  assert.match(r2Service, /NoSuchKey/);
});

test("parishioner request DTOs expose file IDs and metadata but never raw object keys", async () => {
  const repository = await read("../repositories/ParishionerRequestRepository.js");

  assert.match(repository, /attachments:\s*\{\s*select:\s*\{\s*id:\s*true/);
  assert.match(repository, /receipts:\s*\{\s*select:\s*\{\s*id:\s*true/);
  assert.doesNotMatch(repository, /r2ObjectKey:\s*true/);
});

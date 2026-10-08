import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UPLOAD_POLICIES, validateUploadFile } from "../src/utils/uploadPolicy.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../src");
const repoRoot = path.resolve(__dirname, "../..");

test("Parishioner Web Upload Policy Suite", async (t) => {
  const createMockFile = (name, size, type = "") => ({
    name,
    size,
    type,
  });

  await t.test("Supporting Document: accepts PDF, JPEG, JPG, PNG, and WebP under 5 MB", () => {
    const policy = UPLOAD_POLICIES.SUPPORTING_DOCUMENT;

    assert.strictEqual(validateUploadFile(createMockFile("doc.pdf", 1024, "application/pdf"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("doc.jpg", 1024, "image/jpeg"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("doc.jpeg", 1024, "image/jpeg"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("doc.png", 1024, "image/png"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("doc.webp", 1024, "image/webp"), policy).valid, true);
  });

  await t.test("Supporting Document: rejects unsupported formats (.doc, .docx, .txt, .heic, and MIME mismatches)", () => {
    const policy = UPLOAD_POLICIES.SUPPORTING_DOCUMENT;

    const docRes = validateUploadFile(createMockFile("doc.doc", 1024, "application/msword"), policy);
    assert.strictEqual(docRes.valid, false);
    assert.match(docRes.error, /Unsupported file format/);

    const docxRes = validateUploadFile(createMockFile("doc.docx", 1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), policy);
    assert.strictEqual(docxRes.valid, false);
    assert.match(docxRes.error, /Unsupported file format/);

    const txtRes = validateUploadFile(createMockFile("doc.txt", 1024, "text/plain"), policy);
    assert.strictEqual(txtRes.valid, false);
    assert.match(txtRes.error, /Unsupported file format/);

    const heicRes = validateUploadFile(createMockFile("doc.heic", 1024, "image/heic"), policy);
    assert.strictEqual(heicRes.valid, false);
    assert.match(heicRes.error, /Unsupported file format/);

    // Mismatched MIME: valid extension with incompatible MIME
    const mimeMismatch = validateUploadFile(createMockFile("doc.pdf", 1024, "text/plain"), policy);
    assert.strictEqual(mimeMismatch.valid, false);
    assert.match(mimeMismatch.error, /Unsupported file type \(text\/plain\)/);
  });

  await t.test("Authorization Letter: accepts PDF, JPEG, JPG, and PNG", () => {
    const policy = UPLOAD_POLICIES.AUTHORIZATION_LETTER;

    assert.strictEqual(validateUploadFile(createMockFile("auth.pdf", 1024, "application/pdf"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("auth.jpg", 1024, "image/jpeg"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("auth.jpeg", 1024, "image/jpeg"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("auth.png", 1024, "image/png"), policy).valid, true);
  });

  await t.test("Authorization Letter: rejects WebP and unsupported formats", () => {
    const policy = UPLOAD_POLICIES.AUTHORIZATION_LETTER;

    const webpRes = validateUploadFile(createMockFile("auth.webp", 1024, "image/webp"), policy);
    assert.strictEqual(webpRes.valid, false);
    assert.match(webpRes.error, /Accepted formats: PDF, JPG, or PNG — up to 5 MB/);

    const docxRes = validateUploadFile(createMockFile("auth.docx", 1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), policy);
    assert.strictEqual(docxRes.valid, false);
    assert.match(docxRes.error, /Accepted formats: PDF, JPG, or PNG — up to 5 MB/);

    const txtRes = validateUploadFile(createMockFile("auth.txt", 1024, "text/plain"), policy);
    assert.strictEqual(txtRes.valid, false);
    assert.match(txtRes.error, /Accepted formats: PDF, JPG, or PNG — up to 5 MB/);
  });

  await t.test("Correction Document: accepts PDF, JPEG, JPG, PNG, and WebP under 5 MB", () => {
    const policy = UPLOAD_POLICIES.CORRECTION_DOCUMENT;

    assert.strictEqual(validateUploadFile(createMockFile("correction.pdf", 1024, "application/pdf"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("correction.jpg", 1024, "image/jpeg"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("correction.jpeg", 1024, "image/jpeg"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("correction.png", 1024, "image/png"), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("correction.webp", 1024, "image/webp"), policy).valid, true);
  });

  await t.test("Correction Document: rejects unsupported document formats", () => {
    const policy = UPLOAD_POLICIES.CORRECTION_DOCUMENT;

    assert.strictEqual(validateUploadFile(createMockFile("correction.doc", 1024, "application/msword"), policy).valid, false);
    assert.strictEqual(validateUploadFile(createMockFile("correction.docx", 1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), policy).valid, false);
    assert.strictEqual(validateUploadFile(createMockFile("correction.txt", 1024, "text/plain"), policy).valid, false);
    assert.strictEqual(validateUploadFile(createMockFile("correction.heic", 1024, "image/heic"), policy).valid, false);
  });

  await t.test("File size bounds: 0-byte and > 5 MB are rejected, exact 5 MB is accepted", () => {
    const policy = UPLOAD_POLICIES.SUPPORTING_DOCUMENT;

    const zero = validateUploadFile(createMockFile("zero.pdf", 0, "application/pdf"), policy);
    assert.strictEqual(zero.valid, false);
    assert.match(zero.error, /empty \(0 bytes\)/);

    const max = validateUploadFile(createMockFile("max.pdf", 5 * 1024 * 1024, "application/pdf"), policy);
    assert.strictEqual(max.valid, true);

    const over = validateUploadFile(createMockFile("over.pdf", 5 * 1024 * 1024 + 1, "application/pdf"), policy);
    assert.strictEqual(over.valid, false);
    assert.match(over.error, /Maximum size allowed is 5 MB/);
  });

  await t.test("Empty browser MIME tolerated when supported extension is present", () => {
    const policy = UPLOAD_POLICIES.SUPPORTING_DOCUMENT;
    assert.strictEqual(validateUploadFile(createMockFile("scan.pdf", 2048, ""), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("scan.PNG", 2048, ""), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("scan.jpg", 2048, ""), policy).valid, true);
    assert.strictEqual(validateUploadFile(createMockFile("scan.webp", 2048, ""), policy).valid, true);
  });

  await t.test("Drag-and-drop & picker selection share identical category validation and prevent invalid state mutation", () => {
    const processDroppedFiles = (rawFiles, policy) => {
      const selected = [];
      const errors = [];
      for (const file of rawFiles) {
        const res = validateUploadFile(file, policy);
        if (res.valid) {
          selected.push(file);
        } else {
          errors.push(res.error);
        }
      }
      return { selected, errors };
    };

    // Valid PDF dropped into supporting document
    const validPdfDrop = processDroppedFiles([createMockFile("valid.pdf", 1024, "application/pdf")], UPLOAD_POLICIES.SUPPORTING_DOCUMENT);
    assert.strictEqual(validPdfDrop.selected.length, 1);
    assert.strictEqual(validPdfDrop.errors.length, 0);

    // Invalid file dropped into supporting document
    const invalidDrop = processDroppedFiles([createMockFile("bad.doc", 1024, "application/msword")], UPLOAD_POLICIES.SUPPORTING_DOCUMENT);
    assert.strictEqual(invalidDrop.selected.length, 0);
    assert.strictEqual(invalidDrop.errors.length, 1);
    assert.match(invalidDrop.errors[0], /Unsupported file format/);

    // PDF dropped into authorization letter area
    const authPdfDrop = processDroppedFiles([createMockFile("letter.pdf", 2048, "application/pdf")], UPLOAD_POLICIES.AUTHORIZATION_LETTER);
    assert.strictEqual(authPdfDrop.selected.length, 1);
    assert.strictEqual(authPdfDrop.errors.length, 0);

    // WebP dropped into authorization letter area
    const authWebpDrop = processDroppedFiles([createMockFile("letter.webp", 2048, "image/webp")], UPLOAD_POLICIES.AUTHORIZATION_LETTER);
    assert.strictEqual(authWebpDrop.selected.length, 0);
    assert.strictEqual(authWebpDrop.errors.length, 1);
    assert.match(authWebpDrop.errors[0], /Accepted formats: PDF, JPG, or PNG/);
  });

  await t.test("Accept attributes: specific extensions without broad */* or image/* wildcards", () => {
    for (const [key, policy] of Object.entries(UPLOAD_POLICIES)) {
      if (key !== "REGISTRANT_ID_IMAGE") {
        assert.ok(policy.acceptAttribute.includes(".pdf"), `${key} must advertise .pdf in acceptAttribute`);
      } else {
        assert.ok(!policy.acceptAttribute.includes(".pdf"), "Registrant ID must remain JPEG/PNG only");
      }
      assert.ok(!policy.acceptAttribute.includes("*/*"), `${key} must not use broad */*`);
      assert.ok(!policy.acceptAttribute.includes("image/*"), `${key} must not use broad image/* which permits HEIC`);
    }

    assert.ok(UPLOAD_POLICIES.AUTHORIZATION_LETTER.acceptAttribute.includes(".pdf"));
    assert.ok(!UPLOAD_POLICIES.AUTHORIZATION_LETTER.acceptAttribute.includes(".webp"));
    assert.ok(!UPLOAD_POLICIES.AUTHORIZATION_LETTER.allowedExtensions.includes(".webp"));
  });

  await t.test("Source contract: SacramentalRequestPage uses UPLOAD_POLICIES, handles drag/drop, and displays affordance copy", () => {
    const pageContent = fs.readFileSync(path.join(srcDir, "pages/dashboard/SacramentalRequestPage.tsx"), "utf8");
    assert.ok(pageContent.includes("UPLOAD_POLICIES.SUPPORTING_DOCUMENT.acceptAttribute"));
    assert.ok(pageContent.includes("UPLOAD_POLICIES.AUTHORIZATION_LETTER.acceptAttribute"));
    assert.match(pageContent, /Drag and drop files here, or click to upload\. PDF, JPG, PNG, or WebP [-—] up to 5 MB\./);
    assert.ok(pageContent.includes("Drag and drop files here, or click to upload. PDF, JPG, or PNG — up to 5 MB."));
    assert.ok(pageContent.includes("onDragOver"));
    assert.ok(pageContent.includes("onDrop"));
    assert.ok(!pageContent.includes("image/*"));
    assert.ok(!pageContent.includes("showOpenFilePicker"));
  });

  await t.test("Source contract: RequestTrackingPage uses UPLOAD_POLICIES.CORRECTION_DOCUMENT and preserves partial-upload retry", () => {
    const pageContent = fs.readFileSync(path.join(srcDir, "pages/dashboard/RequestTrackingPage.tsx"), "utf8");
    assert.ok(pageContent.includes("UPLOAD_POLICIES.CORRECTION_DOCUMENT).acceptAttribute"));
    assert.ok(pageContent.includes("UPLOAD_POLICIES.REGISTRANT_ID_IMAGE"));
    assert.ok(pageContent.includes("Drag and drop files here, or click to upload. PDF, JPG, PNG, or WebP"));
    assert.ok(pageContent.includes("onDragOver"));
    assert.ok(pageContent.includes("onDrop"));
    // Verify audited partial-upload repair is intact
    assert.ok(pageContent.includes("uploadedCorrectionReqIds"));
    assert.ok(pageContent.includes("succeededCount"));
    assert.ok(pageContent.includes("refetch()"));
    assert.ok(pageContent.includes("resubmitCorrections"));
  });

  await t.test("Source contract: FileDropzone implements drag-and-drop affordance, accessible alert, and no picture folder forcing", () => {
    const dropzoneContent = fs.readFileSync(path.join(srcDir, "features/requests/components/FileDropzone.tsx"), "utf8");
    assert.ok(dropzoneContent.includes("onDragEnter"));
    assert.ok(dropzoneContent.includes("onDragOver"));
    assert.ok(dropzoneContent.includes("onDrop"));
    assert.ok(dropzoneContent.includes("Drag and drop files here, or click to upload. {policy.label}"));
    assert.ok(dropzoneContent.includes("validateUploadFile"));
    assert.ok(!dropzoneContent.includes("showOpenFilePicker"));
  });

  await t.test("Source contract: EventDetailsModal has no Share button or clipboard share logic", () => {
    const modalContent = fs.readFileSync(path.join(srcDir, "features/events/components/EventDetailsModal.tsx"), "utf8");
    assert.ok(!modalContent.includes("handleShare"));
    assert.ok(!modalContent.includes("shareFeedback"));
    assert.ok(!modalContent.includes("Share2"));
  });

  await t.test("Regression contract: Backend fileValidator authorizes PDF for documents and letters, preserves JPEG/PNG for receipts", () => {
    const backendValidatorPath = path.join(repoRoot, "testimonium-backend/utils/fileValidator.js");
    const validatorContent = fs.readFileSync(backendValidatorPath, "utf8");
    assert.ok(validatorContent.includes('"application/pdf"'));
    assert.ok(validatorContent.includes("validateReceipt"));
    assert.ok(validatorContent.includes("validateAuthorizationLetter"));
    assert.ok(validatorContent.includes("validateSupportingDocument"));
    // Receipts must remain JPEG/PNG only
    assert.ok(validatorContent.includes('allowedReceiptMimes = ["image/jpeg", "image/png"]'));
    // Authorization letter must disallow WebP
    assert.ok(validatorContent.includes("WebP format is not accepted for authorization letters"));
  });

  await t.test("Regression contract: Android document picker retains PDF and image types", () => {
    const androidPickerPath = path.join(repoRoot, "testimonium-parishioner-app/src/features/requests/components/SupportingFilePicker.tsx");
    const androidContent = fs.readFileSync(androidPickerPath, "utf8");
    assert.ok(androidContent.includes('"application/pdf"'));
    assert.ok(androidContent.includes('"image/png"'));
    assert.ok(androidContent.includes('"image/jpeg"'));
    assert.ok(androidContent.includes('"image/webp"'));
    assert.ok(androidContent.includes("PDF, PNG, JPG, or WebP (max 5MB)"));
  });

  await t.test("Regression contract: Web payment receipt and Government ID remain image-only", () => {
    const receiptCardPath = path.join(srcDir, "features/payments/components/ReceiptUploadCard.tsx");
    const receiptContent = fs.readFileSync(receiptCardPath, "utf8");
    assert.ok(receiptContent.includes("['image/png', 'image/jpeg', 'image/jpg']"));
    assert.ok(!receiptContent.includes("application/pdf"));

    const govIdPath = path.join(srcDir, "components/profile/GovernmentIdSection.tsx");
    const govIdContent = fs.readFileSync(govIdPath, "utf8");
    assert.ok(!govIdContent.includes("application/pdf"));
  });
});

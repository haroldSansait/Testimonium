import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentRequestStatus } from "../src/shared/constants.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../src");

test("Parishioner Web Features 2 & 7 Regression Suite", async (t) => {
  await t.test("Feature 2: ParishPersonnelList source contract & rendering logic", () => {
    const listPath = path.join(srcDir, "features/parishes/components/ParishPersonnelList.tsx");
    const content = fs.readFileSync(listPath, "utf8");

    // Must render primary as "Parish Priest:"
    assert.ok(content.includes("Parish Priest: {priest}"), "Primary priest must be labeled Parish Priest");

    // Must render assistants as "Parochial Vicar:"
    assert.ok(content.includes("Parochial Vicar: {asst.name}"), "Assistants must be labeled Parochial Vicar");

    // Must gate assistants on assistantPriests.length > 0
    assert.ok(content.includes("assistantPriests.length > 0"), "Must not show assistant section if none exist");

    // Must render secretary
    assert.ok(content.includes("Secretary: {secretary}"), "Secretary must be rendered");
  });

  await t.test("Feature 2: ParishDrawer effective parish consistency", () => {
    const drawerPath = path.join(srcDir, "features/parishes/components/ParishDrawer.tsx");
    const content = fs.readFileSync(drawerPath, "utf8");

    // ParishPersonnelList must use effectiveParish fields
    assert.ok(content.includes("priest={effectiveParish.assignedPriest}"), "Must pass effectiveParish.assignedPriest");
    assert.ok(content.includes("secretary={effectiveParish.assignedSecretary}"), "Must pass effectiveParish.assignedSecretary");
    assert.ok(content.includes("assistantPriests={effectiveParish.assistantPriests}"), "Must pass effectiveParish.assistantPriests");

    // Must not mix parish.assignedPriest with effectiveParish
    assert.ok(!content.includes("priest={parish.assignedPriest}"), "Must not use raw parish.assignedPriest in drawer");
  });

  await t.test("Feature 2: Parish type and API mapper include assistantPriests", () => {
    // Check types
    const typesPath = path.join(srcDir, "types/index.ts");
    const typesContent = fs.readFileSync(typesPath, "utf8");
    assert.ok(typesContent.includes("assistantPriests?: { id: string | number; name: string }[];"), "Parish type must include assistantPriests array");

    // Check API mapper
    const mapperPath = path.join(srcDir, "providers/api/parish.ts");
    const mapperContent = fs.readFileSync(mapperPath, "utf8");
    assert.ok(mapperContent.includes("assistantPriests: Array.isArray(p.assistantPriests) ? p.assistantPriests : [],"), "API mapper must map assistantPriests");
  });

  await t.test("Feature 7: DocumentRequestStatus enum and client status mapping", () => {
    // 1. Shared constants must include READY_FOR_SIGNING
    assert.equal(DocumentRequestStatus.READY_FOR_SIGNING, "READY_FOR_SIGNING");

    // 2. request.ts mapper maps READY_FOR_SIGNING to 'processing'
    const reqPath = path.join(srcDir, "providers/api/request.ts");
    const reqContent = fs.readFileSync(reqPath, "utf8");
    assert.ok(reqContent.includes("case 'READY_FOR_SIGNING':"), "request.ts must handle READY_FOR_SIGNING");
    assert.ok(reqContent.includes("case 'PROCESSING':\n    case 'READY_FOR_SIGNING':\n      return 'processing';"), "READY_FOR_SIGNING must map to 'processing'");
  });

  await t.test("Correction uploads exclude system-satisfied valid_id while preserving resubmit", () => {
    const pagePath = path.join(srcDir, "pages/dashboard/RequestTrackingPage.tsx");
    const content = fs.readFileSync(pagePath, "utf8");

    assert.match(content, /correctionRequirementIds \|\| \[\]\)\.filter\([\s\S]*?id => id !== 'valid_id'/);
    assert.match(content, /const filtered = reqs\.filter\(\(r: any\) => selectedReqIds\.includes\(r\.id\)\)/);
    assert.ok(content.includes("Government ID verification is handled separately and does not require a replacement file here."));
    assert.match(content, /correctionReqsList\.map\(req =>/);
    assert.match(content, /services\.request\.resubmitCorrections\(selectedRequest\.id\)/);
    assert.match(content, /correctionReqsList\.some\(req => !uploadedFilesByCorrectionReq\[req\.id\]/);
    assert.ok(content.includes("UPLOAD_POLICIES.CORRECTION_DOCUMENT).acceptAttribute"));
    assert.ok(content.includes("UPLOAD_POLICIES.REGISTRANT_ID_IMAGE"));
    assert.match(content, /onDrop=\{\(e\) =>[\s\S]*?handleCorrectionFileSelect\(req\.id, dropped\)/);
    assert.match(content, /for \(const \[reqId, file\] of entries\)/);
    assert.match(content, /totalCount > 0 && succeededCount === totalCount/);
    assert.ok(content.includes("Please select and retry the remaining files."));
  });
});

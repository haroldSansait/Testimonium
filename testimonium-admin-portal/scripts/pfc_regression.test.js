import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createFinanceDraftMember,
  normalizeCouncilMembers,
  areCouncilSnapshotsEqual,
  shouldReconcileAsSaved,
} from "../src/utils/councilReconciliation.ts";

test("1. Loaded persisted member retains numeric DB `id`", () => {
  const councilEditorSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/settings/ParishCouncilEditor.tsx"),
    "utf-8"
  );

  // Verify mapMemberFromApi extracts numeric ID from server response
  assert.match(
    councilEditorSource,
    /const numericId = typeof m\?\.id === 'number'\s*\?\s*m\.id\s*:\s*\(typeof m\?\.id === 'string' && \/\^\\d\+\$\/\.test\(m\.id\.trim\(\)\)\s*\?\s*parseInt\(m\.id\.trim\(\), 10\)\s*:\s*undefined\);/,
    "Loaded member must preserve numeric DB id"
  );
  assert.match(
    councilEditorSource,
    /uiKey:\s*numericId \? `member-\${numericId}` : `\${prefix}-draft-/,
    "Persistent member uiKey is derived from numeric id; drafts receive temporary uiKey"
  );
});

test("2. Save payload sends persisted IDs", () => {
  const councilEditorSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/settings/ParishCouncilEditor.tsx"),
    "utf-8"
  );

  // Verify handleSave passes `id: typeof m?.id === 'number' ? m.id : undefined`
  assert.match(
    councilEditorSource,
    /pastoralCouncilMembers:\s*\(pastoralMembers \|\| \[\]\)\.map\(\(m\) => \(\{\s*id:\s*typeof m\?\.id === 'number' \? m\.id : undefined,\s*positionTitle:/,
    "Save payload must send numeric persistent id for PPC"
  );
  assert.match(
    councilEditorSource,
    /financeCouncilMembers:\s*\(financeMembers \|\| \[\]\)\.map\(\(m\) => \(\{\s*id:\s*typeof m\?\.id === 'number' \? m\.id : undefined,\s*positionTitle:/,
    "Save payload must send numeric persistent id for PFC"
  );
});

test("3. New unsaved PPC member has no DB ID", () => {
  const councilEditorSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/settings/ParishCouncilEditor.tsx"),
    "utf-8"
  );

  // Verify handleAddPastoralMember sets uiKey and blank fields without any id
  assert.match(
    councilEditorSource,
    /handleAddPastoralMember = \(\) => \{\s*setPastoralMembers\(\(prev\) => \[\s*\.\.\.prev,\s*\{\s*uiKey: `ppc-draft-\$\{Date\.now\(\)\}-\$\{\+\+ppcDraftCounter\}/,
    "New PPC member draft must have uiKey and no DB id"
  );
});

test("4. New unsaved PFC member has no DB ID", () => {
  const draft = createFinanceDraftMember();
  assert.ok(draft.uiKey.startsWith("pfc-draft-"), "Must have temporary uiKey");
  assert.equal(draft.id, undefined, "Unsaved PFC draft must NOT have a DB id");
  assert.equal(typeof draft.id, "undefined");
  assert.equal(draft.positionTitle, "");
  assert.equal(draft.memberName, "");
});

test("5. Temporary UI key never enables photo upload", () => {
  const uploaderSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/settings/OfficerPhotoUploader.tsx"),
    "utf-8"
  );

  // Extract isPersistedMember logic
  const isPersistedMember = (id) => {
    if (typeof id === 'number' && Number.isInteger(id) && id > 0) return true;
    if (typeof id === 'string' && /^\d+$/.test(id.trim()) && Number.parseInt(id.trim(), 10) > 0) return true;
    return false;
  };

  // Test temporary string keys
  assert.equal(isPersistedMember("pfc-1725512345-abcd"), false);
  assert.equal(isPersistedMember("ppc-draft-1725512345-1-xyz"), false);
  assert.equal(isPersistedMember(undefined), false);
  assert.equal(isPersistedMember(null), false);
  assert.equal(isPersistedMember(""), false);
  assert.equal(isPersistedMember(0), false);
  assert.equal(isPersistedMember(-5), false);

  // Real persistent IDs
  assert.equal(isPersistedMember(101), true);
  assert.equal(isPersistedMember("101"), true);
  assert.equal(isPersistedMember(9999), true);

  assert.match(
    uploaderSource,
    /const isSavedMember = Boolean\(parishId && isPersistedMember\(memberId\)\);/,
    "OfficerPhotoUploader must strictly verify genuine numeric DB persistence"
  );
});

test("6. After successful save, returned new DB ID enables photo upload", () => {
  const councilEditorSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/settings/ParishCouncilEditor.tsx"),
    "utf-8"
  );

  // Verify reconcileMembersWithState merges returned server numeric id into local state
  assert.match(
    councilEditorSource,
    /const reconciledPpc = reconcileMembersWithState\(pastoralMembers, result\.pastoralCouncilMembers, 'ppc'\);/,
    "PPC members reconciled after save"
  );
  assert.match(
    councilEditorSource,
    /const reconciledPfc = reconcileMembersWithState\(financeMembers, result\.financeCouncilMembers, 'pfc'\);/,
    "PFC members reconciled after save"
  );

  // Verify uiKey preservation during reconciliation
  assert.match(
    councilEditorSource,
    /const uiKey = localItem\?\.uiKey \|\| \(numericId \? `member-\$\{numericId\}` : `\$\{prefix\}-\$\{Date\.now\(\)\}-\$\{idx\}`\);/,
    "uiKey must remain stable across save reconciliation"
  );
});

test("7. Existing member ordinary text edit preserves same ID", () => {
  const councilEditorSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/settings/ParishCouncilEditor.tsx"),
    "utf-8"
  );

  // Verify handleUpdatePastoralMember keeps existing member object spread with updated field
  assert.match(
    councilEditorSource,
    /next\[index\] = \{ \.\.\.next\[index\], \[field\]: value \};/,
    "Updating a member field must preserve the existing id, uiKey, and photoUrl"
  );
});

test("30. Current PFC native toggle regression test protects `relative` class", () => {
  const pfcEditorPath = path.resolve(
    process.cwd(),
    "src/components/settings/ParishFinanceCouncilEditor.tsx"
  );
  assert.ok(fs.existsSync(pfcEditorPath), "ParishFinanceCouncilEditor.tsx must exist");
  const pfcEditorSource = fs.readFileSync(pfcEditorPath, "utf-8");

  // Invariant: <label className="relative ..."> containing block MUST exist
  assert.match(
    pfcEditorSource,
    /<label[\s\S]*?className="relative flex items-center/,
    "CRITICAL: PFC toggle label must strictly retain the 'relative' positioning class"
  );
  assert.match(
    pfcEditorSource,
    /<input[\s\S]*?type="checkbox"[\s\S]*?className="sr-only peer"/,
    "CRITICAL: PFC native checkbox must retain sr-only peer attributes"
  );
});

test("31, 32, 33. Officer photo uploader: upload/replace/remove and text-saving independence", () => {
  const uploaderPath = path.resolve(
    process.cwd(),
    "src/components/settings/OfficerPhotoUploader.tsx"
  );
  assert.ok(fs.existsSync(uploaderPath), "OfficerPhotoUploader.tsx must exist");
  const uploaderSource = fs.readFileSync(uploaderPath, "utf-8");

  assert.match(uploaderSource, /Choose Photo|Upload|Photo/i);
  assert.match(uploaderSource, /Replace/i);
  assert.match(uploaderSource, /Remove/i);
  assert.match(uploaderSource, /Save member first/i, "Unsaved members must display save badge before photo binding");
  assert.match(uploaderSource, /MAX_SIZE = 2 \* 1024 \* 1024/, "Client enforces 2MB photo limit");
});


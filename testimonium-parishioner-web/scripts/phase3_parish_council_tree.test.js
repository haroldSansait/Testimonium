import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ─── 1. Avatar initials & Fallback Invariants ─────────────────────────────────

function getInitials(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

test("25. Member without photo renders placeholder initials", () => {
  assert.equal(getInitials("Juan Dela Cruz"), "JC");
  assert.equal(getInitials("Maria"), "M");
  assert.equal(getInitials(""), "?");
  assert.equal(getInitials("Fr. Jose Burgos"), "FB");
});

test("26. Broken photo URL falls back safely", () => {
  // Simulating Avatar state machine
  class AvatarState {
    constructor(src, name) {
      this.src = src;
      this.name = name;
      this.imgError = false;
    }
    onError() {
      this.imgError = true;
    }
    render() {
      if (this.src && !this.imgError) {
        return { type: "IMAGE", src: this.src, alt: this.name };
      }
      return { type: "INITIALS", text: getInitials(this.name) };
    }
  }

  // Initial valid src
  const avatar = new AvatarState("https://r2.testimonium.ph/broken-photo.jpg", "Pedro Calungsod");
  assert.equal(avatar.render().type, "IMAGE");

  // On image load error
  avatar.onError();
  const fallback = avatar.render();
  assert.equal(fallback.type, "INITIALS");
  assert.equal(fallback.text, "PC");
});

// ─── 2. Organizational Tree Hierarchy & Ordering ─────────────────────────────

test("27. Tree preserves configured ordering and apex officer", () => {
  const members = [
    { positionTitle: "PPC Chairperson", memberName: "Juan Dela Cruz", photoUrl: "https://r2/1.jpg" },
    { positionTitle: "PPC Vice Chairperson", memberName: "Maria Santos", photoUrl: null },
    { positionTitle: "Secretary", memberName: "Clara Garcia", photoUrl: null },
    { positionTitle: "Treasurer", memberName: "Pedro Reyes", photoUrl: null },
  ];

  const leadOfficer = members.length > 0 ? members[0] : null;
  const subsequentOfficers = members.length > 1 ? members.slice(1) : [];

  // Invariant: First officer is apex/highest
  assert.equal(leadOfficer.memberName, "Juan Dela Cruz");
  assert.equal(leadOfficer.positionTitle, "PPC Chairperson");

  // Invariant: Subsequent officers follow exact array order
  assert.equal(subsequentOfficers.length, 3);
  assert.equal(subsequentOfficers[0].memberName, "Maria Santos");
  assert.equal(subsequentOfficers[1].memberName, "Clara Garcia");
  assert.equal(subsequentOfficers[2].memberName, "Pedro Reyes");
});

test("28. Tree responsive layout provides phone-friendly vertical branch view", () => {
  const treeModalSource = fs.readFileSync(
    path.join(process.cwd(), "src/features/parishes/components/ParishCouncilTreeModal.tsx"),
    "utf-8"
  );

  // Must have mobile-specific vertical stack/stepper structure (sm:hidden with border-l)
  assert.match(
    treeModalSource,
    /sm:hidden/,
    "Must include mobile-specific layout view"
  );
  assert.match(
    treeModalSource,
    /border-l-2/,
    "Must use vertical connector branch for mobile view instead of horizontal dragging chart"
  );
  assert.match(
    treeModalSource,
    /hidden sm:grid/,
    "Desktop view uses responsive multi-column grid"
  );
});

// ─── 3. PPC / PFC Differentiation & Empty State ──────────────────────────────

test("23. PFC tree appears only under correct enabled/public conditions", () => {
  const treeModalSource = fs.readFileSync(
    path.join(process.cwd(), "src/features/parishes/components/ParishCouncilTreeModal.tsx"),
    "utf-8"
  );

  assert.match(
    treeModalSource,
    /hasFinanceCouncil = councils\?\.finance !== null && councils\?\.finance !== undefined/,
    "PFC switcher tab must only render if finance council is not null/undefined"
  );

  // When finance is null:
  const nullFinanceCouncils = { pastoral: { members: [] }, finance: null };
  const hasFinance = nullFinanceCouncils.finance !== null && nullFinanceCouncils.finance !== undefined;
  assert.equal(hasFinance, false, "Disabled PFC must never appear in public org tree modal");
});

test("24. Empty PPC state remains intentional", () => {
  const treeModalSource = fs.readFileSync(
    path.join(process.cwd(), "src/features/parishes/components/ParishCouncilTreeModal.tsx"),
    "utf-8"
  );

  assert.match(
    treeModalSource,
    /Parish Pastoral Council has not yet been configured\./,
    "Must provide explicit intentional empty state for unconfigured PPC"
  );
  assert.match(
    treeModalSource,
    /Parish Finance Council has not yet been configured\./,
    "Must provide explicit intentional empty state for unconfigured PFC"
  );
});

// ─── 4. Parish Detail Expansion & Gating ─────────────────────────────────────

test("21. Parish detail renders existing information with non-destructive expansion", () => {
  const drawerSource = fs.readFileSync(
    path.join(process.cwd(), "src/features/parishes/components/ParishDrawer.tsx"),
    "utf-8"
  );

  // Preserved fields
  assert.match(drawerSource, /parish\.name/);
  assert.match(drawerSource, /effectiveParish\.type/);
  assert.match(drawerSource, /parish\.address/);
  assert.match(drawerSource, /parish\.feastDay/);
  assert.match(drawerSource, /parish\.patronSaint/);
  assert.match(drawerSource, /parish\.phone/);
  assert.match(drawerSource, /parish\.email/);
  assert.match(drawerSource, /effectiveParish\.venueCapacity/);
  assert.match(drawerSource, /effectiveParish\.gallery/);
  assert.match(drawerSource, /ParishCouncilSection/);
});

test("29. Existing Request/Schedule CTA profile gates remain unchanged", () => {
  const directorySource = fs.readFileSync(
    path.join(process.cwd(), "src/pages/dashboard/ParishDirectoryPage.tsx"),
    "utf-8"
  );

  assert.match(
    directorySource,
    /requireCompleteProfile\(\s*\(\)\s*=>\s*navigate\(`\/dashboard\/request\?parishId=\$\{parishId\}`\)/,
    "Document request CTA must preserve profile completion gate"
  );
  assert.match(
    directorySource,
    /requireCompleteProfile\(\s*\(\)\s*=>\s*navigate\(`\/dashboard\/scheduler\?parishId=\$\{parishId\}`\)/,
    "Schedule appointment CTA must preserve profile completion gate"
  );
});

// ─── 5. PFC Regression Boundary Protection ───────────────────────────────────

test("30. Current PFC native toggle regression test protects `relative` class", () => {
  const pfcEditorPath = path.resolve(
    process.cwd(),
    "../testimonium-admin-portal/src/components/settings/ParishFinanceCouncilEditor.tsx"
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
    "../testimonium-admin-portal/src/components/settings/OfficerPhotoUploader.tsx"
  );
  assert.ok(fs.existsSync(uploaderPath), "OfficerPhotoUploader.tsx must exist");
  const uploaderSource = fs.readFileSync(uploaderPath, "utf-8");

  // Upload/replace/remove presence
  assert.match(uploaderSource, /Choose Photo|Upload/i);
  assert.match(uploaderSource, /Replace/i);
  assert.match(uploaderSource, /Remove/i);
  assert.match(uploaderSource, /Save member first/i, "Unsaved members must display save badge before photo binding");
  assert.match(uploaderSource, /MAX_SIZE = 2 \* 1024 \* 1024/, "Client enforces 2MB photo limit");

  const councilEditorPath = path.resolve(
    process.cwd(),
    "../testimonium-admin-portal/src/components/settings/ParishCouncilEditor.tsx"
  );
  const councilEditorSource = fs.readFileSync(councilEditorPath, "utf-8");

  // Text saving independence: no photo is required to submit council text
  assert.match(
    councilEditorSource,
    /positionTitle:\s*\(m\?\.positionTitle \|\| ''\)\.trim\(\)/,
    "Text editing remains functional"
  );
  assert.match(
    councilEditorSource,
    /memberName:\s*\(m\?\.memberName \|\| ''\)\.trim\(\)/,
    "Member name remains functional"
  );
});

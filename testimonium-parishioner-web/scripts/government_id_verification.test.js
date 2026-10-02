import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../src");

test("Web Government ID Verification Contract & Component Suite", async (t) => {
  const sectionPath = path.join(srcDir, "components/profile/GovernmentIdSection.tsx");
  const sectionContent = fs.readFileSync(sectionPath, "utf8");

  const profilePagePath = path.join(srcDir, "pages/dashboard/ProfilePage.tsx");
  const profilePageContent = fs.readFileSync(profilePagePath, "utf8");

  const requestWizardPath = path.join(srcDir, "pages/dashboard/SacramentalRequestPage.tsx");
  const requestWizardContent = fs.readFileSync(requestWizardPath, "utf8");

  const schedulerPath = path.join(srcDir, "pages/dashboard/EventSchedulerPage.tsx");
  const schedulerContent = fs.readFileSync(schedulerPath, "utf8");

  await t.test("60 & 61. NOT_SUBMITTED profile UI requires both front and back images", () => {
    assert.ok(sectionContent.includes("NOT_SUBMITTED"), "Must support NOT_SUBMITTED state");
    assert.ok(sectionContent.includes("Front of ID"), "Must have Front of ID upload section");
    assert.ok(sectionContent.includes("Back of ID"), "Must have Back of ID upload section");
    assert.ok(sectionContent.includes("!frontFile || !backFile"), "Must enforce both front and back files before submission");
  });

  await t.test("62. Preview and replace capabilities before submission", () => {
    assert.ok(sectionContent.includes("frontPreview"), "Must render front preview");
    assert.ok(sectionContent.includes("backPreview"), "Must render back preview");
    assert.ok(sectionContent.includes("clearFront"), "Must allow clearing/replacing front");
    assert.ok(sectionContent.includes("clearBack"), "Must allow clearing/replacing back");
  });

  await t.test("63 & 64. REJECTED reason shown and retry allowed", () => {
    assert.ok(sectionContent.includes("rejectionReason === 'IMAGE_BLURRY'"), "Must display user-friendly blur rejection message");
    assert.ok(sectionContent.includes("rejectionReason === 'NAME_MISMATCH'"), "Must display name mismatch rejection message");
    assert.ok(sectionContent.includes("rejectionReason === 'ID_EXPIRED'"), "Must display expired rejection message");
    assert.ok(sectionContent.includes("Retry Verification"), "Must render Retry button");
    assert.ok(sectionContent.includes("setIsRetrying(true)"), "Must enter retry mode to upload new front/back");
  });

  await t.test("65 & 66. VERIFIED state shown with recognized ID type and expiry date", () => {
    assert.ok(sectionContent.includes("Government ID Verified"), "Must render verified title");
    assert.ok(sectionContent.includes("ID_TYPE_LABELS"), "Must map canonical ID types to human labels");
    assert.ok(sectionContent.includes("expiresAt"), "Must format and display expiration date when present");
    assert.ok(sectionContent.includes("verifiedAt"), "Must format and display verification date");
  });

  await t.test("67 & 68. PROFILE_INCOMPLETE takes precedence; IDENTITY_NOT_VERIFIED gates requests", () => {
    // Check request wizard ordering
    const profileIncompleteIndex = requestWizardContent.indexOf("if (isProfileIncomplete)");
    const govIdGateIndex = requestWizardContent.indexOf("if (!isGovIdVerified)");

    assert.ok(profileIncompleteIndex !== -1, "Profile incomplete check must be present");
    assert.ok(govIdGateIndex !== -1, "Government ID gate must be present");
    assert.ok(profileIncompleteIndex < govIdGateIndex, "Profile incomplete check must precede Government ID gate");

    assert.ok(requestWizardContent.includes("Government ID Verification Required"), "Must display Government ID Verification blocker");
    assert.ok(requestWizardContent.includes("navigate('/dashboard/profile')"), "Must direct user to Profile to verify ID");

    // Check schedule wizard ordering
    const schedProfileIndex = schedulerContent.indexOf("if (isProfileIncomplete)");
    const schedGovIdIndex = schedulerContent.indexOf("if (!isGovIdVerified)");
    assert.ok(schedProfileIndex !== -1);
    assert.ok(schedGovIdIndex !== -1);
    assert.ok(schedProfileIndex < schedGovIdIndex, "Schedule check must also check profile completeness first");
  });

  await t.test("69 & 70. valid_id is functionally satisfied when verified, other requirements still require files", () => {
    assert.ok(
      requestWizardContent.includes("if (req.id === 'valid_id' && isGovIdVerified) return true;"),
      "valid_id must be satisfied locally without an attachment when user is verified"
    );
    assert.ok(
      requestWizardContent.includes("return !!uploadedFilesByReq[req.id];"),
      "Other requirements must still require file uploads"
    );
    assert.ok(
      requestWizardContent.includes("Verified through your TESTIMONIUM profile"),
      "Must render profile verification badge for valid_id requirement item"
    );
  });

  await t.test("71. Failed upload does not falsely show verified", () => {
    assert.ok(
      sectionContent.includes("res.status === 'VERIFIED'"),
      "Only mark verified when backend response explicitly confirms VERIFIED status"
    );
    assert.ok(
      sectionContent.includes("res.status === 'REJECTED'"),
      "Handle rejection cleanly"
    );
  });

  await t.test("ProfilePage incorporates GovernmentIdSection", () => {
    assert.ok(profilePageContent.includes("<GovernmentIdSection />"), "ProfilePage must render GovernmentIdSection");
  });
});

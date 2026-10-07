import {
  getCorrectionEligibleIds,
  hasSystemSatisfiedCorrection,
} from "@/features/requests/correctionRequirements";

const fs = jest.requireActual("node:fs") as {
  readFileSync(path: string, encoding: string): string;
};
const detailSource = fs.readFileSync("src/features/requests/RequestDetailScreen.tsx", "utf8");

describe("document correction hardening", () => {
  it("excludes valid_id from a valid-ID-only legacy correction", () => {
    expect(getCorrectionEligibleIds(["valid_id"])).toEqual([]);
    expect(hasSystemSatisfiedCorrection(["valid_id"])).toBe(true);
  });

  it("keeps only attachment-backed IDs from a mixed correction", () => {
    const ids = ["valid_id", "baptismal_cert", "confirmation_cert"];
    expect(getCorrectionEligibleIds(ids)).toEqual([
      "baptismal_cert",
      "confirmation_cert",
    ]);
    expect(hasSystemSatisfiedCorrection(ids)).toBe(true);
  });

  it("preserves ordinary supporting corrections unchanged", () => {
    const ids = ["baptismal_cert"];
    expect(getCorrectionEligibleIds(ids)).toEqual(ids);
    expect(hasSystemSatisfiedCorrection(ids)).toBe(false);
  });

  it("wires attachment checks, pickers, and uploads to the eligible ID list", () => {
    expect(detailSource).toContain(
      "const missingUploads = correctionEligibleIds.filter((id) => !correctionFiles[id]);"
    );
    expect(detailSource).toContain("{correctionEligibleIds.map((reqId) => {");
    expect(detailSource).not.toContain("{correctionIds.map((reqId) => {");
    expect(detailSource).toContain("for (const reqId of correctionEligibleIds) {");
    expect(detailSource).toContain(
      "Government ID verification is handled separately and does not require a replacement file here."
    );
    expect(detailSource).toContain("await resubmitMutation.mutateAsync(request.id);");
    expect(detailSource).toContain(
      'err.message || "Could not resubmit corrected documents. Please try again."'
    );
  });
});

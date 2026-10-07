const SYSTEM_SATISFIED_REQUIREMENT_ID = "valid_id";

export function getCorrectionEligibleIds(ids: string[] = []): string[] {
  return ids.filter((id) => id !== SYSTEM_SATISFIED_REQUIREMENT_ID);
}

export function hasSystemSatisfiedCorrection(ids: string[] = []): boolean {
  return ids.includes(SYSTEM_SATISFIED_REQUIREMENT_ID);
}

export { SYSTEM_SATISFIED_REQUIREMENT_ID };

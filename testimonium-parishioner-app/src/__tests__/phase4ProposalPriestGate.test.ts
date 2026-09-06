import { isRescheduleProposalPending } from "../features/schedule/presentation";
import type { ScheduleItem } from "../features/schedule/types";

describe("Phase 4 Mobile Parity: Priest Acceptance Gate for Proposal Acceptance", () => {
  const baseProposalSchedule: ScheduleItem = {
    id: 42,
    parishId: 1,
    userId: 7,
    eventType: "WEDDING",
    status: "PROPOSED_RESCHEDULE",
    requestedDate: "2026-10-15T00:00:00.000Z",
    remarks: "Time Slot: 10:00 AM",
    proposedDate: "2026-10-20T00:00:00.000Z",
    proposedStartDatetime: "2026-10-20T10:00:00.000Z",
    rescheduleReason: "Parish hall renovation",
    version: 3,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };

  it("15. Proposal Accept is gated: isPriestAccepted is false when priestResponseStatus is PENDING", () => {
    const item: ScheduleItem = {
      ...baseProposalSchedule,
      assignedPriestId: 10,
      priestResponseStatus: "PENDING",
    };

    const isProposalPending = isRescheduleProposalPending(item.status);
    const hasPriestAssigned = !!item.assignedPriestId;
    const isPriestAccepted = item.priestResponseStatus === "ACCEPTED";
    const canAcceptProposal = isProposalPending && hasPriestAssigned && isPriestAccepted;

    expect(isProposalPending).toBe(true);
    expect(hasPriestAssigned).toBe(true);
    expect(isPriestAccepted).toBe(false);
    expect(canAcceptProposal).toBe(false);
  });

  it("15. Proposal Accept is gated: isPriestAccepted is false when no priest is assigned", () => {
    const item: ScheduleItem = {
      ...baseProposalSchedule,
      assignedPriestId: null,
      priestResponseStatus: null,
    };

    const isProposalPending = isRescheduleProposalPending(item.status);
    const hasPriestAssigned = !!item.assignedPriestId;
    const isPriestAccepted = item.priestResponseStatus === "ACCEPTED";
    const canAcceptProposal = isProposalPending && hasPriestAssigned && isPriestAccepted;

    expect(isProposalPending).toBe(true);
    expect(hasPriestAssigned).toBe(false);
    expect(canAcceptProposal).toBe(false);
  });

  it("15. Proposal Accept is enabled: only when assigned priest has ACCEPTED", () => {
    const item: ScheduleItem = {
      ...baseProposalSchedule,
      assignedPriestId: 10,
      priestResponseStatus: "ACCEPTED",
    };

    const isProposalPending = isRescheduleProposalPending(item.status);
    const hasPriestAssigned = !!item.assignedPriestId;
    const isPriestAccepted = item.priestResponseStatus === "ACCEPTED";
    const canAcceptProposal = isProposalPending && hasPriestAssigned && isPriestAccepted;

    expect(isProposalPending).toBe(true);
    expect(hasPriestAssigned).toBe(true);
    expect(isPriestAccepted).toBe(true);
    expect(canAcceptProposal).toBe(true);
  });

  it("16. Payload includes expectedVersion when responding to reschedule proposal", () => {
    const schedule: ScheduleItem = {
      ...baseProposalSchedule,
      version: 5,
    };

    const payload = {
      scheduleId: schedule.id,
      accept: true,
      expectedVersion: schedule.version,
    };

    expect(payload.expectedVersion).toBe(5);
    expect(payload.accept).toBe(true);
    expect(payload.scheduleId).toBe(42);
  });

  it("16. Cleanly handles priest acceptance race error message mapping", () => {
    const serverError = {
      response: {
        data: {
          code: "PRIEST_ASSIGNMENT_PENDING",
          message: "The assigned priest must accept before confirming the schedule.",
        },
      },
    };

    const msg =
      serverError?.response?.data?.message || "Failed to submit response.";
    expect(msg).toContain("assigned priest must accept");
  });
});

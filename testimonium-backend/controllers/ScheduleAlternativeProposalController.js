import { ScheduleAlternativeProposalService } from "../services/ScheduleAlternativeProposalService.js";

const service = new ScheduleAlternativeProposalService();

function actor(req) {
  return {
    actorId: req.user.id,
    actorRole: req.user.role,
    actorParishId: req.user.parish?.id || req.user.parishId,
  };
}

export const listAlternativeProposals = async (req, res, next) => {
  try {
    const data = await service.list(req.params.id, actor(req));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const submitAlternativeProposal = async (req, res, next) => {
  try {
    const data = await service.submit(req.params.id, { ...req.body, ...actor(req) });
    return res.status(201).json({
      success: true,
      message: "Alternative-date proposal submitted.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const withdrawAlternativeProposal = async (req, res, next) => {
  try {
    const data = await service.withdraw(req.params.id, req.params.proposalId, {
      ...req.body,
      ...actor(req),
    });
    return res.status(200).json({ success: true, message: "Alternative-date proposal withdrawn.", data });
  } catch (error) {
    return next(error);
  }
};

export const declineAlternativeProposal = async (req, res, next) => {
  try {
    const data = await service.decline(req.params.id, req.params.proposalId, {
      ...req.body,
      ...actor(req),
    });
    return res.status(200).json({ success: true, message: "Alternative-date proposal declined.", data });
  } catch (error) {
    return next(error);
  }
};

export const nominateAlternativeProposalPriest = async (req, res, next) => {
  try {
    const data = await service.nominate(req.params.id, req.params.proposalId, {
      ...req.body,
      ...actor(req),
    });
    return res.status(200).json({ success: true, message: "Priest nominated for the alternative date.", data });
  } catch (error) {
    return next(error);
  }
};

export const revokeAlternativeProposalNomination = async (req, res, next) => {
  try {
    const data = await service.revokeNomination(req.params.id, req.params.proposalId, {
      ...req.body,
      ...actor(req),
    });
    return res.status(200).json({ success: true, message: "Priest nomination revoked.", data });
  } catch (error) {
    return next(error);
  }
};

export const respondAlternativeProposalNomination = async (req, res, next) => {
  try {
    const data = await service.priestRespond(req.params.id, req.params.proposalId, {
      ...req.body,
      ...actor(req),
    });
    return res.status(200).json({
      success: true,
      message: req.body.status === "ACCEPTED"
        ? "Alternative-date nomination accepted and applied."
        : "Alternative-date nomination declined.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

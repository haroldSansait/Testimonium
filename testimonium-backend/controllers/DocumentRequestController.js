import { DocumentRequestService } from "../services/DocumentRequestService.js";

const documentRequestService = new DocumentRequestService();

export const list = async (req, res, next) => {
  try {
    const { page, limit, search, status, documentType } = req.query;
    const parishId = req.user.role !== "DIOCESE_COORDINATOR" ? req.user.parish?.id : undefined;

    const { data, total } = await documentRequestService.list({
      page,
      limit,
      search,
      status,
      documentType,
      parishId,
    });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, remarks, correctionRequirementIds, correctionReasonCode, correctionNote } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    if (actorRole === "PRIEST") {
      return res.status(403).json({
        success: false,
        message: "Priests have read-only access to document requests.",
      });
    }

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document request ID.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    const updated = await documentRequestService.updateStatus(
      id,
      status,
      remarks,
      actorId,
      actorRole,
      actorParishId,
      correctionRequirementIds,
      correctionReasonCode,
      correctionNote
    );

    return res.status(200).json({
      success: true,
      message: "Document request status updated successfully.",
      data: updated,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        code: err.code,
        message: err.message,
      });
    }
    return next(err);
  }
};

export const downloadAttachment = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    if (isNaN(requestId) || isNaN(attachmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID or attachment ID.",
      });
    }

    const { prisma } = await import("../config/db.js");
    const { R2Service } = await import("../services/R2Service.js");

    const request = await prisma.documentRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Document request not found.",
      });
    }

    // Role and Tenant authorization check:
    // SECRETARY and PRIEST can only access requests for their own parish.
    // DIOCESE_COORDINATOR can access cross-parish requests.
    if (actorRole === "SECRETARY" || actorRole === "PRIEST") {
      if (request.parishId !== actorParishId) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Request belongs to a different parish.",
        });
      }
    } else if (actorRole !== "DIOCESE_COORDINATOR") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized role.",
      });
    }

    const attachment = await prisma.requestAttachment.findFirst({
      where: { id: attachmentId, requestId },
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found.",
      });
    }

    const r2Service = new R2Service();
    const downloadStream = await r2Service.download(attachment.r2ObjectKey);

    res.setHeader("Content-Type", attachment.fileType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(attachment.fileName)}"`
    );

    if (downloadStream.ContentLength) {
      res.setHeader("Content-Length", downloadStream.ContentLength);
    }

    downloadStream.Body.pipe(res);
  } catch (err) {
    return next(err);
  }
};

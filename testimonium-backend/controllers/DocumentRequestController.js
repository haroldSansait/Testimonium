import { DocumentRequestService } from "../services/DocumentRequestService.js";
import { prisma } from "../config/db.js";
import { R2Service } from "../services/R2Service.js";
import { RegistrantIdStorageService } from "../services/RegistrantIdStorageService.js";

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
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
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

const assertStaffRequestAccess = async (requestId, req, { allowPriest = true } = {}) => {
  const request = await prisma.documentRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    const error = new Error("Document request not found.");
    error.statusCode = 404;
    throw error;
  }
  const role = req.user.role;
  const parishId = req.user.parish?.id || req.user.parishId;
  if (role === "PRIEST" && !allowPriest) {
    const error = new Error("Priests are not authorized to view registrant Government ID evidence.");
    error.statusCode = 403;
    throw error;
  }
  if (["SECRETARY", "PRIEST"].includes(role) && request.parishId !== parishId) {
    const error = new Error("Unauthorized: Request belongs to a different parish.");
    error.statusCode = 403;
    throw error;
  }
  if (!["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"].includes(role)) {
    const error = new Error("Unauthorized role.");
    error.statusCode = 403;
    throw error;
  }
  return request;
};

export const getRegistrantIdEvidence = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const request = await assertStaffRequestAccess(requestId, req, { allowPriest: false });
    const evidence = await prisma.registrantIdEvidence.findUnique({ where: { requestId } });
    if (!evidence) return res.status(200).json({ success: true, data: null });
    return res.status(200).json({
      success: true,
      data: {
        requestId,
        applicantName: request.applicantName,
        relationship: request.relationship,
        version: evidence.version,
        front: { available: Boolean(evidence.frontObjectKey), uploadedAt: evidence.frontUploadedAt, mimeType: evidence.frontMimeType, size: evidence.frontSize },
        back: { available: Boolean(evidence.backObjectKey), uploadedAt: evidence.backUploadedAt, mimeType: evidence.backMimeType, size: evidence.backSize },
        ocrStatus: evidence.ocrStatus,
        ocrErrorCode: evidence.ocrErrorCode,
        extractedName: evidence.extractedName,
        detectedIdType: evidence.detectedIdType,
        idNumber: evidence.idNumber,
        dateOfBirth: evidence.dateOfBirth,
        expiryDate: evidence.expiryDate,
        frontText: evidence.frontText,
        backText: evidence.backText,
        advisoryFlags: evidence.advisoryFlags,
        processedAt: evidence.processedAt,
        label: "OCR-extracted - not independently verified",
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const streamRegistrantIdEvidence = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const side = req.params.side;
    if (!["front", "back"].includes(side)) return res.status(400).json({ success: false, code: "INVALID_REGISTRANT_ID_SIDE", message: "Invalid registrant ID side." });
    await assertStaffRequestAccess(requestId, req, { allowPriest: false });
    const evidence = await prisma.registrantIdEvidence.findUnique({ where: { requestId } });
    const key = side === "front" ? evidence?.frontObjectKey : evidence?.backObjectKey;
    const mime = side === "front" ? evidence?.frontMimeType : evidence?.backMimeType;
    if (!key) return res.status(404).json({ success: false, message: "Registrant ID image not found." });
    const object = await RegistrantIdStorageService.download(key);
    res.setHeader("Content-Type", mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="registrant-id-${side}.${mime === "image/png" ? "png" : "jpg"}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (object.ContentLength) res.setHeader("Content-Length", object.ContentLength);
    object.Body.pipe(res);
  } catch (error) {
    return next(error);
  }
};

export const streamReceipt = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const receiptId = parseInt(req.params.receiptId, 10);
    await assertStaffRequestAccess(requestId, req, { allowPriest: true });
    const receipt = await prisma.receiptUpload.findFirst({ where: { id: receiptId, transaction: { requestId } } });
    if (!receipt) return res.status(404).json({ success: false, message: "Receipt not found." });
    const object = await new R2Service().download(receipt.r2ObjectKey);
    res.setHeader("Content-Type", receipt.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(receipt.fileName || "receipt")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (object.ContentLength) res.setHeader("Content-Length", object.ContentLength);
    object.Body.pipe(res);
  } catch (error) {
    return next(error);
  }
};

import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { FileUploadService } from "../services/FileUploadService.js";
import { ReceiptVerificationService } from "../services/ReceiptVerificationService.js";
import { DocumentRequirementService } from "../services/DocumentRequirementService.js";
import { prisma } from "../config/db.js";
import { R2Service, isMissingR2ObjectError } from "../services/R2Service.js";
import { RegistrantIdEvidenceService } from "../services/RegistrantIdEvidenceService.js";
import { RegistrantIdStorageService } from "../services/RegistrantIdStorageService.js";
import { isSelfRelationship } from "../config/relationshipEvidence.js";

const requestService = new ParishionerRequestService();

const parsePositiveId = (value) => {
  const raw = String(value || "").trim();
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const create = async (req, res, next) => {
  try {
    const userId = req.user.id; // derived from authenticated user token context
    const idempotencyKey =
      req.headers["idempotency-key"] ||
      req.headers["x-idempotency-key"] ||
      req.body?.idempotencyKey ||
      null;

    const draft = await requestService.createDraft(userId, req.body, idempotencyKey);

    return res.status(201).json({
      success: true,
      message: "Request draft created successfully.",
      data: draft,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        ...(err.code ? { code: err.code } : {}),
        message: err.message,
      });
    }
    return next(err);
  }
};

export const deleteDraft = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid request ID." });
    const result = await requestService.deleteDraft(id, req.user.id);
    return res.status(200).json({ success: true, message: "Draft deleted successfully.", data: result });
  } catch (err) {
    return next(err);
  }
};

export const updateDraft = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid request ID." });
    const draft = await requestService.updateDraft(id, req.user.id, req.body);
    return res.status(200).json({ success: true, message: "Draft saved successfully.", data: draft });
  } catch (err) {
    return next(err);
  }
};

export const submitDraft = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const request = await requestService.submitDraft(parseInt(id, 10), userId);

    return res.status(200).json({
      success: true,
      message: "Request finalized and submitted successfully.",
      data: request,
    });
  } catch (err) {
    return next(err);
  }
};

export const cancel = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { remarks } = req.body;
    const request = await requestService.cancelRequest(
      parseInt(id, 10),
      userId,
      remarks || "Cancelled by requester"
    );

    return res.status(200).json({
      success: true,
      message: "Request cancelled successfully.",
      data: request,
    });
  } catch (err) {
    return next(err);
  }
};

export const list = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit, search, status, documentType } = req.query;

    const { data, total } = await requestService.listRequests(userId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      search,
      status,
      documentType,
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

export const getById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const request = await requestService.getRequestById(parseInt(id, 10), userId);

    return res.status(200).json({
      success: true,
      data: request,
    });
  } catch (err) {
    return next(err);
  }
};

export const getByTracking = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { trackingNumber } = req.params;
    const request = await requestService.getRequestByTrackingNumber(trackingNumber, userId);

    return res.status(200).json({
      success: true,
      data: request,
    });
  } catch (err) {
    return next(err);
  }
};

export const uploadFiles = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    // Verify ownership of request first
    const request = await requestService.getRequestById(requestId, userId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found or does not belong to this user.",
      });
    }

    // State check: allow uploads only for draft or needs correction
    if (!request.isDraft && request.status !== "NEEDS_CORRECTION") {
      return res.status(400).json({
        success: false,
        message: "Attachments cannot be uploaded for requests in the current status.",
        errors: [],
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded.",
        errors: [],
      });
    }

    if (!req.body.category || typeof req.body.category !== "string" || req.body.category.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Attachment category is required and must match a configured requirement ID.",
        errors: [],
      });
    }

    const category = req.body.category.trim();

    if (["registrant_id_front", "registrant_id_back"].includes(category)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ATTACHMENT_CATEGORY",
        message: "Registrant ID images must use the dedicated private evidence endpoint.",
        errors: [],
      });
    }

    if (category === "authorization_letter") {
      if (isSelfRelationship(request.relationship)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ATTACHMENT_CATEGORY",
          message: "Authorization letter is only applicable to non-Self requests.",
          errors: [],
        });
      }
      if (!request.isDraft && request.status === "NEEDS_CORRECTION" && !(request.correctionRequirementIds || []).includes("authorization_letter")) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ATTACHMENT_CATEGORY",
          message: "Authorization Letter replacement was not requested for this correction round.",
          errors: [],
        });
      }
    } else {
      // Validate category against authoritative requirements for this document type & parish
      const reqConfig = await DocumentRequirementService.getRequirements(
        request.documentType,
        request.parishId
      );
      const validRequirementIds = new Set(
        (reqConfig?.requiredDocuments || []).map((d) => d.id)
      );

      if (!validRequirementIds.has(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid attachment category "${category}" for document type "${request.documentType}". Must match a valid requirement ID.`,
          errors: [],
        });
      }
    }

    // Upload files to R2 and create DB records
    const uploads = [];
    for (const file of req.files) {
      const attachment = category === "authorization_letter"
        ? await FileUploadService.uploadAuthorizationLetter(requestId, userId, file)
        : await FileUploadService.uploadAttachment(requestId, file, category);
      uploads.push(attachment);
    }

    return res.status(201).json({
      success: true,
      message: `${uploads.length} file(s) attached successfully.`,
      data: uploads,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
};

export const uploadReceipt = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const requestId = parseInt(id, 10);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt file is required.",
        errors: [],
      });
    }

    const verificationResult = await ReceiptVerificationService.processReceipt(
      requestId,
      userId,
      req.file
    );

    return res.status(202).json({
      success: true,
      receiptId: verificationResult.receiptId,
      attemptVersion: verificationResult.attemptVersion,
      ocrStatus: "PENDING",
      message: "Payment proof uploaded. Checking payment proof quality...",
      data: {
        autoVerified: false,
        ocrPending: true,
        receiptId: verificationResult.receiptId,
        attemptVersion: verificationResult.attemptVersion,
        ocrStatus: "PENDING",
        request: verificationResult.request,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        ...(err.code ? { code: err.code } : {}),
        message: err.message,
        errors: err.field ? [{ field: err.field, message: err.message }] : [],
      });
    }
    return next(err);
  }
};

export const resubmitCorrections = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document request ID.",
      });
    }

    const updated = await requestService.resubmitCorrections(requestId, userId);

    return res.status(200).json({
      success: true,
      message: "Corrected documents resubmitted successfully.",
      data: updated,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        ...(err.code ? { code: err.code } : {}),
        message: err.message,
      });
    }
    return next(err);
  }
};

export const downloadAttachment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const requestId = parsePositiveId(req.params.id);
    const attachmentId = parsePositiveId(req.params.attachmentId);

    if (!requestId || !attachmentId) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID or attachment ID.",
      });
    }

    // Ownership check: must belong to the requesting parishioner
    const request = await requestService.getRequestById(requestId, userId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found or access denied.",
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
    let downloadStream;
    try {
      downloadStream = await r2Service.download(attachment.r2ObjectKey);
    } catch (err) {
      if (isMissingR2ObjectError(err)) {
        return res.status(404).json({
          success: false,
          code: "ATTACHMENT_FILE_MISSING",
          message: "The attachment file is no longer available. Please contact the parish office.",
        });
      }
      throw err;
    }

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

export const uploadRegistrantId = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    if (!Number.isInteger(requestId)) return res.status(400).json({ success: false, code: "INVALID_REQUEST_ID", message: "Invalid request ID.", errors: [] });
    const data = await RegistrantIdEvidenceService.upload(requestId, req.user.id, req.files);
    return res.status(200).json({ success: true, message: "Registrant ID evidence uploaded securely.", data });
  } catch (error) {
    return next(error);
  }
};

export const downloadReceipt = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const requestId = parsePositiveId(req.params.id);
    const receiptId = parsePositiveId(req.params.receiptId);

    if (!requestId || !receiptId) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID or receipt ID.",
      });
    }

    // Enforce parishioner ownership before looking up or streaming receipt metadata.
    await requestService.getRequestById(requestId, userId);

    const receipt = await prisma.receiptUpload.findFirst({
      where: {
        id: receiptId,
        transaction: { requestId },
      },
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found.",
      });
    }

    let downloadStream;
    try {
      downloadStream = await new R2Service().download(receipt.r2ObjectKey);
    } catch (err) {
      if (isMissingR2ObjectError(err)) {
        return res.status(404).json({
          success: false,
          code: "RECEIPT_FILE_MISSING",
          message: "The receipt file is no longer available. Please upload a replacement or contact the parish office.",
        });
      }
      throw err;
    }

    res.setHeader("Content-Type", receipt.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="' + encodeURIComponent(receipt.fileName || 'receipt') + '"'
    );

    if (downloadStream.ContentLength) {
      res.setHeader("Content-Length", downloadStream.ContentLength);
    }

    downloadStream.Body.pipe(res);
  } catch (err) {
    return next(err);
  }
};

export const getRegistrantIdMetadata = async (req, res, next) => {
  try {
    const data = await RegistrantIdEvidenceService.getOwnedMetadata(parseInt(req.params.id, 10), req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const streamOwnedRegistrantIdSide = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const side = req.params.side;
    if (!["front", "back"].includes(side)) return res.status(400).json({ success: false, code: "INVALID_REGISTRANT_ID_SIDE", message: "Invalid registrant ID side." });
    const request = await prisma.documentRequest.findFirst({ where: { id: requestId, userId: req.user.id }, select: { id: true } });
    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
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

export const returnDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const requestId = parsePositiveId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ success: false, code: "INVALID_REQUEST_ID", message: "Invalid document request ID." });
    }
    const { reasonCode, notes } = req.body;
    const file = req.file;

    const result = await requestService.returnDocument({
      requestId,
      userId,
      reasonCode,
      notes,
      file,
    });

    return res.status(200).json({
      success: true,
      message: "Document return submitted successfully. The parish has been notified.",
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        ...(err.code ? { code: err.code } : {}),
        message: err.message,
      });
    }
    return next(err);
  }
};

export const getReturnHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const requestId = parsePositiveId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ success: false, code: "INVALID_REQUEST_ID", message: "Invalid document request ID." });
    }

    const history = await requestService.getReturnHistory(requestId, userId);

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        ...(err.code ? { code: err.code } : {}),
        message: err.message,
      });
    }
    return next(err);
  }
};

export const streamReturnFile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const requestId = parsePositiveId(req.params.id);
    const returnId = parsePositiveId(req.params.returnId);
    if (!requestId || !returnId) {
      return res.status(400).json({ success: false, code: "INVALID_RETURN_FILE_ID", message: "Invalid request ID or return cycle ID." });
    }
    const { type } = req.params;

    if (!["returned", "corrected"].includes(type)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_FILE_TYPE",
        message: "Invalid file type requested. Must be 'returned' or 'corrected'.",
      });
    }

    const { stream, fileName, mimeType, fileSize } = await requestService.getReturnFileStream(
      requestId,
      returnId,
      type,
      userId
    );

    const safeName = String(fileName || `${type}-document`).replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (stream.ContentLength || fileSize) {
      res.setHeader("Content-Length", stream.ContentLength || fileSize);
    }

    if (stream.Body && typeof stream.Body.pipe === "function") {
      stream.Body.pipe(res);
    } else if (typeof stream.pipe === "function") {
      stream.pipe(res);
    } else {
      res.send(stream);
    }
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        ...(err.code ? { code: err.code } : {}),
        message: err.message,
      });
    }
    return next(err);
  }
};

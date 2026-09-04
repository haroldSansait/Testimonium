import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { FileUploadService } from "../services/FileUploadService.js";
import { ReceiptVerificationService } from "../services/ReceiptVerificationService.js";

import { DocumentRequirementService } from "../services/DocumentRequirementService.js";

const requestService = new ParishionerRequestService();

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

    // Upload files to R2 and create DB records
    const uploads = [];
    for (const file of req.files) {
      const attachment = await FileUploadService.uploadAttachment(requestId, file, category);
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
      ocrStatus: "PENDING",
      message: "Payment proof uploaded. OCR processing is in progress.",
      data: {
        autoVerified: false,
        ocrPending: true,
        receiptId: verificationResult.receiptId,
        ocrStatus: "PENDING",
      },
    });
  } catch (err) {
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
        message: err.message,
      });
    }
    return next(err);
  }
};

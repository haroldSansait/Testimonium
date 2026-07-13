import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { FileUploadService } from "../services/FileUploadService.js";
import { ReceiptVerificationService } from "../services/ReceiptVerificationService.js";

const requestService = new ParishionerRequestService();

export const create = async (req, res, next) => {
  try {
    const userId = req.user.id; // derived from authenticated user token context
    const draft = await requestService.createDraft(userId, req.body);

    return res.status(201).json({
      success: true,
      message: "Request draft created successfully.",
      data: draft,
    });
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

    // Verify ownership of request first
    const request = await requestService.getRequestById(requestId, userId);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded.",
        errors: [],
      });
    }

    // Upload files to R2 and create DB records
    const uploads = [];
    for (const file of req.files) {
      const category = req.body.category || "supporting";
      const attachment = await FileUploadService.uploadAttachment(requestId, file, category);
      uploads.push(attachment);
    }

    return res.status(201).json({
      success: true,
      message: `${uploads.length} file(s) attached successfully.`,
      data: uploads,
    });
  } catch (err) {
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

    return res.status(200).json({
      success: true,
      message: verificationResult.autoVerified
        ? "Payment proof uploaded and auto-verified successfully."
        : "Payment proof uploaded and is under manual review.",
      data: {
        autoVerified: verificationResult.autoVerified,
        ocrResult: {
          confidenceScore: verificationResult.ocrResult.confidenceScore,
          referenceNumber: verificationResult.ocrResult.referenceNumber,
          amount: verificationResult.ocrResult.amount,
          provider: verificationResult.ocrResult.provider,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

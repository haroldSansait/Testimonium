import { ParishService } from "../services/ParishService.js";
import { validateParishAccess } from "../utils/tenantGuard.js";

const parishService = new ParishService();

export const list = async (req, res, next) => {
  try {
    const { search, type, status, page, limit } = req.query;
    const filters = {
      search,
      type,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
    };

    const data = await parishService.getParishes(filters);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await parishService.getParishById(id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const data = await parishService.createParish(req.body, req.user?.id);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await parishService.editParish(id, req.body, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const archive = async (req, res, next) => {
  try {
    const { id } = req.params;
    await parishService.archiveParish(id, req.user?.id);
    return res.status(200).json({ success: true, message: "Parish archived successfully." });
  } catch (err) {
    return next(err);
  }
};

export const restore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await parishService.restoreParish(id, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (
      req.user.role === "PRIEST" &&
      (req.body.eventSettings !== undefined || req.body.officeHours !== undefined)
    ) {
      const error = new Error("Priests cannot modify authoritative scheduling configuration.");
      error.statusCode = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    // Strict multi-tenant guard
    await validateParishAccess(req, id, "Parish Settings");

    const data = await parishService.editParish(id, req.body, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const uploadPaymentQr = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Strict multi-tenant guard
    await validateParishAccess(req, id, "Payment QR Code");

    const data = await parishService.uploadPaymentQr(id, req.file, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const deletePaymentQr = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Strict multi-tenant guard
    await validateParishAccess(req, id, "Payment QR Code");

    const data = await parishService.deletePaymentQr(id, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

import { ParishService } from "../services/ParishService.js";
import { ParishImageService } from "../services/ParishImageService.js";
import { validateParishAccess } from "../utils/tenantGuard.js";

const parishService = new ParishService();

/**
 * GET /parishes/map-config
 * Fetch lightweight parish list with map configuration details.
 */
export const getMapConfig = async (req, res, next) => {
  try {
    const data = await parishService.getParishMapConfig();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /parishes/map-config/batch
 * Batch update parish map settings (coordinates, zoom, color, label visibility).
 * Executed as a single database transaction. Returns 409 on optimistic lock mismatch.
 */
export const batchUpdateMap = async (req, res, next) => {
  try {
    const { updates } = req.body;
    const actorId = req.user?.id;
    
    const data = await parishService.batchUpdateMapCoordinates(updates, actorId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message,
        errors: [{ message: err.message }]
      });
    }
    return next(err);
  }
};

/**
 * PATCH /parishes/:id/directory-settings
 * Update basic directory settings (description, email, contact).
 */
export const updateSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id;
    
    await validateParishAccess(req, id, "Parish Map Directory Settings");

    const data = await parishService.updateDirectorySettings(id, req.body, actorId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /parishes/:id/images
 * Upload a cover or logo image for a parish.
 * Supports multipart uploads and type query param ('cover' or 'logo').
 */
export const uploadImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'cover' or 'logo'
    const actorId = req.user?.id;

    await validateParishAccess(req, id, "Parish Image Upload");

    if (!req.file) {
      const err = new Error("No file uploaded.");
      err.statusCode = 400;
      throw err;
    }

    if (type !== "cover" && type !== "logo") {
      const err = new Error("Invalid image type query parameter. Must be 'cover' or 'logo'.");
      err.statusCode = 400;
      throw err;
    }

    const publicUrl = await ParishImageService.uploadParishImage(id, req.file, type, actorId);
    return res.status(200).json({
      success: true,
      data: {
        url: `${publicUrl}?t=${Date.now()}`,
        type
      }
    });
  } catch (err) {
    return next(err);
  }
};

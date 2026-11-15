import multer from 'multer';
import { createScheduleSchema, submitScheduleDraftSchema } from '../validators/scheduleSchemas.js';

const parseUpload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: 5 * 1024 * 1024, files: 3, fields: 2, fieldSize: 16 * 1024,
} }).array('files', 3);

const parseDraftSingleUpload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: 5 * 1024 * 1024, files: 1, fields: 3, fieldSize: 4 * 1024,
} }).array('files', 1);

// This route alone accepts multipart; the existing Android JSON route is unchanged.
export const scheduleWebUpload = (req, res, next) => {
  parseUpload(req, res, (error) => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Each document must be 5 MB or smaller.' : 'Invalid scheduling upload. Maximum three documents.',
    });
    try {
      const body = JSON.parse(req.body?.booking || 'null');
      const result = createScheduleSchema.safeParse(body);
      if (!result.success) return res.status(400).json({ success: false, message: 'Invalid booking details.', errors: result.error.issues });
      req.scheduleRequirementIds = req.body?.requirementIds || '[]';
      req.body = result.data;
      return next();
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid booking data.' });
    }
  });
};

export const scheduleDraftAttachmentUpload = (req, res, next) => {
  parseDraftSingleUpload(req, res, (error) => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Each document must be 5 MB or smaller.' : 'Invalid scheduling document upload.',
    });
    const requirementId = (req.body?.requirementId || req.body?.category || '').trim();
    if (!requirementId) {
      return res.status(400).json({ success: false, message: 'A valid requirement ID is required.' });
    }
    const file = Array.isArray(req.files) ? req.files[0] : null;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No supporting document file uploaded.' });
    }
    req.draftRequirementId = requirementId;
    req.draftAttachmentFile = file;
    return next();
  });
};

export const scheduleDraftSubmitUpload = (req, res, next) => {
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    parseUpload(req, res, (error) => {
      if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Each document must be 5 MB or smaller.' : 'Invalid scheduling upload. Maximum three documents.',
      });
      try {
        const rawBooking = req.body?.booking ? JSON.parse(req.body.booking) : {};
        const result = submitScheduleDraftSchema.safeParse(rawBooking || {});
        if (!result.success) return res.status(400).json({ success: false, message: 'Invalid booking details.', errors: result.error.issues });
        req.scheduleRequirementIds = req.body?.requirementIds || '[]';
        req.body = result.data;
        return next();
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid booking data.' });
      }
    });
    return;
  }

  const result = submitScheduleDraftSchema.safeParse(req.body || {});
  if (!result.success) {
    return res.status(400).json({ success: false, message: 'Invalid booking details.', errors: result.error.issues });
  }
  req.body = result.data;
  return next();
};


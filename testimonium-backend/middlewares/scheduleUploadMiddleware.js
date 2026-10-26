import multer from 'multer';
import { createScheduleSchema } from '../validators/scheduleSchemas.js';

const parseUpload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: 5 * 1024 * 1024, files: 3, fields: 2, fieldSize: 16 * 1024,
} }).array('files', 3);

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

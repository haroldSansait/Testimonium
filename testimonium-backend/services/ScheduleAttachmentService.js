import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { FileValidator } from '../utils/fileValidator.js';
import { RegistrantIdStorageService } from './RegistrantIdStorageService.js';
import { R2Service, isMissingR2ObjectError } from './R2Service.js';

export const SCHEDULE_ATTACHMENT_SELECT = {
  id: true, requirementId: true, requirementLabel: true,
  fileName: true, fileType: true, fileSize: true, uploadedAt: true,
};

const invalid = (message, statusCode = 400) => Object.assign(new Error(message), {
  statusCode, code: 'INVALID_SCHEDULE_ATTACHMENTS',
});

export class ScheduleAttachmentService {
  static prepare(files = [], rawIds = '[]') {
    let ids;
    try { ids = JSON.parse(rawIds); } catch { throw invalid('Invalid requirement IDs.'); }
    if (!Array.isArray(ids) || ids.length !== files.length || files.length > 3 ||
        ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
      throw invalid('Provide one file for each required document.');
    }
    return files.map((file, index) => {
      const { signature, normalizedMime } = FileValidator.validateSupportingDocument(file);
      const extension = path.extname(file.originalname).toLowerCase();
      const types = { '.pdf': ['pdf', 'application/pdf'], '.jpg': ['jpeg', 'image/jpeg'],
        '.jpeg': ['jpeg', 'image/jpeg'], '.png': ['png', 'image/png'], '.webp': ['webp', 'image/webp'] };
      if (!types[extension] || types[extension][0] !== signature || types[extension][1] !== normalizedMime) {
        throw invalid('Only PDF, JPG, PNG, and WebP documents are allowed.', 415);
      }
      file.mimetype = normalizedMime;
      return {
        requirementId: ids[index], fileName: path.basename(file.originalname).slice(0, 255),
        fileType: normalizedMime, fileSize: file.size,
        contentHash: createHash('sha256').update(file.buffer).digest('hex'), file,
      };
    }).sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  }

  static async stage(attachments, userId, parishId) {
    if (!attachments.length) return;
    const bucketName = await RegistrantIdStorageService.assertAvailable();
    for (const attachment of attachments) {
      const objectKey = `schedule-requirements/${parishId}/${userId}/${randomUUID()}`;
      // Persist recovery intent BEFORE PutObject, including a possibly ambiguous upload failure.
      await prisma.privateObjectCleanupJob.create({ data: {
        objectKey, reasonCode: 'SCHEDULE_ATTACHMENT_PENDING',
        nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000),
      } });
      attachment.r2ObjectKey = objectKey;
      await new R2Service().upload({ key: objectKey, body: attachment.file.buffer,
        contentType: attachment.fileType, bucketName, abortSignal: AbortSignal.timeout(120_000) });
    }
  }

  static async list(scheduleId, actor) {
    const id = Number(scheduleId);
    if (!Number.isSafeInteger(id) || id <= 0) throw invalid('Invalid schedule ID.');
    const schedule = await prisma.schedule.findUnique({ where: { id },
      select: { userId: true, parishId: true } });
    const parishId = actor.parish?.id || actor.parishId;
    const allowed = schedule && (
      (actor.role === 'PARISHIONER' && Number(actor.id) === schedule.userId) ||
      actor.role === 'DIOCESE_COORDINATOR' ||
      (['SECRETARY', 'PRIEST'].includes(actor.role) && parishId && Number(parishId) === schedule.parishId)
    );
    if (!allowed) throw Object.assign(new Error('Schedule attachments not found.'), { statusCode: 404 });
    return prisma.scheduleAttachment.findMany({ where: { scheduleId: id },
      select: SCHEDULE_ATTACHMENT_SELECT, orderBy: { id: 'asc' } });
  }

  static async download(scheduleId, attachmentId, actor) {
    const attachments = await this.list(scheduleId, actor);
    const metadata = attachments.find((attachment) => attachment.id === Number(attachmentId));
    if (!metadata) throw Object.assign(new Error('Attachment not found.'), { statusCode: 404 });
    const record = await prisma.scheduleAttachment.findUnique({ where: { id: metadata.id }, select: { r2ObjectKey: true } });
    let stream;
    try {
      stream = await new R2Service().download(record.r2ObjectKey, { bucketName: RegistrantIdStorageService.bucketName() });
    } catch (error) {
      if (isMissingR2ObjectError(error)) throw Object.assign(new Error('Attachment file not found.'), { statusCode: 404 });
      throw error;
    }
    return { metadata, stream };
  }
}

import crypto from "node:crypto";
import { prisma } from "../config/db.js";
import { isSelfRelationship } from "../config/relationshipEvidence.js";
import { RegistrantIdStorageService } from "./RegistrantIdStorageService.js";

const SIDE_CONFIG = Object.freeze({
  front: { key: "frontObjectKey", mime: "frontMimeType", size: "frontSize", hash: "frontSha256", uploaded: "frontUploadedAt", revision: "frontRevision" },
  back: { key: "backObjectKey", mime: "backMimeType", size: "backSize", hash: "backSha256", uploaded: "backUploadedAt", revision: "backRevision" },
});

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

function conflict(message = "Registrant ID evidence changed while this upload was in progress. Refresh and try again.") {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = "REGISTRANT_ID_UPLOAD_CONFLICT";
  return error;
}

function publicMetadata(evidence) {
  if (!evidence) return null;
  return {
    version: evidence.version,
    front: evidence.frontObjectKey ? { uploaded: true, uploadedAt: evidence.frontUploadedAt, mimeType: evidence.frontMimeType, size: evidence.frontSize, revision: evidence.frontRevision } : { uploaded: false, revision: evidence.frontRevision },
    back: evidence.backObjectKey ? { uploaded: true, uploadedAt: evidence.backUploadedAt, mimeType: evidence.backMimeType, size: evidence.backSize, revision: evidence.backRevision } : { uploaded: false, revision: evidence.backRevision },
    ocrStatus: evidence.ocrStatus,
  };
}

export class RegistrantIdEvidenceService {
  static toParishionerMetadata = publicMetadata;

  static async getOwnedMetadata(requestId, userId) {
    const request = await prisma.documentRequest.findFirst({ where: { id: Number(requestId), userId: Number(userId) }, select: { id: true, relationship: true } });
    if (!request) {
      const error = new Error("Request not found or does not belong to this user.");
      error.statusCode = 404;
      throw error;
    }
    if (isSelfRelationship(request.relationship)) return null;
    return publicMetadata(await prisma.registrantIdEvidence.findUnique({ where: { requestId: request.id } }));
  }

  static async upload(requestId, userId, files) {
    const numericRequestId = Number(requestId);
    const supplied = Object.entries({ front: files?.front?.[0], back: files?.back?.[0] }).filter(([, file]) => Boolean(file));
    if (!supplied.length) {
      const error = new Error("Upload a front or back registrant ID image.");
      error.statusCode = 400;
      error.code = "REGISTRANT_ID_REQUIRED";
      throw error;
    }

    const request = await prisma.documentRequest.findFirst({
      where: { id: numericRequestId, userId: Number(userId) },
      select: { id: true, isDraft: true, status: true, relationship: true, correctionRequirementIds: true },
    });
    if (!request) {
      const error = new Error("Request not found or does not belong to this user.");
      error.statusCode = 404;
      throw error;
    }
    this.assertMutationAllowed(request, supplied.map(([side]) => side));

    const baseline = await prisma.registrantIdEvidence.findUnique({ where: { requestId: numericRequestId } });
    const prepared = supplied.map(([side, file]) => ({
      side,
      file,
      hash: sha256(file.buffer),
      key: RegistrantIdStorageService.createObjectKey(numericRequestId, side),
      expectedRevision: baseline?.[SIDE_CONFIG[side].revision] || 0,
    }));
    const frontHash = prepared.find((item) => item.side === "front")?.hash || baseline?.frontSha256;
    const backHash = prepared.find((item) => item.side === "back")?.hash || baseline?.backSha256;
    if (frontHash && backHash && frontHash === backHash) {
      const error = new Error("Front and back registrant ID images must be different.");
      error.statusCode = 400;
      error.code = "DUPLICATE_ID_IMAGE";
      throw error;
    }

    const orphanGrace = new Date(Date.now() + 15 * 60_000);
    for (const item of prepared) {
      await prisma.privateObjectCleanupJob.create({ data: { objectKey: item.key, reasonCode: "UNCOMMITTED_UPLOAD", nextAttemptAt: orphanGrace } });
      await RegistrantIdStorageService.upload(item.key, item.file);
    }

    return prisma.$transaction(async (tx) => {
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`SELECT "request_id" FROM "document_requests" WHERE "request_id" = ${numericRequestId} FOR UPDATE`;
      }
      const lockedRequest = await tx.documentRequest.findFirst({ where: { id: numericRequestId, userId: Number(userId) } });
      if (!lockedRequest) throw conflict();
      this.assertMutationAllowed(lockedRequest, prepared.map((item) => item.side));

      const current = await tx.registrantIdEvidence.findUnique({ where: { requestId: numericRequestId } });
      for (const item of prepared) {
        if ((current?.[SIDE_CONFIG[item.side].revision] || 0) !== item.expectedRevision) throw conflict();
      }
      const resultingFrontHash = prepared.find((item) => item.side === "front")?.hash || current?.frontSha256;
      const resultingBackHash = prepared.find((item) => item.side === "back")?.hash || current?.backSha256;
      if (resultingFrontHash && resultingBackHash && resultingFrontHash === resultingBackHash) {
        const error = new Error("Front and back registrant ID images must be different.");
        error.statusCode = 400;
        error.code = "DUPLICATE_ID_IMAGE";
        throw error;
      }

      const data = {};
      const oldKeys = [];
      for (const item of prepared) {
        const fields = SIDE_CONFIG[item.side];
        if (current?.[fields.key]) oldKeys.push(current[fields.key]);
        data[fields.key] = item.key;
        data[fields.mime] = item.file.mimetype;
        data[fields.size] = item.file.size;
        data[fields.hash] = item.hash;
        data[fields.uploaded] = new Date();
        data[fields.revision] = { increment: 1 };
      }
      const willHaveBoth = Boolean((data.frontObjectKey || current?.frontObjectKey) && (data.backObjectKey || current?.backObjectKey));
      Object.assign(data, {
        version: { increment: 1 },
        ocrStatus: willHaveBoth ? "PENDING" : "AWAITING_IMAGES",
        ocrAttemptCount: 0,
        ocrNextAttemptAt: willHaveBoth ? new Date() : null,
        ocrProcessingToken: null,
        ocrProcessingAt: null,
        ocrLeaseExpiresAt: null,
        ocrClaimedVersion: null,
        ocrClaimedFrontKey: null,
        ocrClaimedBackKey: null,
        ocrProcessedVersion: null,
        ocrProvider: null,
        ocrErrorCode: null,
        extractedName: null,
        detectedIdType: null,
        idNumber: null,
        dateOfBirth: null,
        expiryDate: null,
        frontText: null,
        backText: null,
        advisoryFlags: [],
        processedAt: null,
      });

      let evidence;
      if (current) {
        evidence = await tx.registrantIdEvidence.update({ where: { requestId: numericRequestId }, data });
      } else {
        const createData = { ...data, requestId: numericRequestId, version: 1 };
        if (data.frontRevision) createData.frontRevision = 1;
        if (data.backRevision) createData.backRevision = 1;
        evidence = await tx.registrantIdEvidence.create({ data: createData });
      }

      await tx.privateObjectCleanupJob.updateMany({ where: { objectKey: { in: prepared.map((item) => item.key) } }, data: { status: "CANCELLED", completedAt: new Date() } });
      for (const oldKey of oldKeys) {
        await tx.privateObjectCleanupJob.upsert({
          where: { objectKey: oldKey },
          create: { objectKey: oldKey, reasonCode: "SUPERSEDED_OBJECT" },
          update: { status: "PENDING", reasonCode: "SUPERSEDED_OBJECT", nextAttemptAt: new Date(), processingToken: null, processingAt: null, leaseExpiresAt: null, completedAt: null },
        });
      }
      return publicMetadata(evidence);
    }, { maxWait: 10000, timeout: 20000 });
  }

  static assertMutationAllowed(request, sides) {
    if (isSelfRelationship(request.relationship)) {
      const error = new Error("Self requests cannot upload registrant ID evidence.");
      error.statusCode = 400;
      error.code = "INVALID_ATTACHMENT_CATEGORY";
      throw error;
    }
    if (request.isDraft) return;
    if (request.status !== "NEEDS_CORRECTION") throw conflict("Registrant ID evidence is immutable after submission unless replacement was requested.");
    const allowed = new Set(request.correctionRequirementIds || []);
    if (sides.some((side) => !allowed.has(`registrant_id_${side}`))) {
      const error = new Error("This registrant ID side was not requested for correction.");
      error.statusCode = 400;
      error.code = "INVALID_ATTACHMENT_CATEGORY";
      throw error;
    }
  }
}

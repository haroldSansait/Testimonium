import crypto from "crypto";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  GOVERNMENT_ID_STATUS,
  GOVERNMENT_ID_REJECTION_REASONS,
  getRejectionMessage,
} from "../config/governmentIdVerification.js";
import {
  validateIdImage,
  areFrontAndBackDistinct,
  normalizeForR2Storage,
} from "../utils/governmentIdImageValidator.js";
import {
  classifyGovernmentIdSide,
  getGovernmentIdSideIssue,
  identifyGovernmentIdType,
  identifyGovernmentIdTypeFromSubmission,
  GOVERNMENT_ID_SIDE_ISSUES,
  extractExpiryDate,
} from "../utils/governmentIdOcrParser.js";
import { matchProfileNameToIdText } from "../utils/governmentIdNameMatcher.js";
import { isEffectivelyVerified } from "../utils/governmentIdVerificationHelper.js";
import { ImageCompressionService } from "./ImageCompressionService.js";
import { OcrProviderFactory } from "./ocr/OcrProviderFactory.js";
import { R2Service } from "./R2Service.js";
import { defaultSystemLeaseService } from "./SystemLeaseService.js";

export class GovernmentIdVerificationService {
  constructor({
    prismaClient = prisma,
    r2Service = new R2Service(),
    leaseService = defaultSystemLeaseService,
    ocrProvider = null,
    identityBucketName = env.r2.identityBucketName,
  } = {}) {
    this.prisma = prismaClient;
    this.r2Service = r2Service;
    this.leaseService = leaseService;
    this._injectedOcrProvider = ocrProvider;
    this.identityBucketName = identityBucketName;
  }

  _identityBucketOptions() {
    if (!this.identityBucketName || this.identityBucketName === env.r2.bucketName) {
      const error = new Error("Private Government ID storage is not configured.");
      error.statusCode = 503;
      error.code = "IDENTITY_STORAGE_UNAVAILABLE";
      throw error;
    }
    return { bucketName: this.identityBucketName };
  }

  getOcrProvider() {
    if (this._injectedOcrProvider) {
      return this._injectedOcrProvider;
    }
    return OcrProviderFactory.create();
  }

  async _canReuseExistingVerification(userId, verification) {
    if (!isEffectivelyVerified(verification)) {
      return false;
    }

    const frontObjectKey = verification.frontObjectKey;
    const backObjectKey = verification.backObjectKey;
    if (!frontObjectKey || !backObjectKey) {
      logger.warn(
        {
          userId,
          frontObjectKeyPresent: Boolean(frontObjectKey),
          backObjectKeyPresent: Boolean(backObjectKey),
        },
        '[GovernmentIdVerification] Verified record has incomplete private ID object references. Running fresh verification.'
      );
      return false;
    }

    let frontObjectExists;
    let backObjectExists;
    try {
      const identityBucket = this._identityBucketOptions();
      [frontObjectExists, backObjectExists] = await Promise.all([
        this.r2Service.exists(frontObjectKey, identityBucket),
        this.r2Service.exists(backObjectKey, identityBucket),
      ]);
    } catch (storageCheckError) {
      logger.error(
        { err: storageCheckError, userId },
        '[GovernmentIdVerification] Failed to confirm existing private ID objects'
      );
      const storageError = new Error('Government ID storage is temporarily unavailable.');
      storageError.statusCode = 503;
      storageError.code = 'IDENTITY_STORAGE_UNAVAILABLE';
      throw storageError;
    }

    if (!frontObjectExists || !backObjectExists) {
      logger.warn(
        { userId, frontObjectPresent: frontObjectExists, backObjectPresent: backObjectExists },
        '[GovernmentIdVerification] Verified record has stale private ID object references. Running fresh verification.'
      );
      return false;
    }

    return true;
  }

  async withUserVerificationLease(userId, operation) {
    const ownerToken = crypto.randomUUID();
    const leaseKey = `GOVERNMENT_ID_VERIFICATION:${userId}`;
    const acquired = await this.leaseService.acquireLease(leaseKey, ownerToken, 120);
    if (!acquired) {
      const conflictErr = new Error("Government ID verification is currently in progress for this account.");
      conflictErr.statusCode = 409;
      conflictErr.code = "GOVERNMENT_ID_VERIFICATION_IN_PROGRESS";
      throw conflictErr;
    }

    try {
      return await operation();
    } finally {
      try {
        await this.leaseService.releaseLease(leaseKey, ownerToken);
      } catch (leaseReleaseErr) {
        logger.warn({ err: leaseReleaseErr, userId }, "[GovernmentIdVerification] Failed to release profile-update lease");
      }
    }
  }

  /**
   * Authoritative submission method for Government ID verification.
   * Synchronously validates front and back images, executes OCR concurrently,
   * performs multi-marker ID matching, name matching, and expiry checks.
   *
   * @param {number} userId - The authenticated user ID
   * @param {Buffer} frontBuffer - Raw front image buffer
   * @param {Buffer} backBuffer - Raw back image buffer
   * @returns {Promise<object>} Verification result
   */
  async submitForVerification(userId, frontBuffer, backBuffer) {
    const ownerToken = crypto.randomUUID();
    const leaseKey = `GOVERNMENT_ID_VERIFICATION:${userId}`;

    // 1. Concurrency control via SystemLeaseService
    const acquired = await this.leaseService.acquireLease(leaseKey, ownerToken, 120);
    if (!acquired) {
      const conflictErr = new Error("An ID verification submission is already in progress for this account.");
      conflictErr.statusCode = 409;
      conflictErr.code = "GOVERNMENT_ID_VERIFICATION_IN_PROGRESS";
      throw conflictErr;
    }

    try {
      // 2. Fetch authenticated user record
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { governmentIdVerification: true },
      });

      if (!user) {
        const notFoundErr = new Error("User not found.");
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      // 3. Double-tap / Already-verified idempotency protection
      // If the user already has an effective verified ID, return it immediately
      if (await this._canReuseExistingVerification(userId, user.governmentIdVerification)) {
        logger.info({ userId }, "[GovernmentIdVerification] User already effectively verified. Returning current status.");
        return {
          status: GOVERNMENT_ID_STATUS.VERIFIED,
          isGovernmentIdVerified: true,
          idType: user.governmentIdVerification.idType,
          verifiedAt: user.governmentIdVerification.verifiedAt,
          expiresAt: user.governmentIdVerification.expiresAt,
          message: "Government ID is already verified.",
        };
      }

      // 4. File existence and completeness checks
      if (!frontBuffer || !backBuffer) {
        await this._persistRejection(userId, GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE);
        return {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          isGovernmentIdVerified: false,
          rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE,
          message: getRejectionMessage(GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE),
        };
      }

      // 5. Duplicate image protection (SHA-256)
      if (!areFrontAndBackDistinct(frontBuffer, backBuffer)) {
        await this._persistRejection(userId, GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE);
        return {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          isGovernmentIdVerified: false,
          rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE,
          message: "Front and back images cannot be identical. Please upload both sides of your card.",
        };
      }

      // 6. Image quality and sharpness validation
      const sharpnessThreshold = env.identity?.sharpnessThreshold ?? 15;
      const frontValidation = await validateIdImage(frontBuffer, { sharpnessThreshold });
      if (!frontValidation.valid) {
        await this._persistRejection(userId, frontValidation.rejectionReason);
        return {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          isGovernmentIdVerified: false,
          rejectionReason: frontValidation.rejectionReason,
          message: frontValidation.error || getRejectionMessage(frontValidation.rejectionReason),
        };
      }

      const backValidation = await validateIdImage(backBuffer, { sharpnessThreshold });
      if (!backValidation.valid) {
        await this._persistRejection(userId, backValidation.rejectionReason);
        return {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          isGovernmentIdVerified: false,
          rejectionReason: backValidation.rejectionReason,
          message: backValidation.error || getRejectionMessage(backValidation.rejectionReason),
        };
      }

      // 7. Check OCR provider health / readiness
      const ocrProvider = this.getOcrProvider();
      if (!env.ocr.enabled) {
        const error = new Error("OCR verification service is temporarily disabled.");
        error.statusCode = 503;
        error.code = "OCR_SERVICE_UNAVAILABLE";
        throw error;
      }

      if (ocrProvider.providerName === "stub") {
        const error = new Error("Real OCR verification provider is not configured. Stub cannot verify Government IDs.");
        error.statusCode = 503;
        error.code = "OCR_PROVIDER_UNAVAILABLE";
        throw error;
      }

      // 8. Compress images for OCR API submission
      const [frontCompressed, backCompressed] = await Promise.all([
        ImageCompressionService.compress(frontBuffer, frontValidation.mimeType),
        ImageCompressionService.compress(backBuffer, backValidation.mimeType),
      ]);

      // 9. Execute Front and Back OCR concurrently
      let frontOcrResult;
      let backOcrResult;

      try {
        [frontOcrResult, backOcrResult] = await Promise.all([
          ocrProvider.extractText(frontCompressed.compressedBuffer, "image/jpeg"),
          ocrProvider.extractText(backCompressed.compressedBuffer, "image/jpeg"),
        ]);
      } catch (ocrNetworkErr) {
        logger.error({ err: ocrNetworkErr, userId }, "[GovernmentIdVerification] OCR upstream infrastructure failure");
        const serviceErr = new Error("Temporary failure contacting OCR service. Please try again.");
        serviceErr.statusCode = 503;
        serviceErr.code = "OCR_UPSTREAM_ERROR";
        throw serviceErr;
      }

      // Handle infrastructure failure in OCR response
      if (
        frontOcrResult.failureType === "INFRASTRUCTURE" ||
        backOcrResult.failureType === "INFRASTRUCTURE" ||
        (frontOcrResult.httpStatusCode && frontOcrResult.httpStatusCode >= 500) ||
        (backOcrResult.httpStatusCode && backOcrResult.httpStatusCode >= 500) ||
        frontOcrResult.httpStatusCode === 408 ||
        backOcrResult.httpStatusCode === 408 ||
        (frontOcrResult.failureReason && frontOcrResult.failureReason.includes("timed out")) ||
        (backOcrResult.failureReason && backOcrResult.failureReason.includes("timed out"))
      ) {
        const upstreamErr = new Error("OCR provider is temporarily unavailable or timed out. Please retry.");
        upstreamErr.statusCode = 503;
        upstreamErr.code = "OCR_TIMEOUT_OR_UNAVAILABLE";
        throw upstreamErr;
      }

      const frontText = (frontOcrResult.rawText || "").trim();
      const backText = (backOcrResult.rawText || "").trim();

      // Meaningful text threshold: front >= 15 chars, back >= 10 chars
      if (!frontOcrResult.ocrSuccess || frontText.length < 15 || !backOcrResult.ocrSuccess || backText.length < 10) {
        await this._persistRejection(userId, GOVERNMENT_ID_REJECTION_REASONS.IMAGE_BLURRY);
        return {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          isGovernmentIdVerified: false,
          rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.IMAGE_BLURRY,
          message: getRejectionMessage(GOVERNMENT_ID_REJECTION_REASONS.IMAGE_BLURRY),
        };
      }

      // 10. Multi-marker ID Type Identification
      const identifiedIdConfig =
        identifyGovernmentIdType(frontText, backText) ||
        identifyGovernmentIdTypeFromSubmission(frontText, backText);
      if (!identifiedIdConfig) {
        await this._persistRejection(userId, GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT);
        return {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          isGovernmentIdVerified: false,
          rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT,
          message: getRejectionMessage(GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT),
        };
      }

      // 11. Independently classify both submitted sides from the OCR text already obtained.
      // Ambiguous evidence continues; only strong contradictory evidence is rejected.
      const frontSideClassification = classifyGovernmentIdSide({
        idType: identifiedIdConfig.idType,
        text: frontText,
      });
      const backSideClassification = classifyGovernmentIdSide({
        idType: identifiedIdConfig.idType,
        text: backText,
      });
      const sideIssue = getGovernmentIdSideIssue(
        frontSideClassification,
        backSideClassification
      );
      if (sideIssue) {
        await this._persistRejection(
          userId,
          GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE
        );
        const failedSide =
          sideIssue === GOVERNMENT_ID_SIDE_ISSUES.BACK_IS_FRONT ||
          sideIssue === GOVERNMENT_ID_SIDE_ISSUES.BOTH_APPEAR_FRONT
            ? "back"
            : sideIssue === GOVERNMENT_ID_SIDE_ISSUES.FRONT_IS_BACK ||
                sideIssue === GOVERNMENT_ID_SIDE_ISSUES.BOTH_APPEAR_BACK
              ? "front"
              : "both";
        return {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          isGovernmentIdVerified: false,
          rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE,
          sideIssue,
          failedSide,
          message: getRejectionMessage(GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE),
        };
      }

      // 12. Deterministic Name Matching
      const fullOcrText = `${frontText}\n${backText}`;
      const nameMatchResult = matchProfileNameToIdText(user.fullName, fullOcrText);
      if (!nameMatchResult.matches) {
        await this._persistRejection(userId, GOVERNMENT_ID_REJECTION_REASONS.NAME_MISMATCH);
        return {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          isGovernmentIdVerified: false,
          rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.NAME_MISMATCH,
          message: getRejectionMessage(GOVERNMENT_ID_REJECTION_REASONS.NAME_MISMATCH),
        };
      }

      // 13. Expiry Validation
      let expiresAt = null;
      if (identifiedIdConfig.hasExpiry) {
        const expiryResult = extractExpiryDate(fullOcrText);
        if (!expiryResult.found) {
          await this._persistRejection(userId, GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT);
          return {
            status: GOVERNMENT_ID_STATUS.REJECTED,
            isGovernmentIdVerified: false,
            rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT,
            message: "Could not clearly read the expiration date on your ID. Please ensure the expiration date is visible.",
          };
        }

        if (expiryResult.isExpired) {
          await this._persistRejection(userId, GOVERNMENT_ID_REJECTION_REASONS.ID_EXPIRED);
          return {
            status: GOVERNMENT_ID_STATUS.REJECTED,
            isGovernmentIdVerified: false,
            rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.ID_EXPIRED,
            message: getRejectionMessage(GOVERNMENT_ID_REJECTION_REASONS.ID_EXPIRED),
          };
        }

        expiresAt = expiryResult.expiresAt;
      }

      // 14. Verification Accepted — Normalize for R2 storage
      const [normalizedFront, normalizedBack] = await Promise.all([
        normalizeForR2Storage(frontBuffer),
        normalizeForR2Storage(backBuffer),
      ]);

      const frontKey = `identity/user_${userId}/front/${crypto.randomUUID()}.jpg`;
      const backKey = `identity/user_${userId}/back/${crypto.randomUUID()}.jpg`;
      const identityBucket = this._identityBucketOptions();

      // Upload front to private R2
      try {
        await this.r2Service.upload({
          key: frontKey,
          body: normalizedFront,
          contentType: "image/jpeg",
          ...identityBucket,
        });
      } catch (uploadFrontErr) {
        logger.error({ err: uploadFrontErr, userId }, "[GovernmentIdVerification] Failed to upload front ID to R2");
        const r2Err = new Error("Failed to store ID document. Please retry.");
        r2Err.statusCode = 503;
        r2Err.code = "STORAGE_ERROR";
        throw r2Err;
      }

      // Upload back to private R2 (rollback front if this fails)
      try {
        await this.r2Service.upload({
          key: backKey,
          body: normalizedBack,
          contentType: "image/jpeg",
          ...identityBucket,
        });
      } catch (uploadBackErr) {
        logger.error({ err: uploadBackErr, userId }, "[GovernmentIdVerification] Failed to upload back ID to R2, cleaning front");
        try {
          await this.r2Service.delete(frontKey, identityBucket);
        } catch (cleanupFrontErr) {
          logger.warn({ err: cleanupFrontErr }, "[GovernmentIdVerification] Failed to cleanup front key on back failure");
        }
        const r2Err = new Error("Failed to store ID document. Please retry.");
        r2Err.statusCode = 503;
        r2Err.code = "STORAGE_ERROR";
        throw r2Err;
      }

      // 15. Persist VERIFIED state atomically in PostgreSQL
      const oldVerification = user.governmentIdVerification;
      const verifiedAt = new Date();

      try {
        await this.prisma.governmentIdVerification.upsert({
          where: { userId },
          create: {
            userId,
            status: GOVERNMENT_ID_STATUS.VERIFIED,
            frontObjectKey: frontKey,
            backObjectKey: backKey,
            idType: identifiedIdConfig.idType,
            verifiedAt,
            expiresAt,
            rejectionReason: null,
            lastAttemptAt: verifiedAt,
          },
          update: {
            status: GOVERNMENT_ID_STATUS.VERIFIED,
            frontObjectKey: frontKey,
            backObjectKey: backKey,
            idType: identifiedIdConfig.idType,
            verifiedAt,
            expiresAt,
            rejectionReason: null,
            lastAttemptAt: verifiedAt,
          },
        });
      } catch (dbErr) {
        logger.error({ err: dbErr, userId }, "[GovernmentIdVerification] DB update failed. Rolling back both R2 objects.");
        // Rollback both R2 objects to prevent orphaned private files
        await Promise.allSettled([
          this.r2Service.delete(frontKey, identityBucket),
          this.r2Service.delete(backKey, identityBucket),
        ]);
        throw dbErr;
      }

      // 16. Best-effort cleanup of previous R2 objects if replacing an expired/invalidated verification
      if (oldVerification) {
        if (oldVerification.frontObjectKey && oldVerification.frontObjectKey !== frontKey) {
          this.r2Service.delete(oldVerification.frontObjectKey, identityBucket).catch((delErr) => {
            logger.warn({ err: delErr }, "[GovernmentIdVerification] Non-fatal: old front object deletion failed");
          });
        }
        if (oldVerification.backObjectKey && oldVerification.backObjectKey !== backKey) {
          this.r2Service.delete(oldVerification.backObjectKey, identityBucket).catch((delErr) => {
            logger.warn({ err: delErr }, "[GovernmentIdVerification] Non-fatal: old back object deletion failed");
          });
        }
      }

      logger.info(
        { userId, idType: identifiedIdConfig.idType, expiresAt },
        "[GovernmentIdVerification] Successfully verified user Government ID"
      );

      return {
        status: GOVERNMENT_ID_STATUS.VERIFIED,
        isGovernmentIdVerified: true,
        idType: identifiedIdConfig.idType,
        verifiedAt,
        expiresAt,
        message: "Government ID verified successfully.",
      };
    } finally {
      // 17. Always release the per-user lease in finally
      try {
        await this.leaseService.releaseLease(leaseKey, ownerToken);
      } catch (leaseReleaseErr) {
        logger.warn({ err: leaseReleaseErr, userId }, "[GovernmentIdVerification] Failed to release lease in finally");
      }
    }
  }

  /**
   * Helper to persist a business rejection in DB.
   * @private
   */
  async _persistRejection(userId, canonicalReason) {
    try {
      const now = new Date();
      const previous = await this.prisma.governmentIdVerification.findUnique({
        where: { userId },
      });
      await this.prisma.governmentIdVerification.upsert({
        where: { userId },
        create: {
          userId,
          status: GOVERNMENT_ID_STATUS.REJECTED,
          rejectionReason: canonicalReason,
          lastAttemptAt: now,
        },
        update: {
          status: GOVERNMENT_ID_STATUS.REJECTED,
          frontObjectKey: null,
          backObjectKey: null,
          idType: null,
          verifiedAt: null,
          expiresAt: null,
          rejectionReason: canonicalReason,
          lastAttemptAt: now,
        },
      });
      const oldKeys = [previous?.frontObjectKey, previous?.backObjectKey].filter(Boolean);
      if (oldKeys.length > 0) {
        const identityBucket = this._identityBucketOptions();
        await Promise.allSettled(
          oldKeys.map((key) => this.r2Service.delete(key, identityBucket))
        );
      }
      logger.info({ userId, rejectionReason: canonicalReason }, "[GovernmentIdVerification] Persisted rejection");
    } catch (err) {
      logger.error({ err, userId }, "[GovernmentIdVerification] Failed to persist rejection state");
      const persistenceError = new Error("Could not persist Government ID verification result. Please retry.");
      persistenceError.statusCode = 503;
      persistenceError.code = "IDENTITY_PERSISTENCE_ERROR";
      throw persistenceError;
    }
  }

  /**
   * Invalidation handler when a user changes their profile name.
   * Clears verified state and deletes R2 objects best-effort.
   *
   * @param {number} userId
   */
  async invalidateVerification(userId) {
    const verification = await this.prisma.governmentIdVerification.findUnique({
      where: { userId },
    });

    if (!verification || verification.status !== GOVERNMENT_ID_STATUS.VERIFIED) {
      return;
    }

    const { frontObjectKey, backObjectKey } = verification;

    // Reset database record to NOT_SUBMITTED with cleared keys
    await this.prisma.governmentIdVerification.update({
      where: { userId },
      data: {
        status: GOVERNMENT_ID_STATUS.NOT_SUBMITTED,
        frontObjectKey: null,
        backObjectKey: null,
        idType: null,
        verifiedAt: null,
        expiresAt: null,
        rejectionReason: null,
        lastAttemptAt: new Date(),
      },
    });

    // Best-effort cleanup of R2 objects
    if (frontObjectKey) {
      this.r2Service.delete(frontObjectKey, this._identityBucketOptions()).catch((err) => {
        logger.warn({ err, userId }, "[GovernmentIdVerification] Non-fatal: failed to delete front key on invalidation");
      });
    }
    if (backObjectKey) {
      this.r2Service.delete(backObjectKey, this._identityBucketOptions()).catch((err) => {
        logger.warn({ err, userId }, "[GovernmentIdVerification] Non-fatal: failed to delete back key on invalidation");
      });
    }

    logger.info({ userId }, "[GovernmentIdVerification] Invalidated Government ID verification due to profile name change");
  }

  /**
   * Returns verification status for a user.
   * @param {number} userId
   * @returns {Promise<object>}
   */
  async getStatus(userId) {
    const record = await this.prisma.governmentIdVerification.findUnique({
      where: { userId },
    });

    if (!record) {
      return {
        status: GOVERNMENT_ID_STATUS.NOT_SUBMITTED,
        isGovernmentIdVerified: false,
        rejectionReason: null,
        verifiedAt: null,
        expiresAt: null,
        idType: null,
      };
    }

    const isEffective = isEffectivelyVerified(record);

    return {
      status: record.status,
      isGovernmentIdVerified: isEffective,
      rejectionReason: record.rejectionReason,
      rejectionMessage: record.rejectionReason ? getRejectionMessage(record.rejectionReason) : null,
      verifiedAt: record.verifiedAt,
      expiresAt: record.expiresAt,
      idType: record.idType,
      lastAttemptAt: record.lastAttemptAt,
    };
  }

  /**
   * Streams verified front or back ID image for Diocese Coordinator inspection.
   *
   * @param {number} userId
   * @param {"front"|"back"} side
   * @param {import("express").Response} res
   */
  async streamIdImage(userId, side, res) {
    const record = await this.prisma.governmentIdVerification.findUnique({
      where: { userId },
    });

    if (!isEffectivelyVerified(record)) {
      const err = new Error("No verified Government ID found for this user.");
      err.statusCode = 404;
      throw err;
    }

    const key = side === "front" ? record.frontObjectKey : record.backObjectKey;
    if (!key) {
      const err = new Error(`No ${side} image found for this verification.`);
      err.statusCode = 404;
      throw err;
    }

    let r2Response;
    try {
      r2Response = await this.r2Service.download(key, this._identityBucketOptions());
    } catch (storageError) {
      const storageStatus = storageError?.$metadata?.httpStatusCode;
      if (
        storageStatus === 404 ||
        storageError?.name === 'NotFound' ||
        storageError?.name === 'NoSuchKey'
      ) {
        const missingImageError = new Error('The requested Government ID image is unavailable.');
        missingImageError.statusCode = 404;
        missingImageError.code = 'IDENTITY_IMAGE_NOT_FOUND';
        throw missingImageError;
      }

      const unavailableError = new Error('Government ID image storage is temporarily unavailable.');
      unavailableError.statusCode = 503;
      unavailableError.code = 'IDENTITY_STORAGE_UNAVAILABLE';
      throw unavailableError;
    }

    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    });

    if (r2Response.Body && typeof r2Response.Body.pipe === "function") {
      r2Response.Body.pipe(res);
    } else if (r2Response.Body) {
      // Body may be a Uint8Array or stream in some runtimes
      const chunks = [];
      for await (const chunk of r2Response.Body) {
        chunks.push(chunk);
      }
      res.send(Buffer.concat(chunks));
    } else {
      const err = new Error("Empty image body from storage.");
      err.statusCode = 502;
      throw err;
    }
  }
}

export const defaultGovernmentIdVerificationService = new GovernmentIdVerificationService();

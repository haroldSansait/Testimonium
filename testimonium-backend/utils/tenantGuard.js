import { AuditLogService } from "../services/AuditLogService.js";
import { logger } from "../config/logger.js";

/**
 * Tenant Guard Utility
 * 
 * Enforces strict multi-tenant row isolation and RBAC across all controllers and services.
 * Ring-fences SECRETARY and PRIEST users to their assigned parish.
 */

/**
 * Validates that the requesting user has permission to access or mutate a specific parish's resource.
 *
 * @param {object} req - Express request object containing req.user
 * @param {number|string} targetParishId - ID of the parish resource being accessed
 * @param {string} [resourceDescription="resource"] - Human-readable context for security logs
 * @returns {boolean} true if access is permitted
 * @throws {Error} 403 Forbidden with security logging if access is denied
 */
export async function validateParishAccess(req, targetParishId, resourceDescription = "resource") {
  const actor = req.user;
  if (!actor) {
    const err = new Error("Authentication is required.");
    err.statusCode = 401;
    throw err;
  }

  const role = actor.role; // string e.g. "DIOCESE_COORDINATOR", "SECRETARY", "PRIEST", "PARISHIONER"
  const actorParishId = actor.parish?.id;
  const parsedTargetId = parseInt(targetParishId, 10);

  // 1. Diocese Coordinator has global access
  if (role === "DIOCESE_COORDINATOR") {
    return true;
  }

  // 2. Parish Staff (Secretary / Priest) ring-fenced to their parish
  if (role === "SECRETARY" || role === "PRIEST") {
    if (actorParishId && parsedTargetId && Number(actorParishId) === Number(parsedTargetId)) {
      return true;
    }

    // Cross-tenant access violation: Log security alert with non-sensitive metadata
    const alertMeta = {
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: role,
      actorParishId,
      targetParishId: parsedTargetId || targetParishId,
      resource: resourceDescription,
      endpoint: req.originalUrl || req.url,
      method: req.method,
    };

    logger.warn(alertMeta, "[TenantGuard] SECURITY ALERT: Cross-parish unauthorized access attempt blocked");

    try {
      await AuditLogService.log(
        actor.id,
        "Unauthorized Cross-Parish Access Attempt",
        null,
        false,
        {
          affectedTable: null,
          affectedRecordId: null,
          parishId: actorParishId || null,
          metadata: {
            targetParishId: parsedTargetId || targetParishId || null,
            resource: resourceDescription,
            endpoint: req.originalUrl || req.url,
            method: req.method,
          },
        }
      );
    } catch (logErr) {
      logger.error({ err: logErr }, "[TenantGuard] Failed to persist security alert audit log");
    }

    const err = new Error("Forbidden: You do not have permission to access or modify resources for this parish.");
    err.statusCode = 403;
    throw err;
  }

  // 3. Parishioners are forbidden from staff-level parish resource modifications
  const err = new Error("Forbidden: You do not have permission to perform this action.");
  err.statusCode = 403;
  throw err;
}

/**
 * Resolves the authoritative parish ID for the current request.
 * For staff users, strictly ignores client-supplied parishId to prevent spoofing.
 *
 * @param {object} req - Express request object containing req.user
 * @param {number|string|null} [clientSuppliedParishId=null] - Optional parish ID provided in query/body
 * @returns {number|undefined} Authoritative parish ID
 */
export function getEffectiveParishId(req, clientSuppliedParishId = null) {
  const role = req.user?.role;

  if (role === "DIOCESE_COORDINATOR") {
    return clientSuppliedParishId ? parseInt(clientSuppliedParishId, 10) : undefined;
  }

  if (role === "SECRETARY" || role === "PRIEST") {
    return req.user?.parish?.id ? parseInt(req.user.parish.id, 10) : undefined;
  }

  // For parishioners or public routes
  return clientSuppliedParishId ? parseInt(clientSuppliedParishId, 10) : undefined;
}

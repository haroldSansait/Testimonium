import { defaultGovernmentIdVerificationService } from "../services/GovernmentIdVerificationService.js";
import { GOVERNMENT_ID_REJECTION_REASONS } from "../config/governmentIdVerification.js";

export class GovernmentIdVerificationController {
  constructor(service = defaultGovernmentIdVerificationService) {
    this.service = service;
  }

  /**
   * Parishioner submission endpoint: POST /identity-verification/submit
   */
  submit = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const frontFile = req.files?.front?.[0];
      const backFile = req.files?.back?.[0];

      if (!frontFile || !backFile) {
        return res.status(400).json({
          success: false,
          code: GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE,
          message: "Both front and back images of your Government ID are required.",
          errors: [
            ...(!frontFile ? [{ field: "front", message: "Front image is required." }] : []),
            ...(!backFile ? [{ field: "back", message: "Back image is required." }] : []),
          ],
        });
      }

      if (frontFile.size === 0 || backFile.size === 0) {
        return res.status(400).json({
          success: false,
          code: GOVERNMENT_ID_REJECTION_REASONS.FRONT_BACK_INCOMPLETE,
          message: "Submitted ID image cannot be 0 bytes.",
        });
      }

      const result = await this.service.submitForVerification(
        userId,
        frontFile.buffer,
        backFile.buffer
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Parishioner status endpoint: GET /identity-verification/status
   */
  getStatus = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const statusData = await this.service.getStatus(userId);

      return res.status(200).json({
        success: true,
        data: statusData,
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Coordinator user status: GET /users/:id/identity/status
   */
  getCoordinatorUserStatus = async (req, res, next) => {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      if (isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID.",
        });
      }

      const statusData = await this.service.getStatus(targetUserId);

      return res.status(200).json({
        success: true,
        data: statusData,
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Coordinator front image stream: GET /users/:id/identity/front-image
   */
  getCoordinatorFrontImage = async (req, res, next) => {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      if (isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID.",
        });
      }

      await this.service.streamIdImage(targetUserId, "front", res);
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Coordinator back image stream: GET /users/:id/identity/back-image
   */
  getCoordinatorBackImage = async (req, res, next) => {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      if (isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID.",
        });
      }

      await this.service.streamIdImage(targetUserId, "back", res);
    } catch (err) {
      return next(err);
    }
  };
}

export const defaultGovernmentIdVerificationController = new GovernmentIdVerificationController();

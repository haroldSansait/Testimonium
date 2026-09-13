import { caloyAdminService } from "../services/CaloyAdminService.js";
import { defaultCaloyRuntimeConfig } from "../services/CaloyRuntimeConfigService.js";

export class CaloyAdminController {
  constructor({
    adminService = caloyAdminService,
    configService = defaultCaloyRuntimeConfig,
  } = {}) {
    this.adminService = adminService;
    this.configService = configService;
  }

  getOverview = async (req, res, next) => {
    try {
      const data = await this.adminService.getOverview();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getAnalytics = async (req, res, next) => {
    try {
      const data = await this.adminService.getAnalytics(req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getSettings = async (req, res, next) => {
    try {
      const data = await this.configService.getEffectiveSettingsDto();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (req, res, next) => {
    try {
      const actorId = req.user?.id ? Number(req.user.id) : null;
      await this.configService.updateRuntimeConfig({
        ...req.body,
        ipAddress: req.ip || null,
        userAgent: req.get?.("user-agent") || null,
      }, actorId);
      const data = await this.configService.getEffectiveSettingsDto();
      return res.status(200).json({
        success: true,
        message: "Caloy runtime configuration updated successfully",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getLogs = async (req, res, next) => {
    try {
      const data = await this.adminService.getLogs(req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getPurgePreview = async (req, res, next) => {
    try {
      const data = await this.adminService.getPurgePreview(req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  executePurge = async (req, res, next) => {
    try {
      const actorId = req.user?.id ? Number(req.user.id) : null;
      const data = await this.adminService.executePurge(req.body, actorId);
      return res.status(200).json({
        success: true,
        message: "Caloy operational telemetry purged successfully",
        data,
      });
    } catch (err) {
      if (err.purgeResult) {
        return res.status(err.statusCode || 500).json({
          success: false,
          code: err.code || "CALOY_PURGE_FAILED",
          message: err.message,
          data: err.purgeResult,
        });
      }
      next(err);
    }
  };

  getKnowledgeStats = async (req, res, next) => {
    try {
      const data = await this.adminService.getKnowledgeStats();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const caloyAdminController = new CaloyAdminController();

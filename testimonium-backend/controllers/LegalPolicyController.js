import { LegalPolicyService } from "../services/LegalPolicyService.js";

export class LegalPolicyController {
  constructor({ service = LegalPolicyService } = {}) {
    this.service = service;
  }

  getCurrentPolicies = async (req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      const data = await this.service.getCurrentPolicies();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getManagePolicies = async (req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      const data = await this.service.getManagePolicies();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  updatePolicy = async (req, res, next) => {
    try {
      const { policyType } = req.params;
      const coordinatorId = req.user?.id ? Number(req.user.id) : null;
      const data = await this.service.updatePolicy(policyType, req.body, coordinatorId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const legalPolicyController = new LegalPolicyController();

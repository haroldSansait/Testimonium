import { knowledgeService } from "../services/KnowledgeService.js";

export class KnowledgeController {
  constructor(service = knowledgeService) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const { scope, status, authority, parishId, category, search, page, limit } = req.query;
      const result = await this.service.listSources({
        scope,
        status,
        authority,
        parishId: parishId ? Number(parishId) : undefined,
        category,
        search,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await this.service.getSourceById(id);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const result = await this.service.createSource({
        ...req.body,
        userId,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const result = await this.service.updateSource(id, {
        ...req.body,
        userId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  confirm = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const { expectedVersion } = req.body || {};
      const result = await this.service.confirmSource(id, {
        expectedVersion,
        userId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  publish = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const { expectedVersion } = req.body || {};
      const result = await this.service.publishSource(id, {
        expectedVersion,
        userId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  retire = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const { expectedVersion } = req.body || {};
      const result = await this.service.retireSource(id, {
        expectedVersion,
        userId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  retryEmbedding = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const { expectedVersion } = req.body || {};
      const result = await this.service.retryFailedEmbeddings(id, {
        expectedVersion,
        userId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const knowledgeController = new KnowledgeController();

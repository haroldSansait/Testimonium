import { ParishService } from "../services/ParishService.js";

const parishService = new ParishService();

export const list = async (req, res, next) => {
  try {
    const { search, type, status, page, limit } = req.query;
    const filters = {
      search,
      type,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
    };

    const data = await parishService.getParishes(filters);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await parishService.getParishById(id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const data = await parishService.createParish(req.body, req.user?.id);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await parishService.editParish(id, req.body, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const archive = async (req, res, next) => {
  try {
    const { id } = req.params;
    await parishService.archiveParish(id, req.user?.id);
    return res.status(200).json({ success: true, message: "Parish archived successfully." });
  } catch (err) {
    return next(err);
  }
};

export const restore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await parishService.restoreParish(id, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

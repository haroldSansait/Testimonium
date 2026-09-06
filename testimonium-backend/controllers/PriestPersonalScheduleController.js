import { PriestPersonalScheduleService } from "../services/PriestPersonalScheduleService.js";

const service = new PriestPersonalScheduleService();

export const list = async (req, res, next) => {
  try {
    const priestId = req.user.id;
    const { startDate, endDate } = req.query;

    const data = await service.list(priestId, { startDate, endDate });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const priestId = req.user.id;
    const { id } = req.params;

    const data = await service.getById(id, priestId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const priestId = req.user.id;
    const { title, notes, startAt, endAt } = req.body;

    const data = await service.create(priestId, {
      title,
      notes,
      startAt,
      endAt,
    });

    return res.status(201).json({
      success: true,
      message: "Personal schedule commitment created successfully.",
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const priestId = req.user.id;
    const { id } = req.params;
    const { title, notes, startAt, endAt, expectedVersion } = req.body;

    const data = await service.update(id, priestId, {
      title,
      notes,
      startAt,
      endAt,
      expectedVersion,
    });

    return res.status(200).json({
      success: true,
      message: "Personal schedule commitment updated successfully.",
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const priestId = req.user.id;
    const { id } = req.params;
    const expectedVersion = req.query.expectedVersion;

    const result = await service.delete(id, priestId, expectedVersion);

    return res.status(200).json({
      success: true,
      message: "Personal schedule commitment removed successfully.",
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

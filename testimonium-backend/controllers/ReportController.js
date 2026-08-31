import { ReportService } from "../services/ReportService.js";

const service = new ReportService();

export async function list(req, res, next) {
  try {
    const result = await service.list(req.query, req.user);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        page: req.query.page,
        limit: req.query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / req.query.limit),
      },
    });
  } catch (error) { return next(error); }
}

export async function getById(req, res, next) {
  try {
    const data = await service.getById(req.params.id, req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) { return next(error); }
}

export async function create(req, res, next) {
  try {
    const data = await service.create(req.body, req.user);
    return res.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
}

export async function update(req, res, next) {
  try {
    const data = await service.update(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) { return next(error); }
}

export async function archive(req, res, next) {
  try {
    const data = await service.archive(req.params.id, req.query.expectedVersion, req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) { return next(error); }
}

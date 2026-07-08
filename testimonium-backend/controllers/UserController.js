import { UserService } from "../services/UserService.js";

const userService = new UserService();

export const list = async (req, res, next) => {
  try {
    const { search, role, status, page, limit, assignableForParishId } = req.query;
    const filters = { search, role, status, assignableForParishId };
    if (page !== undefined || limit !== undefined) {
      filters.page = page ? parseInt(page, 10) : 1;
      filters.limit = limit ? parseInt(limit, 10) : 25;
    }

    const { data, total } = await userService.getUsers(filters);

    if (page !== undefined || limit !== undefined) {
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
      return res.status(200).json({
        success: true,
        data,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages: Math.ceil(total / parsedLimit),
        },
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const data = await userService.createUser(req.body, req.user?.id);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await userService.editUser(id, req.body, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const disable = async (req, res, next) => {
  try {
    const { id } = req.params;
    await userService.disableUser(id, req.user?.id);
    return res.status(200).json({ success: true, message: "User disabled successfully." });
  } catch (err) {
    return next(err);
  }
};

export const enable = async (req, res, next) => {
  try {
    const { id } = req.params;
    await userService.enableUser(id, req.user?.id);
    return res.status(200).json({ success: true, message: "User enabled successfully." });
  } catch (err) {
    return next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resetLink = await userService.resetPassword(id, req.user?.id);
    return res.status(200).json({
      success: true,
      message: "Password reset link generated successfully.",
      data: { resetLink },
    });
  } catch (err) {
    return next(err);
  }
};

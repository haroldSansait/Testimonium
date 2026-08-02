export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    return next();
  } catch (error) {
    const issues = error.errors || error.issues || [];
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
};

export const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    return next();
  } catch (error) {
    const issues = error.errors || error.issues || [];
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
};


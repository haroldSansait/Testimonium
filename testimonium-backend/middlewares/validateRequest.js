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
    const parsedQuery = schema.parse(req.query);

    // Express 5 exposes req.query through a getter-only prototype property.
    // Define a request-local value so downstream handlers keep receiving the
    // validated/coerced query object without assigning to that getter.
    Object.defineProperty(req, "query", {
      value: parsedQuery,
      configurable: true,
      enumerable: true,
      writable: true,
    });
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


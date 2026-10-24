import { PushDeviceService } from "../services/PushDeviceService.js";
const service = new PushDeviceService();
const safeError = error => [400, 403].includes(error.statusCode) ? error
  : Object.assign(new Error("Android push registration is temporarily unavailable."), { statusCode: 503 });

export const registerDevice = async (req, res, next) => {
  try {
    if (req.body?.platform !== "android") return res.status(400).json({ success: false, message: "Only Android push is supported." });
    await service.register(req.user, req.body.token, req.body.previousToken);
    return res.status(204).end();
  } catch (error) { return next(safeError(error)); }
};

export const unregisterDevice = async (req, res, next) => {
  try {
    await service.unregister(req.user.id, req.body?.token);
    return res.status(204).end();
  } catch (error) { return next(safeError(error)); }
};

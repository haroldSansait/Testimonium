import { PaymentConfigurationService } from "../services/PaymentConfigurationService.js";

const paymentConfigurationService = new PaymentConfigurationService();

export const getPaymentConfiguration = async (req, res, next) => {
  try {
    const { parishId } = req.query;
    const config = await paymentConfigurationService.resolveConfiguration(parishId);

    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (err) {
    return next(err);
  }
};

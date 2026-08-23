import { PaymentConfigurationService } from "../services/PaymentConfigurationService.js";

const paymentConfigurationService = new PaymentConfigurationService();

export const getPaymentConfiguration = async (req, res, next) => {
  try {
    const { requestId } = req.query;
    const userId = req.user?.id;
    const config = await paymentConfigurationService.getConfiguration({
      requestId,
      userId,
    });

    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
};

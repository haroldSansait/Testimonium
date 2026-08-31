import { AnalyticsService } from "../services/AnalyticsService.js";

const analyticsService = new AnalyticsService();

/**
 * Endpoint for Dashboard Overview statistics.
 */
export const getOverview = async (req, res, next) => {
  try {
    const data = await analyticsService.getOverview();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

/**
 * Endpoint for Sacrament analytics.
 */
export const getSacraments = async (req, res, next) => {
  try {
    const data = await analyticsService.getSacramentAnalytics();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

/**
 * Endpoint for Document request analytics.
 */
export const getDocuments = async (req, res, next) => {
  try {
    const data = await analyticsService.getDocumentAnalytics();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

/**
 * Endpoint for Parish activity analytics.
 */
export const getParishes = async (req, res, next) => {
  try {
    const data = await analyticsService.getParishAnalytics();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getDescriptive = async (req, res, next) => {
  try {
    const data = await analyticsService.getDescriptiveAnalytics(req.query, req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

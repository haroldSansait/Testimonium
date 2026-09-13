import { z } from "zod";
import { isValidStrictManilaDate } from "../utils/manilaAnalyticsDate.js";
import { isApprovedGenerationModel } from "../config/caloyModelCatalog.js";

const strictCalendarDate = z
  .string()
  .refine(isValidStrictManilaDate, {
    message: "Invalid calendar date. Expected valid YYYY-MM-DD in Asia/Manila.",
  })
  .optional();

export const caloySettingsUpdateSchema = z
  .object({
    expectedVersion: z.number().int().min(0, "expectedVersion must be >= 0"),
    enabled: z.boolean().optional(),
    generationModel: z
      .string()
      .trim()
      .min(1)
      .refine(isApprovedGenerationModel, {
        message: "Model is not in the approved server catalog",
      })
      .optional(),
    aiTenMinuteMax: z.number().int().min(5).max(100).optional(),
    aiDailyMax: z.number().int().min(10).max(500).optional(),
    chatbotRequestDeadlineMs: z.number().int().min(5000).max(28000).optional(),
    automaticRetentionEnabled: z.boolean().optional(),
    logRetentionDays: z.number().int().min(14).max(365).optional(),
  })
  .refine(
    (data) => {
      if (data.aiDailyMax !== undefined && data.aiTenMinuteMax !== undefined) {
        return data.aiDailyMax >= data.aiTenMinuteMax;
      }
      return true;
    },
    {
      message: "aiDailyMax must be greater than or equal to aiTenMinuteMax",
      path: ["aiDailyMax"],
    }
  );

export const caloyAnalyticsQuerySchema = z
  .object({
    from: strictCalendarDate,
    to: strictCalendarDate,
    preset: z.enum(["today", "7d", "30d", "90d", "custom"]).optional(),
    parishId: z.coerce.number().int().positive().optional(),
    model: z.string().trim().optional(),
    responseType: z.string().trim().optional(),
    category: z.string().trim().optional(),
  })
  .refine(
    (value) => {
      if (!value.from || !value.to) return true;
      return value.from <= value.to;
    },
    {
      message: "from date must be on or before to date",
      path: ["to"],
    }
  );

export const caloyLogsQuerySchema = z
  .object({
    from: strictCalendarDate,
    to: strictCalendarDate,
    parishId: z.coerce.number().int().positive().optional(),
    responseType: z.string().trim().optional(),
    model: z.string().trim().optional(),
    category: z.string().trim().optional(),
    outcome: z.enum(["all", "success", "fallback"]).default("all"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine(
    (value) => {
      if (!value.from || !value.to) return true;
      return value.from <= value.to;
    },
    {
      message: "from date must be on or before to date",
      path: ["to"],
    }
  );

export const caloyPurgePreviewQuerySchema = z.object({
  daysOlderThan: z.coerce.number().int().min(14).max(365).default(90),
}).strict();

export const caloyPurgeExecuteSchema = z.object({
  daysOlderThan: z.number().int().min(14).max(365).default(90),
}).strict();

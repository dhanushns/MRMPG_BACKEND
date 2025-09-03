import Joi from "joi";

export const weeklyReportCardsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export const monthlyReportCardsQuerySchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2020).max(2030).optional()
});

export const weeklyReportQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

// Monthly report cards validation (no filters needed)
export const monthlyReportQuerySchema = Joi.object({
   page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2020).max(2030).optional()
});


export const reportDownloadQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2020).max(2030).optional(),

});

export const reportDownloadParamsSchema = Joi.object({
  reportType: Joi.string().valid("weekly", "monthly").required()
});

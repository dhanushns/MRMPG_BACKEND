import Joi from "joi";

// Get all members query validation schema
export const getAllMembersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  pgId: Joi.string().optional(),
  rentType: Joi.string().valid('LONG_TERM', 'SHORT_TERM').optional(),
  pgLocation: Joi.string().optional().trim(),
  status: Joi.string().valid('PAID', 'PENDING', 'OVERDUE').optional(),
  search: Joi.string().optional().trim(),
});

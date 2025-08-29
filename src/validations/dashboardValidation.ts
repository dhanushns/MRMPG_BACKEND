import Joi from "joi";

// Get all members query validation schema
export const getAllMembersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  pgId: Joi.string().optional(),
  rentType: Joi.string().valid('LONG_TERM', 'SHORT_TERM').optional(),
  location: Joi.string().optional().trim(), // Can be comma-separated values
  work: Joi.string().optional().trim(), // Can be comma-separated values
  pgLocation: Joi.string().optional().trim(), // Can be comma-separated values
  paymentStatus: Joi.string().valid('PAID', 'PENDING', 'OVERDUE').optional(),
  status: Joi.string().valid('PAID', 'PENDING', 'OVERDUE').optional(), // Alias for paymentStatus
  search: Joi.string().optional().trim(),
});

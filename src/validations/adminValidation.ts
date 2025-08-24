import Joi from "joi";

// Admin validation schemas
export const adminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
});

export const createAdminSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6).max(100),
});

export const updateAdminSchema = Joi.object({
  name: Joi.string().optional().min(2).max(100).trim(),
  email: Joi.string().email().optional(),
  password: Joi.string().optional().min(6).max(100),
}).min(1); // At least one field must be provided

// Common validation schemas
export const idParamSchema = Joi.object({
  id: Joi.string().required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

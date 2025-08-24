import Joi from "joi";
import { Gender, RentType, PgType } from "@prisma/client";

// Member registration validation schema
export const registerMemberSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  age: Joi.number().integer().required().min(16).max(100),
  gender: Joi.string().valid(...Object.values(Gender)).required(),
  location: Joi.string().required().min(2).max(200).trim(),
  pgLocation: Joi.string().required().min(2).max(200).trim(),
  email: Joi.string().email().required(),
  phone: Joi.string().required().pattern(/^[0-9]{10}$/),
  rentType: Joi.string().valid(...Object.values(RentType)).required(),
  pgType: Joi.string().valid(...Object.values(PgType)).required(),
});

// Member creation validation schema (for admin use)
export const createMemberSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  age: Joi.number().integer().required().min(16).max(100),
  gender: Joi.string().valid(...Object.values(Gender)).required(),
  location: Joi.string().required().min(2).max(200).trim(),
  email: Joi.string().email().required(),
  phone: Joi.string().required().pattern(/^[0-9]{10}$/),
  rentType: Joi.string().valid(...Object.values(RentType)).required(),
  advanceAmount: Joi.number().min(0).required(),
  pgId: Joi.string().required(),
  roomId: Joi.string().optional(),
});

// Common validation schemas
export const idParamSchema = Joi.object({
  id: Joi.string().required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

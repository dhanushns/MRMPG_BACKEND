import Joi from "joi";
import { Gender, RentType, PgType } from "@prisma/client";

// Personal data validation schema (Step 1)
export const validatePersonalDataSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  age: Joi.number().integer().required().min(16).max(100),
  gender: Joi.string().valid(...Object.values(Gender)).required(),
  phone: Joi.string().required().pattern(/^[0-9]{10}$/),
  location: Joi.string().required().min(2).max(200).trim(),
  email: Joi.string().email().required()
});

// Complete registration validation schema
export const completeRegistrationSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  age: Joi.number().integer().required().min(16).max(100),
  gender: Joi.string().valid(...Object.values(Gender)).required(),
  phone: Joi.string().required().pattern(/^[0-9]{10}$/),
  location: Joi.string().required().min(2).max(200).trim(),
  work: Joi.string().required().min(2).max(100).trim(),
  email: Joi.string().email().required(),
  pgLocation: Joi.string().required().min(2).max(200).trim(),
  rentType: Joi.string().valid(...Object.values(RentType)).required(),
  pgType: Joi.string().valid(...Object.values(PgType)).required(),
});

// Payment submission validation schema
export const submitPaymentSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  memberId: Joi.string().required().min(3).max(50).trim(),
  roomNo: Joi.string().required().min(1).max(10).trim(),
  pgType: Joi.string().valid(...Object.values(PgType)).required(),
  pgLocation: Joi.string().required().min(2).max(200).trim(),
});

// Common validation schemas
export const idParamSchema = Joi.object({
  id: Joi.string().required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

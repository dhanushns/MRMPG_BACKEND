import Joi from "joi";

// Staff validation schemas
export const createStaffSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6).max(100),
  pgId: Joi.string().required(),
});

export const updateStaffSchema = Joi.object({
  name: Joi.string().optional().min(2).max(100).trim(),
  email: Joi.string().email().optional(),
  password: Joi.string().optional().min(6).max(100),
}).min(1); // At least one field must be provided

export const assignStaffToPGSchema = Joi.object({
  pgId: Joi.string().required(),
});

// Common validation schemas
export const idParamSchema = Joi.object({
  id: Joi.string().required(),
});

export const pgIdParamSchema = Joi.object({
  pgId: Joi.string().required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export const staffLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Process registered member application schema
export const processRegisteredMemberSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  roomNo: Joi.when('status', {
    is: 'APPROVED',
    then: Joi.string().required().trim().min(1).max(10),
    otherwise: Joi.forbidden()
  }),
  advanceAmount: Joi.when('status', {
    is: 'APPROVED', 
    then: Joi.number().required().min(0).max(1000000),
    otherwise: Joi.forbidden()
  })
});

export const registeredMemberIdParamSchema = Joi.object({
  registeredMemberId: Joi.string().required()
});

// Member filters validation schema
export const getMembersFilterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().optional().trim().min(1).max(100),
  gender: Joi.string().valid('MALE', 'FEMALE').optional(),
  rentType: Joi.string().valid('LONG_TERM', 'SHORT_TERM').optional(),
  roomNo: Joi.string().optional().trim().min(1).max(10),
  ageMin: Joi.number().integer().min(18).max(100).optional(),
  ageMax: Joi.number().integer().min(18).max(100).optional(),
  advanceAmountMin: Joi.number().min(0).max(1000000).optional(),
  advanceAmountMax: Joi.number().min(0).max(1000000).optional(),
  dateJoinedFrom: Joi.date().iso().optional(),
  dateJoinedTo: Joi.date().iso().optional()
}).custom((value, helpers) => {
  // Validate age range
  if (value.ageMin && value.ageMax && value.ageMin > value.ageMax) {
    return helpers.error('any.invalid', { message: 'ageMin cannot be greater than ageMax' });
  }
  
  // Validate advance amount range
  if (value.advanceAmountMin && value.advanceAmountMax && value.advanceAmountMin > value.advanceAmountMax) {
    return helpers.error('any.invalid', { message: 'advanceAmountMin cannot be greater than advanceAmountMax' });
  }
  
  // Validate date range
  if (value.dateJoinedFrom && value.dateJoinedTo && new Date(value.dateJoinedFrom) > new Date(value.dateJoinedTo)) {
    return helpers.error('any.invalid', { message: 'dateJoinedFrom cannot be after dateJoinedTo' });
  }
  
  return value;
});

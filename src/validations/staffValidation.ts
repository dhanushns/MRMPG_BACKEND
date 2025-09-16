import Joi from 'joi';
import { Gender, PaymentMethod } from '@prisma/client';

export const createStaffSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  phoneNo: Joi.string().required().pattern(/^[0-9]{10}$/),
  gender: Joi.string().valid(...Object.values(Gender)).required(),
  salary: Joi.number().min(0).required(),
  pgId: Joi.string().required()
});

export const updateStaffSalarySchema = Joi.object({
  newSalary: Joi.number().min(0).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2020).max(2100).required(),
  paymentType: Joi.string().valid(...Object.values(PaymentMethod)).required(),
  remarks: Joi.string().max(500).optional()
});

export const staffIdSchema = Joi.object({
  id: Joi.string().required()
});

export const getAllPaymentHistorySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2020).max(2100).optional(),
  paymentType: Joi.string().valid(...Object.values(PaymentMethod)).optional(),
  sortBy: Joi.string().valid('paymentDate', 'amount', 'month', 'year').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional()
});

export const getStaffPaymentHistorySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2020).max(2100).optional(),
  paymentType: Joi.string().valid(...Object.values(PaymentMethod)).optional(),
  sortBy: Joi.string().valid('paymentDate', 'amount', 'month', 'year').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional()
});

export const bulkUpdateStaffSalarySchema = Joi.object({
  staffUpdates: Joi.array()
    .items(
      Joi.object({
        staffId: Joi.string().required(),
        newSalary: Joi.number().min(0).required(),
        remarks: Joi.string().max(500).optional()
      })
    )
    .min(1)
    .max(50)
    .required(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2020).max(2100).required(),
  paymentType: Joi.string().valid(...Object.values(PaymentMethod)).required()
});
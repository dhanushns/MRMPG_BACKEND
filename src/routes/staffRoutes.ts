import { Router } from 'express';
import {
  createStaff,
  updateStaffSalary,
  deleteStaff,
  getStaffById,
  getAllPaymentHistory,
  getStaffPaymentHistory,
  getStaffOptions,
  bulkUpdateStaffSalary
} from '../controllers/staffController';
import { authenticateAdmin } from '../middlewares/auth';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation';
import {
  createStaffSchema,
  updateStaffSalarySchema,
  staffIdSchema,
  getAllPaymentHistorySchema,
  getStaffPaymentHistorySchema,
  bulkUpdateStaffSalarySchema
} from '../validations/staffValidation';

const router = Router();

// Get staff options for dropdown - Admin only
router.get(
  '/options',
  authenticateAdmin,
  getStaffOptions
);

// Create and assign staff to PG - Admin only
router.post(
  '/',
  authenticateAdmin,
  validateBody(createStaffSchema),
  createStaff
);

// Bulk update staff salaries - Admin only
router.patch(
  '/bulk-salary-update',
  authenticateAdmin,
  validateBody(bulkUpdateStaffSalarySchema),
  bulkUpdateStaffSalary
);

// Get all payment history with pagination - Admin only
router.get(
  '/payments/history',
  authenticateAdmin,
  validateQuery(getAllPaymentHistorySchema),
  getAllPaymentHistory
);

// Update staff salary (creates payment record) - Admin only
router.patch(
  '/:id/salary',
  authenticateAdmin,
  validateParams(staffIdSchema),
  validateBody(updateStaffSalarySchema),
  updateStaffSalary
);

// Get payment history of specific staff with pagination - Admin only
router.get(
  '/:id/payments',
  authenticateAdmin,
  validateParams(staffIdSchema),
  validateQuery(getStaffPaymentHistorySchema),
  getStaffPaymentHistory
);

// Get staff details by ID - Admin only
router.get(
  '/:id',
  authenticateAdmin,
  validateParams(staffIdSchema),
  getStaffById
);

// Delete staff (soft delete) - Admin only
router.delete(
  '/:id',
  authenticateAdmin,
  validateParams(staffIdSchema),
  deleteStaff
);

export default router;
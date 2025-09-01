import express from "express";
import { authenticateAdmin } from "../middlewares/auth";
import { validateBody, validateParams, validateQuery } from "../middlewares/validation";
import {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
  getEnquiryStats,
  deleteEnquiry,
} from "../controllers/enquiryController";
import {
  createEnquirySchema,
  updateEnquiryStatusSchema,
  enquiryIdParamSchema,
  enquiryFilterQuerySchema,
} from "../validations/enquiryValidation";

const router = express.Router();

// PUBLIC ROUTES (no authentication required)
// POST /api/enquiry - Create new enquiry
router.post(
  "/",
  validateBody(createEnquirySchema),
  createEnquiry
);

// ADMIN ROUTES (authentication required)
// GET /api/enquiry - Get all enquiries with filters and pagination
router.get(
  "/",
  authenticateAdmin,
  validateQuery(enquiryFilterQuerySchema),
  getEnquiries
);

// GET /api/enquiry/stats - Get enquiry statistics
router.get(
  "/stats",
  authenticateAdmin,
  getEnquiryStats
);

// GET /api/enquiry/:enquiryId - Get single enquiry by ID
router.get(
  "/:enquiryId",
  authenticateAdmin,
  validateParams(enquiryIdParamSchema),
  getEnquiryById
);

// PATCH /api/enquiry/:enquiryId/status - Update enquiry status
router.patch(
  "/:enquiryId/status",
  authenticateAdmin,
  validateParams(enquiryIdParamSchema),
  validateBody(updateEnquiryStatusSchema),
  updateEnquiryStatus
);

// DELETE /api/enquiry/:enquiryId - Delete enquiry
router.delete(
  "/:enquiryId",
  authenticateAdmin,
  validateParams(enquiryIdParamSchema),
  deleteEnquiry
);

export default router;

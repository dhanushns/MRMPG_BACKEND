import { Router } from "express";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth";
import {
  getApprovalStats,
  getDashboardStats,
  getEnquiryStats,
  getExpenseStats,
  getRoomStats,
} from "../controllers/statsController";
import { validateParams, validateQuery } from "../middlewares/validation";
import { pgIdParamSchema } from "../validations/roomValidation";
import { expenseStatsValidation } from "../validations/expenseValidation";

const router = Router();

// Protected routes
router.use(authenticateAdmin);
router.use(authorizeAdmin);

router.get("/dashboard", getDashboardStats);

router.get("/approvals", getApprovalStats);

// GET Room stats - defaults to first PG if no pgId provided
router.get("/rooms", getRoomStats);
router.get("/rooms/:pgId", validateParams(pgIdParamSchema), getRoomStats);

router.get("/expenses", validateQuery(expenseStatsValidation), getExpenseStats);

router.get("/enquiry", authenticateAdmin, getEnquiryStats);

export default router;

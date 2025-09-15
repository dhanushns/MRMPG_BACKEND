import { Router } from "express";
import {
  loginAdmin,
  createAdmin,
  getProfile,
  updateProfile,
  getManagedPGs,
  updateOverduePaymentsEndpoint,
} from "../controllers/adminController";
import {
  triggerExpenseStatsCalculation,
  getSchedulerStatus,
  getExpenseStatsSummaryByPgType
} from "../controllers/expenseStatsController";
import { validateBody, validateParams, validateQuery } from "../middlewares/validation";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth";
import {
  adminLoginSchema,
  createAdminSchema,
  updateAdminSchema,
  idParamSchema,
  paginationQuerySchema,
  registeredMembersQuerySchema,
} from "../validations/adminValidation";
import { getPgLocationOptions, getRoomsByPgId } from "../controllers/registrationController";

const router = Router();

// Public routes
router.post("/login", validateBody(adminLoginSchema), loginAdmin);

// Temporary route for creating admin, remove later
router.post("/", validateBody(createAdminSchema), createAdmin);

// Protected routes (authentication required)
router.use(authenticateAdmin);
router.use(authorizeAdmin);

router.get("/pg-locations", getPgLocationOptions);
router.get("/rooms", getRoomsByPgId);

// Admin management routes
router.get("/profile", getProfile);
router.put("/profile", validateBody(updateAdminSchema), updateProfile);

// PG management routes
router.get("/pgs", getManagedPGs);

// Payment record management routes
router.post("/payment-records/update-overdue", updateOverduePaymentsEndpoint);

// Expense Stats Management Routes (for testing and monitoring)
router.post("/expense-stats/calculate", authenticateAdmin, triggerExpenseStatsCalculation);
router.get("/expense-stats/scheduler-status", authenticateAdmin, getSchedulerStatus);
router.get("/expense-stats/summary", authenticateAdmin, getExpenseStatsSummaryByPgType);

export default router;

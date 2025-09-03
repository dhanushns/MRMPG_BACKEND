import { Router } from "express";
import {
  loginAdmin,
  createAdmin,
  getProfile,
  updateProfile,
  getManagedPGs,
  updateOverduePaymentsEndpoint,
} from "../controllers/adminController";
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
import { getPgLocationOptions, getRoomsByPgId } from "../controllers/userController";

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

export default router;

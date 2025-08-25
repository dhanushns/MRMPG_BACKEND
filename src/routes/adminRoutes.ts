import { Router } from "express";
import {
  loginAdmin,
  createAdmin,
  getProfile,
  updateProfile,
  getManagedPGs,
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

const router = Router();

// Public routes
router.post("/login", validateBody(adminLoginSchema), loginAdmin);

// Temporary route for creating admin, remove later
router.post("/", validateBody(createAdminSchema), createAdmin);

// Protected routes (authentication required)
router.use(authenticateAdmin);
router.use(authorizeAdmin);

// Admin management routes
router.get("/profile", getProfile);
router.put("/profile", validateBody(updateAdminSchema), updateProfile);

// PG management routes
router.get("/pgs", getManagedPGs);

export default router;

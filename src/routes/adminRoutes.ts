import { Router } from "express";
import {
  loginAdmin,
  createAdmin,
  getProfile,
} from "../controllers/adminController";
import { validateBody, validateParams, validateQuery } from "../middlewares/validation";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth";
import {
  adminLoginSchema,
  createAdminSchema,
  updateAdminSchema,
  idParamSchema,
  paginationQuerySchema,
} from "../validations/adminValidation";
import { createStaffSchema, updateStaffSchema } from "../validations/staffValidation";
import { createStaff, deleteStaff, getAllStaff, getStaffById, updateStaff } from "../controllers/adminController";

const router = Router();

// Public routes
router.post("/login", validateBody(adminLoginSchema), loginAdmin);

// Protected routes (authentication required)
router.use(authenticateAdmin);
router.use(authorizeAdmin);

// Admin management routes 
router.post("/", validateBody(createAdminSchema), createAdmin);
router.get("/profile", getProfile);

// Staff management routes
router.post("/staff", validateBody(createStaffSchema), createStaff);
router.get("/staff", validateQuery(paginationQuerySchema), getAllStaff);
router.get("/staff/:id", validateParams(idParamSchema), getStaffById);
router.put("/staff/:id", validateParams(idParamSchema), validateBody(updateStaffSchema), updateStaff);
router.delete("/staff/:id", validateParams(idParamSchema), deleteStaff);

export default router;

import { Router } from "express";
import { getRegisteredMembersByStaff, processRegisteredMemberApplication, getMembersByStaff, staffLogin } from "../controllers/staffController";
import { validateQuery, validateBody, validateParams } from "../middlewares/validation";
import { authenticateStaff, authorizeStaff } from "../middlewares/auth";
import { paginationQuerySchema, processRegisteredMemberSchema, registeredMemberIdParamSchema, getMembersFilterSchema, staffLoginSchema } from "../validations/staffValidation";
import roomRoutes from "./roomRoutes";

const router = Router();

// public route for staff login
router.post("/login", validateBody(staffLoginSchema), staffLogin);

// Apply staff authentication middleware to all routes
router.use(authenticateStaff);
router.use(authorizeStaff);

// Staff-authenticated routes
router.get("/registered-members", validateQuery(paginationQuerySchema), getRegisteredMembersByStaff);

// Get all members of staff's PG with filters
router.get("/members", validateQuery(getMembersFilterSchema), getMembersByStaff);

// Process registered member application (approve/reject)
router.patch("/registered-members/:registeredMemberId/process", 
  validateParams(registeredMemberIdParamSchema),
  validateBody(processRegisteredMemberSchema),
  processRegisteredMemberApplication
);

// Mount room routes under staff portal
router.use("/rooms", roomRoutes);

export default router;

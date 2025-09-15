import { Router } from "express";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth"
import { getDashboardStats, getAllMembers, getDashboardFilterOptions } from "../controllers/dashboardController";
import { validateQuery } from "../middlewares/validation";
import { getAllMembersQuerySchema } from "../validations/dashboardValidation";

const router = Router();

// Protected routes
router.use(authenticateAdmin);
router.use(authorizeAdmin);

router.get("/stats", getDashboardStats);
router.get("/members", validateQuery(getAllMembersQuerySchema), getAllMembers);
router.get("/filters", getDashboardFilterOptions);

export default router;


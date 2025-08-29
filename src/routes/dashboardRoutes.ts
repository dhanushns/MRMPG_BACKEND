import { Router } from "express";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth"
import { getDashboardStats, getAllMembers, calculateAndUpdateDashboardStats, getDashboardFilterOptions } from "../controllers/dashboardController";
import { validateQuery } from "../middlewares/validation";
import { getAllMembersQuerySchema } from "../validations/dashboardValidation";

const router = Router();

// Protected routes
router.use(authenticateAdmin);
router.use(authorizeAdmin);

router.get("/stats", getDashboardStats);
router.post("/stats/refresh", calculateAndUpdateDashboardStats);
router.get("/members", validateQuery(getAllMembersQuerySchema), getAllMembers);
router.get("/filters", getDashboardFilterOptions);

export default router;


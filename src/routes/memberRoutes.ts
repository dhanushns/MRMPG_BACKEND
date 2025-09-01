import { Router } from "express";
import { getMembersByRentType, getMemberFilterOptions, getMemberDetails } from "../controllers/memberController";
import { authenticateAdmin } from "../middlewares/auth";
import { validateParams, validateQuery } from "../middlewares/validation";
import { memberQuerySchema } from "../validations/memberValidation";

const router = Router();

// Get filter options for members
router.get(
  "/filters",
  authenticateAdmin,
  getMemberFilterOptions
);

router.get(
  "/:rentType",
  authenticateAdmin,
  validateQuery(memberQuerySchema),
  getMembersByRentType
);

router.get("/details/:memberId", authenticateAdmin, getMemberDetails);

export default router;

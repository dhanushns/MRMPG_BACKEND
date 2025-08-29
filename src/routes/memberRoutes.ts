import { Router } from "express";
import { getMembersByRentType, getMemberFilterOptions } from "../controllers/memberController";
import { authenticateAdmin } from "../middlewares/auth";
import { validateParams, validateQuery } from "../middlewares/validation";
import { memberQuerySchema } from "../validations/memberValidation";

const router = Router();

// Get filter options for members
router.get(
  "/members/filters",
  authenticateAdmin,
  getMemberFilterOptions
);

router.get(
  "/members/:rentType",
  authenticateAdmin,
  validateQuery(memberQuerySchema),
  getMembersByRentType
);

export default router;

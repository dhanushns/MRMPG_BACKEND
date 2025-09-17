import { Router } from "express";
import { 
  getWeeklyReportCards,
  getMonthlyReportCards
} from "../controllers/reportCardsController";
import { 
  getWeeklyPGPerformance,
  getWeeklyRoomUtilization,
  getWeeklyPaymentAnalytics,
  getWeeklyFinancialSummary,
  getMonthlyPGPerformance,
  getMonthlyRoomUtilization,
  getMonthlyPaymentAnalytics,
  getMonthlyFinancialSummary
} from "../controllers/reportTableController";
import { downloadReport } from "../controllers/reportDownloadController";
import { getAvailableWeeks, getAvailableMonths } from "../controllers/filtersController";
import { authenticateAdmin } from "../middlewares/auth";
import { validateParams, validateQuery } from "../middlewares/validation";
import { 
  weeklyReportQuerySchema,
  monthlyReportQuerySchema,
  weeklyReportCardsQuerySchema,
  monthlyReportCardsQuerySchema,
  reportDownloadParamsSchema,
  reportDownloadQuerySchema,
} from "../validations/reportValidation";

const router = Router();

// All routes require authentication
router.use(authenticateAdmin);

// Options routes for available weeks and months
router.get("/options/weeks", getAvailableWeeks);
router.get("/options/months", getAvailableMonths);

// Weekly Report Cards Route
router.get(
  "/weekly/cards",
  validateQuery(weeklyReportCardsQuerySchema),
  getWeeklyReportCards
);

// Monthly Report Routes
router.get(
  "/monthly/cards",
  validateQuery(monthlyReportCardsQuerySchema),
  getMonthlyReportCards
);

// Weekly Report Table Data Routes
router.get(
  "/weekly/pg-report",
  validateQuery(weeklyReportQuerySchema),
  getWeeklyPGPerformance
);

router.get(
  "/weekly/room-report",
  validateQuery(weeklyReportQuerySchema),
  getWeeklyRoomUtilization
);

router.get(
  "/weekly/payment-report",
  validateQuery(weeklyReportQuerySchema),
  getWeeklyPaymentAnalytics
);

router.get(
  "/weekly/financial-report",
  validateQuery(weeklyReportQuerySchema),
  getWeeklyFinancialSummary
);

// Monthly Report Table Data Routes
router.get(
  "/monthly/pg-report",
  validateQuery(monthlyReportQuerySchema),
  getMonthlyPGPerformance
);

router.get(
  "/monthly/room-report",
  validateQuery(monthlyReportQuerySchema),
  getMonthlyRoomUtilization
);

router.get(
  "/monthly/payment-report",
  validateQuery(monthlyReportQuerySchema),
  getMonthlyPaymentAnalytics
);

router.get(
  "/monthly/financial-report",
  validateQuery(monthlyReportQuerySchema),
  getMonthlyFinancialSummary
);

// Excel download route
router.get(
  "/download/:reportType",
  authenticateAdmin,
  validateQuery(reportDownloadQuerySchema),
  validateParams(reportDownloadParamsSchema),
  downloadReport
);

export default router;

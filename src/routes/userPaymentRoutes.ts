import { Router } from "express";
import {
  uploadPayment,
  getMemberPayments,
  getPaymentDetails,
  getMemberPaymentsByYear,
} from "../controllers/userPaymentController";
import { authenticateUser } from "../middlewares/auth";
import {
  validateUploadPayment,
  validatePaymentHistoryQuery,
  validatePaymentIdParam,
  validateYearParam,
  validateMonthYearParam,
} from "../validations/paymentValidation";

const router = Router();

// Upload new payment
router.post("/upload", authenticateUser, validateUploadPayment, uploadPayment);

// Get payment history for authenticated member
router.get("/history", authenticateUser, validatePaymentHistoryQuery, getMemberPayments);

// Get payment status by year for authenticated member
router.get("/year/:year", authenticateUser, validateYearParam, getMemberPaymentsByYear);

// Get specific payment details by month and year
router.get("/:month/:year", authenticateUser, validateMonthYearParam, getPaymentDetails);

export default router;
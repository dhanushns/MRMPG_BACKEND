import { Router } from "express";
import pgRoutes from "./pgRoutes";
import adminRoutes from "./adminRoutes";
import roomRoutes from "./roomRoutes";
import registrationRoutes from "./registrationRoutes";
import approvalRoutes from "./approvalRoutes";
import dashboardRoutes from "./dashboardRoutes";
import memberRoutes from "./memberRoutes";
import enquiryRoutes from "./enquiryRoutes";
import reportRoutes from "./reportRoutes";
import userRoutes from "./userRoutes";
import paymentRoutes from "./paymentRoutes";
import expenseRoutes from "./expenseRoutes";

const router = Router();

// Mount route modules
router.use("/pg", pgRoutes);
router.use("/admin", adminRoutes);
router.use("/rooms", roomRoutes);
router.use("/register", registrationRoutes);
router.use("/approval", approvalRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/members", memberRoutes);
router.use("/enquiry", enquiryRoutes);
router.use("/report", reportRoutes);
router.use("/user", userRoutes);
router.use("/payments", paymentRoutes);
router.use("/expenses", expenseRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;

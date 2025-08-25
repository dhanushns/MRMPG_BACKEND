import { Router } from "express";
import pgRoutes from "./pgRoutes";
import adminRoutes from "./adminRoutes";
import roomRoutes from "./roomRoutes";
import registrationRoutes from "./registrationRoutes";
import approvalRoutes from "./approvalRoutes";
import dashboardRoutes from "./dashboardRoutes"

const router = Router();

// Mount route modules
router.use("/pg", pgRoutes);
router.use("/admin", adminRoutes);
router.use("/rooms", roomRoutes);
router.use("/registration", registrationRoutes);
router.use("/approval", approvalRoutes);
router.use("/dashboard", dashboardRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;

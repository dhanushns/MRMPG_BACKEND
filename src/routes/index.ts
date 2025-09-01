import { Router } from "express";
import pgRoutes from "./pgRoutes";
import adminRoutes from "./adminRoutes";
import roomRoutes from "./roomRoutes";
import userRoutes from "./userRoutes";
import approvalRoutes from "./approvalRoutes";
import dashboardRoutes from "./dashboardRoutes";
import memberRoutes from "./memberRoutes";

const router = Router();

// Mount route modules
router.use("/pg", pgRoutes);
router.use("/admin", adminRoutes);
router.use("/rooms", roomRoutes);
router.use("/user", userRoutes);
router.use("/approval", approvalRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/members", memberRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;

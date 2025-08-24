import { Router } from "express";
import pgRoutes from "./pgRoutes";
import staffAuthRoutes from "./staffAuthRoutes";
import adminRoutes from "./adminRoutes";
import registrationRoutes from "./registrationRoutes";

const router = Router();

// Mount route modules
router.use("/pg", pgRoutes);
router.use("/staff", staffAuthRoutes);
router.use("/admin", adminRoutes);
router.use("/registration", registrationRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;

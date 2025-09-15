import { Router } from "express";
import {
  verifyMemberOTP,
  setupMemberPassword,
  memberLogin,
  requestNewOTP,
  changeMemberPassword,
  resetMemberPassword,
  requestPasswordResetOTP,
  getMemberProfile,
  updateMemberProfile,
  getCurrentMonthOverview,
} from "../controllers/userController";
import { authenticateUser } from "../middlewares/auth";
import { validateMemberLogin, validatePasswordSetup, validateChangePassword, validateResetPassword, validateOTPRequest, validateUpdateProfile } from "../validations/userValidation";

const router = Router();

router.post("/otp-verify", validateMemberLogin, verifyMemberOTP);

router.post("/setup-password", authenticateUser, validatePasswordSetup, setupMemberPassword);

router.post("/login", validateMemberLogin, memberLogin);

router.post("/request-otp", validateOTPRequest, requestNewOTP);

router.post("/change-password", authenticateUser, validateChangePassword, changeMemberPassword);

router.post("/request-password-reset", validateOTPRequest, requestPasswordResetOTP);

router.post("/reset-password", validateResetPassword, resetMemberPassword);

router.get("/profile", authenticateUser, getMemberProfile);

router.put("/profile", authenticateUser, validateUpdateProfile, updateMemberProfile);

router.get("/current-month-overview", authenticateUser, getCurrentMonthOverview);

export default router;
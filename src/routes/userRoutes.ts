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
  updateDigitalSignature,
} from "../controllers/userController";
import { authenticateUser } from "../middlewares/auth";
import { validateMemberLogin, validatePasswordSetup, validateChangePassword, validateResetPassword, validateOTPRequest, validateUpdateProfile, validateApplyLeavingRequest } from "../validations/userValidation";
import { documentImageUpload } from "../utils/imageUpload";

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

router.put("/digital-signature", authenticateUser, documentImageUpload.single('digitalSignature'), updateDigitalSignature);

export default router;
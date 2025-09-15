import  { Router } from "express";  
import { 
  getRegisteredMembers, 
  approveOrRejectMember, 
  getApprovalStats,
  getMembersPaymentData,
  getMembersPaymentFilterOptions,
  getMonthOptionsForYear,
  approveOrRejectPayment
} from "../controllers/approvalController";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth";
import { validateQuery, validateBody, validateParams } from "../middlewares/validation";
import { registeredMembersQuerySchema, approveRejectMemberSchema, idParamSchema } from "../validations/adminValidation";
import { approveRejectPaymentSchema, paymentIdParamSchema, memberPaymentQuerySchema } from "../validations/approvalValidation";

const router = Router();

router.use(authenticateAdmin);
router.use(authorizeAdmin);

// Approval statistics routes
router.get("/stats", getApprovalStats);

// Registered members approvals routes
router.get("/members", validateQuery(registeredMembersQuerySchema), getRegisteredMembers);
router.put("/members/:id", validateParams(idParamSchema), validateBody(approveRejectMemberSchema), approveOrRejectMember);

// Members payment data routes
router.get("/payments", validateQuery(memberPaymentQuerySchema), getMembersPaymentData);
router.get("/payments/filters", getMembersPaymentFilterOptions);
router.get("/payments/filters/months", getMonthOptionsForYear);
router.put("/payments/:paymentId", validateParams(paymentIdParamSchema), validateBody(approveRejectPaymentSchema), approveOrRejectPayment);

export default router;
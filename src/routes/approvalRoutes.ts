import  { Router } from "express";  
import { 
  getRegisteredMembers, 
  approveOrRejectMember, 
  calculateAndUpdateApprovalStats, 
  getApprovalStats,
  getMembersPaymentData,
  getMembersPaymentFilterOptions,
  approveOrRejectPayment
} from "../controllers/approvalController";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth";
import { validateQuery, validateBody, validateParams } from "../middlewares/validation";
import { registeredMembersQuerySchema, approveRejectMemberSchema, idParamSchema, membersPaymentDataQuerySchema } from "../validations/adminValidation";
import { approveRejectPaymentSchema, paymentIdParamSchema } from "../validations/approvalValidation";

const router = Router();

router.use(authenticateAdmin);
router.use(authorizeAdmin);

// Approval statistics routes
router.get("/stats", getApprovalStats);
router.post("/stats/refresh", calculateAndUpdateApprovalStats);

// Registered members approvals routes
router.get("/members", validateQuery(registeredMembersQuerySchema), getRegisteredMembers);
router.put("/members/:id", validateParams(idParamSchema), validateBody(approveRejectMemberSchema), approveOrRejectMember);

// Members payment data routes
router.get("/payments", validateQuery(membersPaymentDataQuerySchema), getMembersPaymentData);
router.get("/payments/filters", getMembersPaymentFilterOptions);
router.put("/payments/:paymentId", validateParams(paymentIdParamSchema), validateBody(approveRejectPaymentSchema), approveOrRejectPayment);

export default router;
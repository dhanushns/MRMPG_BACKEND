import { Router } from 'express';
import { 
  getAllLeavingRequests,
  approveOrRejectRequest 
} from '../controllers/leavingRequestController';
import { authenticateAdmin, authorizeAdmin } from '../middlewares/auth';
import { validateBody, validateQuery } from '../middlewares/validation';
import { 
  getAllLeavingRequestsSchema,
  approveOrRejectRequestSchema 
} from '../validations/leavingRequestValidation';

const router = Router();

router.use(authenticateAdmin)
router.use(authorizeAdmin)

// Admin authenticated routes
router.get(
  '/',
  validateQuery(getAllLeavingRequestsSchema),
  getAllLeavingRequests
);

router.patch(
  '/:id/approve-reject',
  validateBody(approveOrRejectRequestSchema),
  approveOrRejectRequest
);

export default router;
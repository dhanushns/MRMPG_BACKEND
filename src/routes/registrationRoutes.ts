import { Router } from "express";
import multer from "multer";
import {
  validatePersonalData,
  completeRegistration,
  getAllRegisteredMembers,
  getRegisteredMemberById,
  deleteRegisteredMember,
} from "../controllers/registrationController";
import { validateBody, validateParams, validateQuery } from "../middlewares/validation";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth";
import {
  validatePersonalDataSchema,
  idParamSchema,
  paginationQuerySchema,
} from "../validations/registrationValidation";
import { fileFilter } from "../utils/imageUpload";

const router = Router();

// Create multer upload for handling both images with dynamic storage
const registrationUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'profileImage') {
        cb(null, 'uploads/profile');
      } else if (file.fieldname === 'aadharImage') {
        cb(null, 'uploads/aadhar');
      } else {
        cb(new Error('Invalid field name'), '');
      }
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const randomNum = Math.round(Math.random() * 1E9);
      const extension = file.originalname.split('.').pop();
      cb(null, `${timestamp}-${randomNum}.${extension}`);
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 2 // Profile + Aadhar
  }
});

// Public routes for member registration


router.post("/validate", 
  validateBody(validatePersonalDataSchema), 
  validatePersonalData
);

router.post("/",
  registrationUpload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'aadharImage', maxCount: 1 }
  ]),
  completeRegistration
);

// Admin-protected routes for managing registered members
router.use(authenticateAdmin);
router.use(authorizeAdmin);

router.get("/", validateQuery(paginationQuerySchema), getAllRegisteredMembers);
router.get("/:id", validateParams(idParamSchema), getRegisteredMemberById);
router.delete("/:id", validateParams(idParamSchema), deleteRegisteredMember);

export default router;

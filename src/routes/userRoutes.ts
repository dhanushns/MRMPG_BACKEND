import { Router } from "express";
import multer from "multer";
import {
  validatePersonalData,
  completeRegistration,
  submitPayment,
} from "../controllers/userController";
import { validateBody, validateParams, validateQuery } from "../middlewares/validation";
import {
  validatePersonalDataSchema,
  submitPaymentSchema,
} from "../validations/userValidation";
import { fileFilter } from "../utils/imageUpload";

const router = Router();


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

const paymentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'rentBillScreenshot' || file.fieldname === 'electricityBillScreenshot') {
        cb(null, 'uploads/payment');
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
    files: 2 // Rent bill + Electricity bill
  }
});

// Public routes for member registration


router.post("/validate", 
  validateBody(validatePersonalDataSchema), 
  validatePersonalData
);

router.post("/register",
  registrationUpload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'aadharImage', maxCount: 1 }
  ]),
  completeRegistration
);

router.post("/payment",
  paymentUpload.fields([
    { name: 'rentBillScreenshot', maxCount: 1 },
    { name: 'electricityBillScreenshot', maxCount: 1 }
  ]),
  validateBody(submitPaymentSchema),
  submitPayment
);

export default router;

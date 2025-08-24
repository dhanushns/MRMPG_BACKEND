import { Router } from "express";
import {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomOccupancyStats,
} from "../controllers/roomController";
import { validateBody, validateParams, validateQuery } from "../middlewares/validation";
import {
  createRoomSchema,
  updateRoomSchema,
  idParamSchema,
  paginationQuerySchema,
  roomFilterQuerySchema,
} from "../validations/roomValidation";
import { authenticateStaff, authorizeStaff } from "../middlewares/auth";

const router = Router();

// Protected rooms routes for authenticated staff
router.use(authenticateStaff);
router.use(authorizeStaff);

router.post("/", validateBody(createRoomSchema), createRoom);
router.get("/", validateQuery(roomFilterQuerySchema), getAllRooms);
router.get("/occupancy-stats", getRoomOccupancyStats);
router.get("/:id", validateParams(idParamSchema), getRoomById);
router.put("/:id", validateParams(idParamSchema), validateBody(updateRoomSchema), updateRoom);
router.delete("/:id", validateParams(idParamSchema), deleteRoom);

export default router;

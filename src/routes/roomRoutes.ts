import { Router } from "express";
import {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomsByLocation,
} from "../controllers/roomController";
import { validateBody, validateParams, validateQuery } from "../middlewares/validation";
import { authenticateAdmin, authorizeAdmin } from "../middlewares/auth";
import {
  createRoomSchema,
  updateRoomSchema,
  pgIdParamSchema,
  pgIdAndRoomIdParamSchema,
  locationParamSchema,
  roomFilterQuerySchema,
} from "../validations/roomValidation";

const router = Router();

// All routes require authentication and authorization
router.use(authenticateAdmin);
router.use(authorizeAdmin);

// GET /rooms/location/:location - Get rooms by location
router.get("/location/:location", validateParams(locationParamSchema), getRoomsByLocation);

// GET /rooms/:pgId - Get all rooms of a specific PG
router.get("/:pgId", validateParams(pgIdParamSchema), validateQuery(roomFilterQuerySchema), getRooms);

// GET /rooms/:pgId/:roomId - Get a specific room by ID
router.get("/:pgId/:roomId", validateParams(pgIdAndRoomIdParamSchema), getRoomById);

// POST /rooms/:pgId - Create a new room in a specific PG
router.post("/:pgId", validateParams(pgIdParamSchema), validateBody(createRoomSchema), createRoom);

// PUT /rooms/:pgId/:roomId - Update a specific room
router.put("/:pgId/:roomId", validateParams(pgIdAndRoomIdParamSchema), validateBody(updateRoomSchema), updateRoom);

// DELETE /rooms/:pgId/:roomId - Delete a specific room
router.delete("/:pgId/:roomId", validateParams(pgIdAndRoomIdParamSchema), deleteRoom);

export default router;

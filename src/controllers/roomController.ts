import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { CreateRoomRequest, UpdateRoomRequest } from "../types/request";
import { AuthenticatedRequest } from "../middlewares/auth";

// GET all rooms of a specific PG
export const getRooms = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { pgId } = req.params;

    if (!pgId) {
      res.status(400).json({
        success: false,
        message: "PG ID is required",
      } as ApiResponse<null>);
      return;
    }

    // Get admin details to verify pgType
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { pgType: true },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      } as ApiResponse<null>);
      return;
    }

    // Verify PG exists and matches admin's PG type
    const pg = await prisma.pG.findUnique({
      where: { id: pgId },
    });

    if (!pg) {
      res.status(404).json({
        success: false,
        message: "PG not found",
      } as ApiResponse<null>);
      return;
    }

    if (pg.type !== admin.pgType) {
      res.status(403).json({
        success: false,
        message: "You can only manage rooms of your PG type",
      } as ApiResponse<null>);
      return;
    }

    // Get all rooms for this PG with member count
    const rooms = await prisma.room.findMany({
      where: { pGId: pgId },
      include: {
        members: {
          select: {
            id: true,
            memberId: true,
            name: true,
            gender: true,
            rentType: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        roomNo: "asc",
      },
    });

    // Transform data to include occupancy info
    const roomsWithOccupancy = rooms.map((room) => ({
      ...room,
      currentOccupancy: room._count.members,
      availableSlots: room.capacity - room._count.members,
      isFullyOccupied: room._count.members >= room.capacity,
    }));

    res.status(200).json({
      success: true,
      message: "Rooms retrieved successfully",
      data: roomsWithOccupancy,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting rooms:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve rooms",
    } as ApiResponse<null>);
  }
};

// GET single room by ID
export const getRoomById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { pgId, roomId } = req.params;

    if (!pgId || !roomId) {
      res.status(400).json({
        success: false,
        message: "PG ID and Room ID are required",
      } as ApiResponse<null>);
      return;
    }

    // Get admin details to verify pgType
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { pgType: true },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      } as ApiResponse<null>);
      return;
    }

    // Verify PG exists and matches admin's PG type
    const pg = await prisma.pG.findUnique({
      where: { id: pgId },
    });

    if (!pg) {
      res.status(404).json({
        success: false,
        message: "PG not found",
      } as ApiResponse<null>);
      return;
    }

    if (pg.type !== admin.pgType) {
      res.status(403).json({
        success: false,
        message: "You can only access rooms of your PG type",
      } as ApiResponse<null>);
      return;
    }

    // Get room with detailed member information
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        pGId: pgId,
      },
      include: {
        members: {
          select: {
            id: true,
            memberId: true,
            name: true,
            age: true,
            gender: true,
            email: true,
            phone: true,
            work: true,
            rentType: true,
            advanceAmount: true,
            dateOfJoining: true,
          },
        },
        PG: {
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      } as ApiResponse<null>);
      return;
    }

    // Add occupancy info
    const roomWithOccupancy = {
      ...room,
      currentOccupancy: room._count.members,
      availableSlots: room.capacity - room._count.members,
      isFullyOccupied: room._count.members >= room.capacity,
    };

    res.status(200).json({
      success: true,
      message: "Room retrieved successfully",
      data: roomWithOccupancy,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting room:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve room",
    } as ApiResponse<null>);
  }
};

// CREATE new room
export const createRoom = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { pgId } = req.params;
    const { roomNo, rent, capacity }: CreateRoomRequest = req.body;

    if (!pgId) {
      res.status(400).json({
        success: false,
        message: "PG ID is required",
      } as ApiResponse<null>);
      return;
    }

    // Get admin details to verify pgType
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { pgType: true },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      } as ApiResponse<null>);
      return;
    }

    // Verify PG exists and matches admin's PG type
    const pg = await prisma.pG.findUnique({
      where: { id: pgId },
    });

    if (!pg) {
      res.status(404).json({
        success: false,
        message: "PG not found",
      } as ApiResponse<null>);
      return;
    }

    if (pg.type !== admin.pgType) {
      res.status(403).json({
        success: false,
        message: "You can only create rooms for your PG type",
      } as ApiResponse<null>);
      return;
    }

    // Check if room number already exists in this PG
    const existingRoom = await prisma.room.findFirst({
      where: {
        roomNo,
        pGId: pgId,
      },
    });

    if (existingRoom) {
      res.status(409).json({
        success: false,
        message: "Room number already exists in this PG",
      } as ApiResponse<null>);
      return;
    }

    // Create new room
    const newRoom = await prisma.room.create({
      data: {
        roomNo,
        rent,
        capacity,
        pGId: pgId,
      },
      include: {
        PG: {
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    // Add occupancy info
    const roomWithOccupancy = {
      ...newRoom,
      currentOccupancy: 0,
      availableSlots: newRoom.capacity,
      isFullyOccupied: false,
    };

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: roomWithOccupancy,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to create room",
    } as ApiResponse<null>);
  }
};

// UPDATE room
export const updateRoom = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { pgId, roomId } = req.params;
    const { roomNo, rent, capacity }: UpdateRoomRequest = req.body;

    if (!pgId || !roomId) {
      res.status(400).json({
        success: false,
        message: "PG ID and Room ID are required",
      } as ApiResponse<null>);
      return;
    }

    // Validate at least one field is provided
    if (!roomNo && !rent && !capacity) {
      res.status(400).json({
        success: false,
        message: "At least one field must be provided for update",
      } as ApiResponse<null>);
      return;
    }

    // Get admin details to verify pgType
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { pgType: true },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      } as ApiResponse<null>);
      return;
    }

    // Verify PG exists and matches admin's PG type
    const pg = await prisma.pG.findUnique({
      where: { id: pgId },
    });

    if (!pg) {
      res.status(404).json({
        success: false,
        message: "PG not found",
      } as ApiResponse<null>);
      return;
    }

    if (pg.type !== admin.pgType) {
      res.status(403).json({
        success: false,
        message: "You can only update rooms of your PG type",
      } as ApiResponse<null>);
      return;
    }

    // Check if room exists in this PG
    const existingRoom = await prisma.room.findFirst({
      where: {
        id: roomId,
        pGId: pgId,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!existingRoom) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      } as ApiResponse<null>);
      return;
    }

    // If updating capacity, ensure it's not less than current occupancy
    if (capacity !== undefined && capacity < existingRoom._count.members) {
      res.status(400).json({
        success: false,
        message: `Cannot reduce capacity below current occupancy (${existingRoom._count.members} members)`,
      } as ApiResponse<null>);
      return;
    }

    // If updating room number, check if it already exists in this PG
    if (roomNo && roomNo !== existingRoom.roomNo) {
      const roomWithSameNumber = await prisma.room.findFirst({
        where: {
          roomNo,
          pGId: pgId,
          id: { not: roomId },
        },
      });

      if (roomWithSameNumber) {
        res.status(409).json({
          success: false,
          message: "Room number already exists in this PG",
        } as ApiResponse<null>);
        return;
      }
    }

    // Update room
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(roomNo && { roomNo }),
        ...(rent !== undefined && { rent }),
        ...(capacity !== undefined && { capacity }),
      },
      include: {
        PG: {
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
          },
        },
        members: {
          select: {
            id: true,
            memberId: true,
            name: true,
            gender: true,
            rentType: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    // Add occupancy info
    const roomWithOccupancy = {
      ...updatedRoom,
      currentOccupancy: updatedRoom._count.members,
      availableSlots: updatedRoom.capacity - updatedRoom._count.members,
      isFullyOccupied: updatedRoom._count.members >= updatedRoom.capacity,
    };

    res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: roomWithOccupancy,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error updating room:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to update room",
    } as ApiResponse<null>);
  }
};

// DELETE room
export const deleteRoom = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { pgId, roomId } = req.params;

    if (!pgId || !roomId) {
      res.status(400).json({
        success: false,
        message: "PG ID and Room ID are required",
      } as ApiResponse<null>);
      return;
    }

    // Get admin details to verify pgType
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { pgType: true },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      } as ApiResponse<null>);
      return;
    }

    // Verify PG exists and matches admin's PG type
    const pg = await prisma.pG.findUnique({
      where: { id: pgId },
    });

    if (!pg) {
      res.status(404).json({
        success: false,
        message: "PG not found",
      } as ApiResponse<null>);
      return;
    }

    if (pg.type !== admin.pgType) {
      res.status(403).json({
        success: false,
        message: "You can only delete rooms of your PG type",
      } as ApiResponse<null>);
      return;
    }

    // Check if room exists and has no members
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        pGId: pgId,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      } as ApiResponse<null>);
      return;
    }

    // Check if room has members
    if (room._count.members > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete room with ${room._count.members} members. Please move members to other rooms first.`,
      } as ApiResponse<null>);
      return;
    }

    // Delete room
    await prisma.room.delete({
      where: { id: roomId },
    });

    res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    } as ApiResponse<null>);
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to delete room",
    } as ApiResponse<null>);
  }
};

// GET rooms by location
export const getRoomsByLocation = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { location } = req.params;

    if (!location) {
      res.status(400).json({
        success: false,
        message: "Location is required",
      } as ApiResponse<null>);
      return;
    }

    // Get admin details to know their pgType
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { pgType: true },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      } as ApiResponse<null>);
      return;
    }

    // Get the PGs of admin's type that match the location
    const pgs = await prisma.pG.findFirst({
      where: {
        type: admin.pgType,
        location: {
          equals: location,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (!pgs) {
      res.status(200).json({
        success: true,
        message: "No PGs found for the specified location and PG type",
        data: [],
      } as ApiResponse<any>);
      return;
    }

    const rooms = await prisma.room.findMany({
      where: {
        pGId: pgs.id,
      },
      select: {
        roomNo: true,
        rent: true,
      },
      orderBy: {
        roomNo: "asc",
      },
    });

    res.status(200).json({
      success: true,
      message: "Rooms retrieved successfully by location",
      data: {
        pgId: pgs.id,
        rooms,
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting rooms by location:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve rooms by location",
    } as ApiResponse<null>);
  }
};

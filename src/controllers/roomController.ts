import { Request, Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse, PaginatedResponse } from "../types/response";
import { AuthenticatedRequest } from "../middlewares/auth";
import { CreateRoomRequest, UpdateRoomRequest } from "types/request";

// Create a new room 
export const createRoom = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check staff authentication
    if (!req.staff) {
      res.status(401).json({
        success: false,
        message: "Staff authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { roomNo, rent, capacity }: CreateRoomRequest = req.body;

    // Validate required fields
    if (!roomNo || !rent || !capacity) {
      res.status(400).json({
        success: false,
        message: "All fields are required",
        error: "roomNo, rent, and capacity are required fields",
      } as ApiResponse<null>);
      return;
    }

    // Check if room number already exists in the staff's PG
    const existingRoom = await prisma.room.findFirst({
      where: {
        roomNo,
        pGId: req.staff.pgId,
      },
    });

    if (existingRoom) {
      res.status(409).json({
        success: false,
        message: "Room number already exists in this PG",
        error: "A room with this number already exists in your PG",
      } as ApiResponse<null>);
      return;
    }

    // Create new room
    const newRoom = await prisma.room.create({
      data: {
        roomNo,
        rent,
        capacity,
        pGId: req.staff.pgId,
      },
      include: {
        PG: true,
        members: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: newRoom,
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

// Get all rooms for staff's assigned PG with filtering
export const getAllRooms = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check staff authentication
    if (!req.staff) {
      res.status(401).json({
        success: false,
        message: "Staff authentication required",
      } as ApiResponse<null>);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Extract filter parameters
    const {
      occupancyStatus,
      minRent,
      maxRent,
      minCapacity,
      maxCapacity
    } = req.query;

    // Build where condition for filters
    const whereCondition: any = {
      pGId: req.staff.pgId,
    };

    // Add rent filters
    if (minRent || maxRent) {
      whereCondition.rent = {};
      if (minRent) whereCondition.rent.gte = parseFloat(minRent as string);
      if (maxRent) whereCondition.rent.lte = parseFloat(maxRent as string);
    }

    // Add capacity filters
    if (minCapacity || maxCapacity) {
      whereCondition.capacity = {};
      if (minCapacity) whereCondition.capacity.gte = parseInt(minCapacity as string);
      if (maxCapacity) whereCondition.capacity.lte = parseInt(maxCapacity as string);
    }

    // Get all rooms with members for occupancy filtering
    const allRooms = await prisma.room.findMany({
      where: whereCondition,
      include: {
        PG: true,
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Apply occupancy status filter
    let filteredRooms = allRooms;
    if (occupancyStatus) {
      filteredRooms = allRooms.filter(room => {
        const occupiedCount = room.members.length;
        const capacity = room.capacity;
        
        switch (occupancyStatus) {
          case 'fully_occupied':
            return occupiedCount >= capacity;
          case 'vacant':
            return occupiedCount === 0;
          case 'partially_occupied':
            return occupiedCount > 0 && occupiedCount < capacity;
          default:
            return true;
        }
      });
    }

    // Apply pagination to filtered results
    const total = filteredRooms.length;
    const paginatedRooms = filteredRooms.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    // Add occupancy info to each room
    const roomsWithOccupancy = paginatedRooms.map(room => ({
      ...room,
      occupancyInfo: {
        occupied: room.members.length,
        capacity: room.capacity,
        vacancy: room.capacity - room.members.length,
        status: room.members.length === 0 ? 'vacant' :
                room.members.length >= room.capacity ? 'fully_occupied' : 'partially_occupied'
      }
    }));

    res.status(200).json({
      success: true,
      message: "Rooms retrieved successfully",
      data: roomsWithOccupancy,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      appliedFilters: {
        occupancyStatus,
        minRent: minRent ? parseFloat(minRent as string) : undefined,
        maxRent: maxRent ? parseFloat(maxRent as string) : undefined,
        minCapacity: minCapacity ? parseInt(minCapacity as string) : undefined,
        maxCapacity: maxCapacity ? parseInt(maxCapacity as string) : undefined,
      },
    } as PaginatedResponse<any>);
  } catch (error) {
    console.error("Error getting rooms:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve rooms",
    } as ApiResponse<null>);
  }
};

// Get room by ID (only if it belongs to staff's PG)
export const getRoomById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check staff authentication
    if (!req.staff) {
      res.status(401).json({
        success: false,
        message: "Staff authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { id } = req.params;

    // Find room only within staff's PG
    const room = await prisma.room.findFirst({
      where: {
        id,
        pGId: req.staff.pgId,
      },
      include: {
        PG: true,
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            memberId: true,
          },
        },
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found or does not belong to your PG",
      } as ApiResponse<null>);
      return;
    }

    res.status(200).json({
      success: true,
      message: "Room retrieved successfully",
      data: room,
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


export const updateRoom = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check staff authentication
    if (!req.staff) {
      res.status(401).json({
        success: false,
        message: "Staff authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { id } = req.params;
    const updateData: UpdateRoomRequest = req.body;

    // Check if room exists and belongs to staff's PG
    const existingRoom = await prisma.room.findFirst({
      where: {
        id,
        pGId: req.staff.pgId,
      },
    });

    if (!existingRoom) {
      res.status(404).json({
        success: false,
        message: "Room not found or does not belong to your PG",
      } as ApiResponse<null>);
      return;
    }

    // Check if roomNo already exists in the PG (if being updated)
    if (updateData.roomNo && updateData.roomNo !== existingRoom.roomNo) {
      const roomNoExists = await prisma.room.findFirst({
        where: {
          roomNo: updateData.roomNo,
          pGId: req.staff.pgId,
          id: {
            not: id, // Exclude current room
          },
        },
      });

      if (roomNoExists) {
        res.status(409).json({
          success: false,
          message: "Room number already exists in this PG",
        } as ApiResponse<null>);
        return;
      }
    }

    // Update room
    const updatedRoom = await prisma.room.update({
      where: { id },
      data: updateData,
      include: {
        PG: true,
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            memberId: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: updatedRoom,
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

// Delete room (only if it belongs to staff's PG)
export const deleteRoom = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check staff authentication
    if (!req.staff) {
      res.status(401).json({
        success: false,
        message: "Staff authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { id } = req.params;

    // Check if room exists and belongs to staff's PG
    const existingRoom = await prisma.room.findFirst({
      where: {
        id,
        pGId: req.staff.pgId,
      },
      include: {
        members: true,
      },
    });

    if (!existingRoom) {
      res.status(404).json({
        success: false,
        message: "Room not found or does not belong to your PG",
      } as ApiResponse<null>);
      return;
    }

    // Check if room has members assigned
    if (existingRoom.members && existingRoom.members.length > 0) {
      res.status(409).json({
        success: false,
        message: "Cannot delete room with assigned members",
        error: `Room has ${existingRoom.members.length} member(s) assigned. Please reassign or remove members first.`,
      } as ApiResponse<null>);
      return;
    }

    // Delete room
    await prisma.room.delete({
      where: { id },
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

// Get room occupancy statistics for staff's PG
export const getRoomOccupancyStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check staff authentication
    if (!req.staff) {
      res.status(401).json({
        success: false,
        message: "Staff authentication required",
      } as ApiResponse<null>);
      return;
    }

    // Get room occupancy data for staff's PG
    const rooms = await prisma.room.findMany({
      where: {
        pGId: req.staff.pgId,
      },
      include: {
        members: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Calculate statistics
    const stats = {
      totalRooms: rooms.length,
      occupiedRooms: rooms.filter(room => room.members.length > 0).length,
      vacantRooms: rooms.filter(room => room.members.length === 0).length,
      totalCapacity: rooms.reduce((sum, room) => sum + room.capacity, 0),
      totalOccupied: rooms.reduce((sum, room) => sum + room.members.length, 0),
      occupancyRate: 0,
      rooms: rooms.map(room => ({
        id: room.id,
        roomNo: room.roomNo,
        capacity: room.capacity,
        occupied: room.members.length,
        vacancy: room.capacity - room.members.length,
        rent: room.rent,
        isFullyOccupied: room.members.length >= room.capacity,
        members: room.members,
      })),
    };

    // Calculate occupancy rate
    if (stats.totalCapacity > 0) {
      stats.occupancyRate = Math.round((stats.totalOccupied / stats.totalCapacity) * 100);
    }

    res.status(200).json({
      success: true,
      message: "Room occupancy statistics retrieved successfully",
      data: stats,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting room occupancy stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve room occupancy statistics",
    } as ApiResponse<null>);
  }
};

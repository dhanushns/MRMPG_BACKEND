import { Request, Response } from "express";
import prisma from "../config/prisma";
import { StaffLoginRequest, GetMembersFilterRequest } from "../types/request";
import { ApiResponse, StaffResponse, StaffWithPGResponse, PaginatedResponse, StaffLoginResponse, MemberWithRoomResponse, MembersPaginatedResponse } from "../types/response";
import { AuthenticatedRequest } from "../middlewares/auth";
import { hashPassword, comparePassword, generateStaffToken } from "../utils/auth";
import { generateUniqueMemberId } from "../utils/memberIdGenerator";
import { deleteImage, ImageType } from "../utils/imageUpload";

// Staff login
export const staffLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: StaffLoginRequest = req.body;

    // Find staff with PG data
    const staff = await prisma.staff.findUnique({
      where: { email },
      include: {
        pg: true,
      },
    });

    if (!staff) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      } as ApiResponse<null>);
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, staff.password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      } as ApiResponse<null>);
      return;
    }

    // Generate JWT token with staff and PG data
    const token = generateStaffToken({
      id: staff.id,
      email: staff.email,
      name: staff.name,
      pgId: staff.pgId,
    });

    // Prepare staff response (excluding password)
    const staffResponse: StaffWithPGResponse = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      pgId: staff.pgId,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
      pg: staff.pg,
    };

    res.status(200).json({
      success: true,
      message: "Staff login successful",
      data: {
        staff: staffResponse,
        token,
        expiresIn: "24h",
      },
    } as ApiResponse<StaffLoginResponse>);
  } catch (error) {
    console.error("Error during staff login:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to authenticate staff",
    } as ApiResponse<null>);
  }
};

// Get PG registered members
export const getRegisteredMembersByStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;


    // Get staff's PG details
    const staffPG = await prisma.pG.findUnique({
      where: { id: req.staff?.pgId },
    });

    if (!staffPG) {
      res.status(404).json({
        success: false,
        message: "Staff's assigned PG not found",
      } as ApiResponse<null>);
      return;
    }

    // Filter registered members based on staff's PG type and location
    const whereCondition = {
      pgType: staffPG.type,
      pgLocation: staffPG.location,
    };

    // Get total count for pagination
    const total = await prisma.registeredMember.count({
      where: whereCondition,
    });

    // Get registered members matching staff's PG criteria
    const registeredMembers = await prisma.registeredMember.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Registered members retrieved successfully",
      data: registeredMembers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filterCriteria: {
        pgType: staffPG.type,
        pgLocation: staffPG.location,
        staffPGName: staffPG.name,
      },
    } as PaginatedResponse<any>);
  } catch (error) {
    console.error("Error getting registered members by staff:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve registered members",
    } as ApiResponse<null>);
  }
};

// Approve or reject registered member
export const processRegisteredMemberApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { registeredMemberId } = req.params;
    const { status, roomNo, advanceAmount } = req.body;

    // Validate status
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status. Must be APPROVED or REJECTED",
      } as ApiResponse<null>);
      return;
    }

    // Find the registered member
    const registeredMember = await prisma.registeredMember.findUnique({
      where: { id: registeredMemberId },
    });

    if (!registeredMember) {
      res.status(404).json({
        success: false,
        message: "Registered member not found",
      } as ApiResponse<null>);
      return;
    }

    // Get staff's PG details
    const staffPG = await prisma.pG.findUnique({
      where: { id: req.staff?.pgId },
    });

    if (!staffPG) {
      res.status(404).json({
        success: false,
        message: "Staff's assigned PG not found",
      } as ApiResponse<null>);
      return;
    }

    // Verify that this registered member belongs to staff's PG criteria
    if (registeredMember.pgType !== staffPG.type || registeredMember.pgLocation !== staffPG.location) {
      res.status(403).json({
        success: false,
        message: "You can only process applications for your assigned PG type and location",
      } as ApiResponse<null>);
      return;
    }

    if (status === 'APPROVED') {
      // Validation for approval
      if (!roomNo || advanceAmount === undefined || advanceAmount < 0) {
        res.status(400).json({
          success: false,
          message: "Room number and valid advance amount are required for approval",
        } as ApiResponse<null>);
        return;
      }

      // Find the room in staff's PG
      const room = await prisma.room.findFirst({
        where: {
          roomNo: roomNo,
          pGId: staffPG.id,
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
          message: `Room ${roomNo} not found in your assigned PG`,
        } as ApiResponse<null>);
        return;
      }

      // Check if room has capacity
      if (room._count.members >= room.capacity) {
        res.status(400).json({
          success: false,
          message: `Room ${roomNo} is already at full capacity`,
        } as ApiResponse<null>);
        return;
      }

      try {
        // Generate unique member ID
        const memberId = await generateUniqueMemberId();

        // Create new member from registered member data
        const newMember = await prisma.member.create({
          data: {
            memberId,
            name: registeredMember.name,
            age: registeredMember.age,
            gender: registeredMember.gender,
            location: registeredMember.location,
            email: registeredMember.email,
            phone: registeredMember.phone,
            work: registeredMember.work,
            photoUrl: registeredMember.photoUrl,
            aadharUrl: registeredMember.aadharUrl,
            rentType: registeredMember.rentType,
            advanceAmount: parseFloat(advanceAmount.toString()),
            pgId: staffPG.id,
            roomId: room.id,
            dateOfJoining: new Date(),
          },
        });

        // Delete from registered members table
        await prisma.registeredMember.delete({
          where: { id: registeredMemberId },
        });

        res.status(200).json({
          success: true,
          message: `Member application approved successfully. Member ID: ${memberId}`,
          data: {
            member: newMember,
            assignedRoom: {
              id: room.id,
              roomNo: room.roomNo,
              rent: room.rent,
            },
          },
        } as ApiResponse<any>);
      } catch (dbError: any) {
        console.error("Database error during member approval:", dbError);
        
        // Handle unique constraint violations
        if (dbError.code === 'P2002') {
          res.status(400).json({
            success: false,
            message: "Email or phone number already exists in the system",
          } as ApiResponse<null>);
          return;
        }

        throw dbError;
      }
    } else {
      // REJECTED - delete registered member and their images
      try {
        // Delete uploaded images if they exist
        const imageDeletionPromises = [];
        
        if (registeredMember.photoUrl) {
          const photoFilename = registeredMember.photoUrl.split('/').pop();
          if (photoFilename) {
            imageDeletionPromises.push(deleteImage(photoFilename, ImageType.PROFILE));
          }
        }

        if (registeredMember.aadharUrl) {
          const aadharFilename = registeredMember.aadharUrl.split('/').pop();
          if (aadharFilename) {
            imageDeletionPromises.push(deleteImage(aadharFilename, ImageType.AADHAR));
          }
        }

        // Wait for all image deletions (don't fail if some images can't be deleted)
        await Promise.allSettled(imageDeletionPromises);

        // Delete from registered members table
        await prisma.registeredMember.delete({
          where: { id: registeredMemberId },
        });

        res.status(200).json({
          success: true,
          message: "Member application rejected and removed from system",
          data: {
            rejectedMember: {
              id: registeredMember.id,
              name: registeredMember.name,
              email: registeredMember.email,
            },
          },
        } as ApiResponse<any>);
      } catch (deleteError) {
        console.error("Error during rejection process:", deleteError);
        res.status(500).json({
          success: false,
          message: "Error processing rejection",
          error: "Failed to remove rejected member data",
        } as ApiResponse<null>);
        return;
      }
    }
  } catch (error) {
    console.error("Error processing registered member application:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to process member application",
    } as ApiResponse<null>);
  }
};

// Get all members of staff's PG with filters
export const getMembersByStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      gender,
      rentType,
      roomNo,
      ageMin,
      ageMax,
      advanceAmountMin,
      advanceAmountMax,
      dateJoinedFrom,
      dateJoinedTo
    }: GetMembersFilterRequest = req.query;

    // Get staff details from authenticated request
    if (!req.staff) {
      res.status(401).json({
        success: false,
        message: "Staff authentication required",
      } as ApiResponse<null>);
      return;
    }

    const staffPG = await prisma.pG.findUnique({
      where: { id: req.staff.pgId },
    });

    if (!staffPG) {
      res.status(404).json({
        success: false,
        message: "Staff's assigned PG not found",
      } as ApiResponse<null>);
      return;
    }

    const skip = (page - 1) * limit;
    
    const whereCondition: any = {
      pgId: staffPG.id, 
    };

    const appliedFilters: string[] = [];

    if (search) {
      whereCondition.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { memberId: { contains: search, mode: 'insensitive' } },
      ];
      appliedFilters.push(`search: "${search}"`);
    }

    // Gender filter
    if (gender) {
      whereCondition.gender = gender;
      appliedFilters.push(`gender: ${gender}`);
    }

    // Rent type filter
    if (rentType) {
      whereCondition.rentType = rentType;
      appliedFilters.push(`rentType: ${rentType}`);
    }

    // Room number filter
    if (roomNo) {
      whereCondition.room = {
        roomNo: roomNo
      };
      appliedFilters.push(`roomNo: ${roomNo}`);
    }

    // Age range filter
    if (ageMin !== undefined || ageMax !== undefined) {
      whereCondition.age = {};
      if (ageMin !== undefined) {
        whereCondition.age.gte = ageMin;
        appliedFilters.push(`ageMin: ${ageMin}`);
      }
      if (ageMax !== undefined) {
        whereCondition.age.lte = ageMax;
        appliedFilters.push(`ageMax: ${ageMax}`);
      }
    }

    // Advance amount range filter
    if (advanceAmountMin !== undefined || advanceAmountMax !== undefined) {
      whereCondition.advanceAmount = {};
      if (advanceAmountMin !== undefined) {
        whereCondition.advanceAmount.gte = advanceAmountMin;
        appliedFilters.push(`advanceAmountMin: ${advanceAmountMin}`);
      }
      if (advanceAmountMax !== undefined) {
        whereCondition.advanceAmount.lte = advanceAmountMax;
        appliedFilters.push(`advanceAmountMax: ${advanceAmountMax}`);
      }
    }

    // Date joined range filter
    if (dateJoinedFrom || dateJoinedTo) {
      whereCondition.dateOfJoining = {};
      if (dateJoinedFrom) {
        whereCondition.dateOfJoining.gte = new Date(dateJoinedFrom);
        appliedFilters.push(`dateJoinedFrom: ${dateJoinedFrom}`);
      }
      if (dateJoinedTo) {
        whereCondition.dateOfJoining.lte = new Date(dateJoinedTo);
        appliedFilters.push(`dateJoinedTo: ${dateJoinedTo}`);
      }
    }

    // Get total count for pagination (filtered)
    const total = await prisma.member.count({
      where: whereCondition,
    });

    // Get total members count (unfiltered) for summary
    const totalMembersInPG = await prisma.member.count({
      where: { pgId: staffPG.id },
    });

    // Get members with room details
    const members = await prisma.member.findMany({
      where: whereCondition,
      include: {
        room: {
          select: {
            id: true,
            roomNo: true,
            rent: true,
            capacity: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        dateOfJoining: 'desc', // Most recent first
      },
    });

    const totalPages = Math.ceil(total / limit);

    const response: MembersPaginatedResponse = {
      success: true,
      message: "Members retrieved successfully",
      data: members as MemberWithRoomResponse[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filterSummary: {
        totalMembers: totalMembersInPG,
        filteredCount: total,
        pgName: staffPG.name,
        appliedFilters,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting members by staff:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve members",
    } as ApiResponse<null>);
  }
};
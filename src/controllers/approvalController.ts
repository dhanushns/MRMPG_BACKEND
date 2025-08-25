import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { ApproveRejectMemberRequest } from "../types/request";
import { AuthenticatedRequest } from "../middlewares/auth";
import { generateUniqueMemberId } from "../utils/memberIdGenerator";
import { sendEmail, createApprovalEmailContent, createRejectionEmailContent } from "../utils/emailService";
import { deleteImage, ImageType } from "../utils/imageUpload";

// GET registered members of pgType
export const getRegisteredMembers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
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

    // Get pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Optional filters
    const search = req.query.search as string;
    const gender = req.query.gender as string;
    const rentType = req.query.rentType as string;

    // Build where clause
    const whereClause: any = {
      pgType: admin.pgType,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (gender) {
      whereClause.gender = gender;
    }

    if (rentType) {
      whereClause.rentType = rentType;
    }

    // Get total count for pagination
    const total = await prisma.registeredMember.count({
      where: whereClause,
    });

    // Get registered members
    const registeredMembers = await prisma.registeredMember.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      message: "Registered members retrieved successfully",
      data: registeredMembers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting registered members:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve registered members",
    } as ApiResponse<null>);
  }
};

// Approve or reject registered member
export const approveOrRejectMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      } as ApiResponse<null>);
      return;
    }

    const { id } = req.params;
    const { status, pgId, roomNo, rentAmount, advanceAmount, dateOfJoining }: ApproveRejectMemberRequest = req.body;

    // Validate required fields
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status. Must be APPROVED or REJECTED",
      } as ApiResponse<null>);
      return;
    }

    // Find the registered member
    const registeredMember = await prisma.registeredMember.findUnique({
      where: { id },
    });

    if (!registeredMember) {
      res.status(404).json({
        success: false,
        message: "Registered member not found",
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

    // Verify admin can manage this registered member (same pgType)
    if (registeredMember.pgType !== admin.pgType) {
      res.status(403).json({
        success: false,
        message: "You can only manage members of your PG type",
      } as ApiResponse<null>);
      return;
    }

    if (status === 'REJECTED') {
      // Delete the registered member record
      await prisma.registeredMember.delete({
        where: { id },
      });

      // Send rejection email notification
      try {
        const emailContent = createRejectionEmailContent(registeredMember.name, registeredMember.pgType);
        await sendEmail({
          to: registeredMember.email,
          subject: `Application Update - ${registeredMember.name}`,
          body: emailContent,
        });
        console.log(`Rejection email sent to ${registeredMember.email}`);
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
      }

      // Delete the uploaded images
      await deleteImage(registeredMember.photoUrl || "", ImageType.PROFILE);
      await deleteImage(registeredMember.aadharUrl || "", ImageType.AADHAR);

      res.status(200).json({
        success: true,
        message: "Member registration rejected and removed successfully",
      } as ApiResponse<null>);
      return;
    }

    // For APPROVED status, validate additional required fields
    if (!pgId) {
      res.status(400).json({
        success: false,
        message: "pgId is required for approval",
      } as ApiResponse<null>);
      return;
    }

    // Validate PG exists and is of the correct type
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
        message: "PG type does not match your admin type",
      } as ApiResponse<null>);
      return;
    }

    // Validate room if roomNo is provided
    let roomId: string | undefined;
    if (roomNo) {
      const room = await prisma.room.findFirst({
        where: {
          roomNo,
          pGId: pgId,
        },
      });

      if (!room) {
        res.status(404).json({
          success: false,
          message: "Room not found in the specified PG",
        } as ApiResponse<null>);
        return;
      }

      // Check room capacity
      const currentOccupancy = await prisma.member.count({
        where: { roomId: room.id },
      });

      if (currentOccupancy >= room.capacity) {
        res.status(400).json({
          success: false,
          message: "Room is at full capacity",
        } as ApiResponse<null>);
        return;
      }

      roomId = room.id;
    }

    // Generate unique member ID
    const uniqueMemberId = await generateUniqueMemberId();

    // Parse date of joining
    const joiningDate = dateOfJoining ? new Date(dateOfJoining) : new Date();

    // Create transaction to move from RegisteredMember to Member
    const result = await prisma.$transaction(async (tx) => {
      // Create member record
      const newMember = await tx.member.create({
        data: {
          memberId: uniqueMemberId,
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
          advanceAmount: parseFloat(String(advanceAmount || '0')) || 0,
          pgId,
          roomId,
          dateOfJoining: joiningDate,
        },
        include: {
          pg: {
            select: {
              id: true,
              name: true,
              type: true,
              location: true,
            },
          },
          room: {
            select: {
              id: true,
              roomNo: true,
              rent: true,
              capacity: true,
            },
          },
        },
      });

      // Delete the registered member record
      await tx.registeredMember.delete({
        where: { id },
      });

      return newMember;
    });

    // Send approval email notification
    try {
      const emailContent = createApprovalEmailContent(
        result.name,
        result.memberId,
        result.pg.name,
        result.pg.location,
        result.room?.roomNo,
        result.room?.rent,
        result.advanceAmount,
        result.dateOfJoining
      );
      await sendEmail({
        to: result.email,
        subject: `🎉 Application Approved - Welcome to ${result.pg.name}!`,
        body: emailContent,
      });
      console.log(`Approval email sent to ${result.email}`);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the entire operation if email fails
    }

    res.status(201).json({
      success: true,
      message: "Member approved and created successfully",
      data: result,
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error approving/rejecting member:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to process member approval/rejection",
    } as ApiResponse<null>);
  }
};
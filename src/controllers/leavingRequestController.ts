import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../types/response';
import { AuthenticatedRequest, AuthenticatedMemberRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

// User Routes

// Apply for a leaving request
export const applyLeavingRequest = async (req: AuthenticatedMemberRequest, res: Response) => {
  try {
    const { requestedLeaveDate, reason } = req.body;
    const memberId = req.member?.id;

    if (!memberId) {
      return res.status(401).json({
        success: false,
        message: 'Member authentication required'
      } as ApiResponse<null>);
    }

    // Get member details to fetch pgId and roomId
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { 
        id: true, 
        name: true, 
        pgId: true, 
        roomId: true,
        isActive: true
      }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      } as ApiResponse<null>);
    }

    if (!member.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Inactive members cannot apply for leaving requests'
      } as ApiResponse<null>);
    }

    // Check if there's already a pending or approved leaving request
    const existingRequest = await prisma.leavingRequest.findFirst({
      where: {
        memberId,
        status: {
          in: ['PENDING', 'APPROVED']
        }
      }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${existingRequest.status.toLowerCase()} leaving request`
      } as ApiResponse<null>);
    }

    // Create the leaving request
    const leavingRequest = await prisma.leavingRequest.create({
      data: {
        memberId,
        pgId: member.pgId,
        roomId: member.roomId,
        requestedLeaveDate: new Date(requestedLeaveDate),
        reason,
        status: 'PENDING'
      },
      include: {
        member: {
          select: { id: true, name: true, memberId: true, phone: true }
        },
        pg: {
          select: { id: true, name: true, type: true }
        },
        room: {
          select: { id: true, roomNo: true }
        }
      }
    });

    // Flatten the response
    const flattenedResponse = {
      id: leavingRequest.id,
      memberId: leavingRequest.memberId,
      pgId: leavingRequest.pgId,
      roomId: leavingRequest.roomId,
      requestedLeaveDate: leavingRequest.requestedLeaveDate,
      reason: leavingRequest.reason,
      status: leavingRequest.status,
      approvedBy: leavingRequest.approvedBy,
      approvedAt: leavingRequest.approvedAt,
      pendingDues: leavingRequest.pendingDues,
      finalAmount: leavingRequest.finalAmount,
      settledDate: leavingRequest.settledDate,
      settlementProof: leavingRequest.settlementProof,
      paymentMethod: leavingRequest.paymentMethod,
      createdAt: leavingRequest.createdAt,
      updatedAt: leavingRequest.updatedAt,
      // Flattened member fields
      memberName: leavingRequest.member.name,
      memberMemberId: leavingRequest.member.memberId,
      memberPhone: leavingRequest.member.phone,
      // Flattened PG fields
      pgName: leavingRequest.pg.name,
      pgType: leavingRequest.pg.type,
      // Flattened room fields
      roomNo: leavingRequest.room?.roomNo || null
    };

    res.status(201).json({
      success: true,
      message: 'Leaving request submitted successfully',
      data: flattenedResponse
    } as ApiResponse<any>);

  } catch (error: any) {
    console.error('Error applying leaving request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse<null>);
  }
};

// Get leaving request status for the authenticated member
export const getLeavingRequestStatus = async (req: AuthenticatedMemberRequest, res: Response) => {
  try {
    const memberId = req.member?.id;
    const { page = 1, limit = 10, status } = req.query;

    if (!memberId) {
      return res.status(401).json({
        success: false,
        message: 'Member authentication required'
      } as ApiResponse<null>);
    }

    const pageNumber = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageSize;

    // Build where conditions
    const whereConditions: any = { memberId };
    if (status) {
      whereConditions.status = status;
    }

    // Get total count
    const totalRequests = await prisma.leavingRequest.count({
      where: whereConditions
    });

    // Get leaving requests with pagination
    const leavingRequests = await prisma.leavingRequest.findMany({
      where: whereConditions,
      include: {
        member: {
          select: { id: true, name: true, memberId: true, phone: true }
        },
        pg: {
          select: { id: true, name: true, type: true }
        },
        room: {
          select: { id: true, roomNo: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    });

    // Flatten the response
    const flattenedRequests = leavingRequests.map(request => ({
      id: request.id,
      memberId: request.memberId,
      pgId: request.pgId,
      roomId: request.roomId,
      requestedLeaveDate: request.requestedLeaveDate,
      reason: request.reason,
      status: request.status,
      approvedBy: request.approvedBy,
      approvedAt: request.approvedAt,
      pendingDues: request.pendingDues,
      finalAmount: request.finalAmount,
      settledDate: request.settledDate,
      settlementProof: request.settlementProof,
      paymentMethod: request.paymentMethod,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      // Flattened member fields
      memberName: request.member.name,
      memberMemberId: request.member.memberId,
      memberPhone: request.member.phone,
      // Flattened PG fields
      pgName: request.pg.name,
      pgType: request.pg.type,
      // Flattened room fields
      roomNo: request.room?.roomNo || null
    }));

    const totalPages = Math.ceil(totalRequests / pageSize);

    res.status(200).json({
      success: true,
      message: 'Leaving request status retrieved successfully',
      data: flattenedRequests,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: totalRequests,
        totalPages
      }
    } as ApiResponse<any>);

  } catch (error: any) {
    console.error('Error getting leaving request status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse<null>);
  }
};

// Admin Routes

// Get all leaving requests for admin's PG type
export const getAllLeavingRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.admin?.id;
    const adminPgType = req.admin?.pgType;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      search 
    } = req.query;

    if (!adminId || !adminPgType) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      } as ApiResponse<null>);
    }

    const pageNumber = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageSize;

    // Build where conditions
    const whereConditions: any = {
      pg: {
        type: adminPgType
      }
    };

    if (status) {
      whereConditions.status = status;
    }

    if (search) {
      whereConditions.OR = [
        {
          member: {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          member: {
            memberId: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          reason: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Get total count
    const totalRequests = await prisma.leavingRequest.count({
      where: whereConditions
    });

    // Get leaving requests with pagination and sorting
    const leavingRequests = await prisma.leavingRequest.findMany({
      where: whereConditions,
      include: {
        member: {
          select: { 
            id: true, 
            name: true, 
            memberId: true, 
            phone: true, 
            email: true,
            gender: true 
          }
        },
        pg: {
          select: { id: true, name: true, type: true, location: true }
        },
        room: {
          select: { id: true, roomNo: true, rent: true }
        }
      },
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc'
      },
      skip,
      take: pageSize
    });

    // Flatten the response
    const flattenedRequests = leavingRequests.map(request => ({
      id: request.id,
      memberId: request.memberId,
      pgId: request.pgId,
      roomId: request.roomId,
      requestedLeaveDate: request.requestedLeaveDate,
      reason: request.reason,
      status: request.status,
      approvedBy: request.approvedBy,
      approvedAt: request.approvedAt,
      pendingDues: request.pendingDues,
      finalAmount: request.finalAmount,
      settledDate: request.settledDate,
      settlementProof: request.settlementProof,
      paymentMethod: request.paymentMethod,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      // Flattened member fields
      memberName: request.member.name,
      memberMemberId: request.member.memberId,
      memberPhone: request.member.phone,
      memberEmail: request.member.email,
      memberGender: request.member.gender,
      // Flattened PG fields
      pgName: request.pg.name,
      pgType: request.pg.type,
      pgLocation: request.pg.location,
      // Flattened room fields
      roomNo: request.room?.roomNo || null,
      roomRent: request.room?.rent || null
    }));

    const totalPages = Math.ceil(totalRequests / pageSize);

    res.status(200).json({
      success: true,
      message: 'Leaving requests retrieved successfully',
      data: flattenedRequests,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: totalRequests,
        totalPages
      }
    } as ApiResponse<any>);

  } catch (error: any) {
    console.error('Error getting all leaving requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse<null>);
  }
};

// Approve or reject a leaving request
export const approveOrRejectRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, pendingDues, finalAmount, rejectionReason } = req.body;
    const adminId = req.admin?.id;
    const adminPgType = req.admin?.pgType;

    if (!adminId || !adminPgType) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      } as ApiResponse<null>);
    }

    // Find the leaving request and verify it belongs to admin's PG type
    const leavingRequest = await prisma.leavingRequest.findFirst({
      where: {
        id,
        pg: {
          type: adminPgType
        },
        status: 'PENDING'
      },
      include: {
        member: {
          select: { id: true, name: true, memberId: true, phone: true }
        },
        pg: {
          select: { id: true, name: true, type: true }
        },
        room: {
          select: { id: true, roomNo: true }
        }
      }
    });

    if (!leavingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Pending leaving request not found or unauthorized'
      } as ApiResponse<null>);
    }

    // Prepare update data
    const updateData: any = {
      status,
      approvedBy: adminId,
      approvedAt: new Date()
    };

    if (status === 'APPROVED') {
      if (pendingDues !== undefined) updateData.pendingDues = pendingDues;
      if (finalAmount !== undefined) updateData.finalAmount = finalAmount;
    } else if (status === 'REJECTED') {
      // Store rejection reason in remarks or add a new field for it
      updateData.reason = `${leavingRequest.reason}\n\nRejection Reason: ${rejectionReason}`;
    }

    // Update the leaving request
    const updatedRequest = await prisma.leavingRequest.update({
      where: { id },
      data: updateData,
      include: {
        member: {
          select: { id: true, name: true, memberId: true, phone: true }
        },
        pg: {
          select: { id: true, name: true, type: true }
        },
        room: {
          select: { id: true, roomNo: true }
        }
      }
    });

    // Flatten the response
    const flattenedResponse = {
      id: updatedRequest.id,
      memberId: updatedRequest.memberId,
      pgId: updatedRequest.pgId,
      roomId: updatedRequest.roomId,
      requestedLeaveDate: updatedRequest.requestedLeaveDate,
      reason: updatedRequest.reason,
      status: updatedRequest.status,
      approvedBy: updatedRequest.approvedBy,
      approvedAt: updatedRequest.approvedAt,
      pendingDues: updatedRequest.pendingDues,
      finalAmount: updatedRequest.finalAmount,
      settledDate: updatedRequest.settledDate,
      settlementProof: updatedRequest.settlementProof,
      paymentMethod: updatedRequest.paymentMethod,
      createdAt: updatedRequest.createdAt,
      updatedAt: updatedRequest.updatedAt,
      // Flattened member fields
      memberName: updatedRequest.member.name,
      memberMemberId: updatedRequest.member.memberId,
      memberPhone: updatedRequest.member.phone,
      // Flattened PG fields
      pgName: updatedRequest.pg.name,
      pgType: updatedRequest.pg.type,
      // Flattened room fields
      roomNo: updatedRequest.room?.roomNo || null
    };

    const action = status === 'APPROVED' ? 'approved' : 'rejected';
    
    res.status(200).json({
      success: true,
      message: `Leaving request ${action} successfully`,
      data: flattenedResponse
    } as ApiResponse<any>);

  } catch (error: any) {
    console.error('Error approving/rejecting leaving request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse<null>);
  }
};
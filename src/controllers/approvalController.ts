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

      // Create initial payment record for the next month
      const paymentDueDate = new Date(joiningDate);
      paymentDueDate.setMonth(paymentDueDate.getMonth() + 1); // 1 month after joining
      
      const overdueDate = new Date(paymentDueDate);
      overdueDate.setDate(overdueDate.getDate() + 5); // 5 days after due date
      
      // Get rent amount from room or use provided rentAmount
      const rentAmountToUse = newMember.room?.rent || parseFloat(String(rentAmount || '0')) || 0;

      await tx.payment.create({
        data: {
          memberId: newMember.id,
          pgId,
          month: paymentDueDate.getMonth() + 1,
          year: paymentDueDate.getFullYear(),
          amount: rentAmountToUse,
          dueDate: paymentDueDate,
          overdueDate: overdueDate,
          paymentStatus: "PENDING",
          approvalStatus: "PENDING",
        },
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

// Calculate and update approval statistics
export const calculateAndUpdateApprovalStats = async (
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

    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all PGs of admin's type
    const pgs = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { id: true },
    });

    const pgIds = pgs.map((pg) => pg.id);

    // Calculate aggregated registration stats for the entire pgType
    const [
      totalPendingRequests,
      longTermRequests,
      shortTermRequests,
      thisMonthRegistrations,
    ] = await Promise.all([
      // Total pending registration requests for this PG type
      prisma.registeredMember.count({
        where: { pgType: admin.pgType },
      }),

      // Long term requests for this PG type
      prisma.registeredMember.count({
        where: {
          pgType: admin.pgType,
          rentType: "LONG_TERM",
        },
      }),

      // Short term requests for this PG type
      prisma.registeredMember.count({
        where: {
          pgType: admin.pgType,
          rentType: "SHORT_TERM",
        },
      }),

      // This month registrations (approved members created this month) across all PGs of this type
      prisma.member.count({
        where: {
          pgId: { in: pgIds },
          createdAt: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1),
          },
        },
      }),
    ]);

    // Upsert registration stats (single record per pgType)
    await prisma.registrationStats.upsert({
      where: {
        pgType_month_year: {
          pgType: admin.pgType,
          month: currentMonth,
          year: currentYear,
        },
      },
      update: {
        totalPendingRequests,
        longTermRequests,
        shortTermRequests,
        thisMonthRegistrations,
        updatedAt: new Date(),
      },
      create: {
        pgType: admin.pgType,
        month: currentMonth,
        year: currentYear,
        totalPendingRequests,
        longTermRequests,
        shortTermRequests,
        thisMonthRegistrations,
      },
    });
    // Calculate aggregated payment statistics for the entire pgType
    const [
      totalPendingPayments,
      totalAmountPending,
      totalOverduePayments,
      thisMonthPendingPaymentCount,
    ] = await Promise.all([
      // Pending payment approvals: Members who paid and waiting for admin approval in current month
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          approvalStatus: "PENDING",
          paymentStatus: "PAID", // They have paid but waiting approval
        },
      }),

      // Total amount that needs to be paid in the current month
      prisma.payment.aggregate({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
        },
        _sum: { amount: true },
      }).then(result => result._sum?.amount || 0),

      // Overdue payments: Members who didn't pay after 5 days of due date in current month
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          paymentStatus: "OVERDUE",
        },
      }),

      // Keep for compatibility (not used in new cards)
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          approvalStatus: "PENDING",
        },
      }),
    ]);

    // Upsert payment stats (single record per pgType)
    await prisma.paymentStats.upsert({
      where: {
        pgType_month_year: {
          pgType: admin.pgType,
          month: currentMonth,
          year: currentYear,
        },
      },
      update: {
        totalPendingPayments,
        totalAmountPending: totalAmountPending,
        totalOverduePayments,
        thisMonthPendingPaymentCount,
        updatedAt: new Date(),
      },
      create: {
        pgType: admin.pgType,
        month: currentMonth,
        year: currentYear,
        totalPendingPayments,
        totalAmountPending: totalAmountPending,
        totalOverduePayments,
        thisMonthPendingPaymentCount,
      },
    });

    // Get updated stats and format response
    const [registrationStats, paymentStats] = await Promise.all([
      prisma.registrationStats.findMany({
        where: {
          pgType: admin.pgType,
          month: currentMonth,
          year: currentYear,
        },
      }),
      prisma.paymentStats.findMany({
        where: {
          pgType: admin.pgType,
          month: currentMonth,
          year: currentYear,
        },
      }),
    ]);

    const lastUpdatedRegistration = registrationStats.reduce((latest, stat) => {
      return latest > stat.updatedAt ? latest : stat.updatedAt;
    }, new Date(0));

    const lastUpdatedPayment = paymentStats.reduce((latest, stat) => {
      return latest > stat.updatedAt ? latest : stat.updatedAt;
    }, new Date(0));

    // Format cards using helper function
    const cards = formatApprovalCards(
      admin,
      registrationStats,
      paymentStats,
      currentMonth,
      currentYear
    );

    res.status(200).json({
      success: true,
      message: "Approval statistics calculated and updated successfully",
      data: { 
        cards, 
        lastUpdated: {
          registration: lastUpdatedRegistration,
          payment: lastUpdatedPayment,
        }
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error calculating approval stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to calculate approval statistics",
    } as ApiResponse<null>);
  }
};

// Helper function to format approval cards
const formatApprovalCards = (
  admin: { pgType: any },
  registrationStats: any[],
  paymentStats: any[],
  currentMonth: number,
  currentYear: number
) => {
  // Calculate totals from stats
  const totalPendingRequests = registrationStats.reduce(
    (sum, stat) => sum + stat.totalPendingRequests,
    0
  );
  const totalLongTermRequests = registrationStats.reduce(
    (sum, stat) => sum + stat.longTermRequests,
    0
  );
  const totalShortTermRequests = registrationStats.reduce(
    (sum, stat) => sum + stat.shortTermRequests,
    0
  );
  const totalThisMonthRegistrations = registrationStats.reduce(
    (sum, stat) => sum + stat.thisMonthRegistrations,
    0
  );

  const totalPendingPayments = paymentStats.reduce(
    (sum, stat) => sum + stat.totalPendingPayments,
    0
  );
  const totalAmountPending = paymentStats.reduce(
    (sum, stat) => sum + stat.totalAmountPending,
    0
  );
  const totalOverduePayments = paymentStats.reduce(
    (sum, stat) => sum + stat.totalOverduePayments,
    0
  );
  const totalThisMonthPendingPayments = paymentStats.reduce(
    (sum, stat) => sum + stat.thisMonthPendingPaymentCount,
    0
  );

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `${amount.toLocaleString("en-IN")}`;
  };

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString("en-IN");
  };

  // Get month name
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return {
    registration: [
      {
        title: "Pending Registration Requests",
        value: formatNumber(totalPendingRequests),
        icon: "userCheck",
        color: totalPendingRequests > 0 ? "warning" : "success",
        subtitle: `For ${admin.pgType.toLowerCase()}'s PG`,
        ...(totalPendingRequests > 0 && {
          badge: {
            text: "Action Required",
            color: "error",
          },
          onClickRoute: "/admin/approvals/registrations",
        }),
      },
      {
        title: "Long Term Requests",
        value: formatNumber(totalLongTermRequests),
        icon: "calendar",
        color: "primary",
        subtitle: `${Math.round((totalLongTermRequests / Math.max(totalPendingRequests, 1)) * 100)}% of total requests`,
      },
      {
        title: "Short Term Requests",
        value: formatNumber(totalShortTermRequests),
        icon: "clock",
        color: "secondary",
        subtitle: `${Math.round((totalShortTermRequests / Math.max(totalPendingRequests, 1)) * 100)}% of total requests`,
      },
      {
        title: "Approved This Month",
        value: formatNumber(totalThisMonthRegistrations),
        icon: "userPlus",
        color: "success",
        subtitle: `${monthNames[currentMonth - 1]} ${currentYear}`,
      },
    ],
    payment: [
      {
        title: "Pending Payment Approvals",
        value: formatNumber(totalPendingPayments),
        icon: "clock",
        color: totalPendingPayments > 0 ? "warning" : totalPendingPayments === 0 ? "neutral" : "success",
        subtitle: `Members who paid but awaiting admin approval for ${monthNames[currentMonth - 1]} ${currentYear}`,
        ...(totalPendingPayments > 0 && {
          badge: {
            text: "Action Required",
            color: "error",
          },
          onClickRoute: "/admin/approvals/payments",
        }),
      },
      {
        title: "Total Amount Due",
        value: formatCurrency(totalAmountPending),
        icon: "indianRupee",
        color: "warning",
        subtitle: `Total amount that needs to be paid for ${monthNames[currentMonth - 1]} ${currentYear}`,
      },
      {
        title: "Overdue Payments",
        value: formatNumber(totalOverduePayments),
        icon: "alertTriangle",
        color: totalOverduePayments > 0 ? "error" : "success",
        subtitle: totalOverduePayments > 0 ? `Members who didn't pay after due date for ${monthNames[currentMonth - 1]} ${currentYear}` : "No overdue payments",
        ...(totalOverduePayments > 0 && {
          badge: {
            text: "Critical",
            color: "error",
          },
        }),
      },
    ],
  };
};

// Get approval statistics in card format (only fetch and format)
export const getApprovalStats = async (
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

    // Get filter parameters from query
    const now = new Date();
    const requestedMonth = parseInt(req.query.month as string) || now.getMonth() + 1;
    const requestedYear = parseInt(req.query.year as string) || now.getFullYear();
    const pgLocations = req.query.pgLocation ? 
      (req.query.pgLocation as string).split(',').map(loc => loc.trim()) : 
      [];

    // Get all PGs of admin's type with optional location filter
    const pgFilter: any = { type: admin.pgType };
    if (pgLocations.length > 0) {
      pgFilter.location = { in: pgLocations };
    }

    const pgs = await prisma.pG.findMany({
      where: pgFilter,
      select: { id: true, location: true },
    });

    const pgIds = pgs.map((pg) => pg.id);

    // Calculate payment statistics dynamically for the requested month/year and filtered PGs
    const [
      pendingPaymentApprovals,
      totalAmountDue,
      overduePayments,
    ] = await Promise.all([
      // Pending payment approvals: Members who paid and waiting for admin approval in requested month
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: requestedMonth,
          year: requestedYear,
          approvalStatus: "PENDING",
          paymentStatus: "PAID", // They have paid but waiting approval
        },
      }),

      // Total amount that needs to be paid in the requested month
      prisma.payment.aggregate({
        where: {
          pgId: { in: pgIds },
          month: requestedMonth,
          year: requestedYear,
        },
        _sum: { amount: true },
      }).then(result => result._sum?.amount || 0),

      // Overdue payments: Members who didn't pay after 5 days of due date in requested month
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: requestedMonth,
          year: requestedYear,
          paymentStatus: "OVERDUE",
        },
      }),
    ]);

    // Get registration stats for the requested month/year
    const registrationStats = await prisma.registrationStats.findMany({
      where: {
        pgType: admin.pgType,
        month: requestedMonth,
        year: requestedYear,
      },
    });

    // Create payment stats object for formatting
    const paymentStats = [{
      totalPendingPayments: pendingPaymentApprovals,
      totalAmountPending: totalAmountDue,
      totalOverduePayments: overduePayments,
      thisMonthPendingPaymentCount: 0, // Not used anymore
    }];

    const lastUpdatedRegistration = registrationStats.reduce((latest, stat) => {
      return stat.updatedAt > latest ? stat.updatedAt : latest;
    }, new Date(0));

    const lastUpdatedPayment = new Date(); // Current time since we calculated dynamically

    // Format cards using helper function
    const cards = formatApprovalCards(
      admin,
      registrationStats,
      paymentStats,
      requestedMonth,
      requestedYear
    );

    res.status(200).json({
      success: true,
      message: "Approval statistics retrieved successfully",
      data: { 
        cards, 
        lastUpdated: {
          registration: lastUpdatedRegistration,
          payment: lastUpdatedPayment,
        },
        filters: {
          month: requestedMonth,
          year: requestedYear,
          pgLocations: pgLocations.length > 0 ? pgLocations : "All locations",
        }
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting approval stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve approval statistics",
    } as ApiResponse<null>);
  }
};

// Get all PG members current month payment data with filters
export const getMembersPaymentData = async (
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

    // Get filter parameters from query - handle multiple values
    const search = req.query.search as string;
    const rentType = req.query.rentType as string;
    const paymentStatus = req.query.paymentStatus as string;
    const approvalStatus = req.query.approvalStatus as string;

    // Parse comma-separated values for multi-select filters
    const parseMultipleValues = (param: string | undefined): string[] => {
      if (!param) return [];
      return param.split(',').map(val => decodeURIComponent(val.trim())).filter(val => val.length > 0);
    };

    const pgLocations = parseMultipleValues(req.query.pgLocation as string);

    // Get current month and year for payment status
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all PGs of admin's type
    const pgs = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { id: true, name: true, location: true },
    });

    const pgIds = pgs.map((pg) => pg.id);

    // Build where clause for members
    const whereClause: any = {
      pgId: { in: pgIds },
    };

    // Apply filters
    if (rentType) {
      whereClause.rentType = rentType;
    }

    // Filter by multiple PG locations
    if (pgLocations.length > 0) {
      const pgsInLocation = await prisma.pG.findMany({
        where: {
          type: admin.pgType,
          location: { in: pgLocations },
        },
        select: { id: true },
      });
      const pgIdsInLocation = pgsInLocation.map((pg) => pg.id);

      if (pgIdsInLocation.length > 0) {
        whereClause.pgId = { in: pgIdsInLocation };
      } else {
        // If no PGs found in locations, return empty result
        whereClause.pgId = { in: [] };
      }
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { memberId: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.member.count({
      where: whereClause,
    });

    // Get members with related data including current month payment
    const members = await prisma.member.findMany({
      where: whereClause,
      include: {
        pg: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNo: true,
            rent: true,
          },
        },
        payment: {
          where: {
            OR: [
              {
                // Current calendar month payments
                month: currentMonth,
                year: currentYear,
              },
              {
                // Payments due around current date (within 30 days)
                dueDate: {
                  gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                  lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days ahead
                },
              },
            ],
          },
          select: {
            id: true,
            paymentStatus: true,
            approvalStatus: true,
            amount: true,
            month: true,
            year: true,
            dueDate: true,
            overdueDate: true,
            paidDate: true,
            rentBillScreenshot: true,
            electricityBillScreenshot: true,
            attemptNumber: true,
            createdAt: true,
          },
        },
      },
      skip: offset,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const processedMembers = members.map((member) => {
      let calculatedPaymentStatus: "PAID" | "PENDING" | "OVERDUE" = "PENDING";
      let calculatedApprovalStatus: "APPROVED" | "PENDING" | "REJECTED" = "PENDING";

      const relevantPayment = member.payment.find(
        (p) => {
          if (p.month === currentMonth && p.year === currentYear) {
            return true;
          }
          if (p.dueDate) {
            const daysDiff = Math.abs((now.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff <= 30;
          }
          return false;
        }
      ) || member.payment[0];

      if (relevantPayment) {
        calculatedApprovalStatus = relevantPayment.approvalStatus as any;

        // Calculate payment status based on approval status and due dates
        if (relevantPayment.approvalStatus === "APPROVED") {
          calculatedPaymentStatus = "PAID";
        } else if (relevantPayment.approvalStatus === "REJECTED") {
          calculatedPaymentStatus = "OVERDUE";
        } else {
          // Check if payment is overdue based on overdueDate
          if (relevantPayment.overdueDate && now > new Date(relevantPayment.overdueDate)) {
            calculatedPaymentStatus = "OVERDUE";
          } else if (relevantPayment.dueDate && now > new Date(relevantPayment.dueDate)) {
            // Past due date but within grace period
            calculatedPaymentStatus = "PENDING";
          } else {
            calculatedPaymentStatus = "PENDING";
          }
        }
      } else {
        // No payment record found - check if member should have a payment by now
        const memberJoiningDate = new Date(member.dateOfJoining);
        const oneMonthAfterJoining = new Date(memberJoiningDate);
        oneMonthAfterJoining.setMonth(oneMonthAfterJoining.getMonth() + 1);
        
        const overdueThreshold = new Date(oneMonthAfterJoining);
        overdueThreshold.setDate(overdueThreshold.getDate() + 5);

        if (now > overdueThreshold) {
          calculatedPaymentStatus = "OVERDUE";
        } else if (now > oneMonthAfterJoining) {
          calculatedPaymentStatus = "PENDING";
        } else {
          // Member hasn't reached their first payment due date yet
          calculatedPaymentStatus = "PENDING";
        }
      }

      // Flatten the data structure - extract pg and room data to top level
      const { payment, pg, room, ...memberData } = member;

      return {
        ...memberData,
        pgLocation: pg?.location || "",
        pgName: pg?.name || "",
        roomNo: room?.roomNo || "",
        rent: room?.rent || 0,
        currentMonthPaymentStatus: calculatedPaymentStatus,
        currentMonthApprovalStatus: calculatedApprovalStatus,
        currentMonthPayment: relevantPayment || null,
        hasCurrentMonthPayment: !!relevantPayment,
      };
    });

    // Apply payment status and approval status filters after processing
    let filteredMembers = processedMembers;

    if (paymentStatus && ["PAID", "PENDING", "OVERDUE"].includes(paymentStatus)) {
      filteredMembers = filteredMembers.filter(
        (member) => member.currentMonthPaymentStatus === paymentStatus
      );
    }

    if (approvalStatus && ["APPROVED", "PENDING", "REJECTED"].includes(approvalStatus)) {
      filteredMembers = filteredMembers.filter(
        (member) => member.currentMonthApprovalStatus === approvalStatus
      );
    }

    // Recalculate total count if payment/approval status filters are applied
    let finalTotal = total;
    if (paymentStatus || approvalStatus) {
      // For status filters, we need to count all matching members and then apply the status filter
      const allMembers = await prisma.member.findMany({
        where: whereClause,
        include: {
          payment: {
            where: {
              month: currentMonth,
              year: currentYear,
            },
            select: {
              paymentStatus: true,
              approvalStatus: true,
              month: true,
              year: true,
            },
          },
        },
      });

      const allProcessedMembers = allMembers.map((member) => {
        let memberPaymentStatus: "PAID" | "PENDING" | "OVERDUE" = "PENDING";
        let memberApprovalStatus: "APPROVED" | "PENDING" | "REJECTED" = "PENDING";

        const currentMonthPayment = member.payment.find(
          (p) => p.month === currentMonth && p.year === currentYear
        );

        if (currentMonthPayment) {
          memberPaymentStatus = currentMonthPayment.paymentStatus as any;
          memberApprovalStatus = currentMonthPayment.approvalStatus as any;

          if (currentMonthPayment.approvalStatus === "APPROVED") {
            memberPaymentStatus = "PAID";
          } else if (
            currentMonthPayment.approvalStatus === "REJECTED" ||
            currentMonthPayment.paymentStatus === "OVERDUE"
          ) {
            memberPaymentStatus = "OVERDUE";
          }
        } else {
          const memberJoiningDate = new Date(member.dateOfJoining);
          const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
          const currentMonthEnd = new Date(currentYear, currentMonth, 0);

          if (
            memberJoiningDate >= currentMonthStart &&
            memberJoiningDate <= currentMonthEnd
          ) {
            const overdueDate = new Date(memberJoiningDate);
            overdueDate.setDate(overdueDate.getDate() + 5);
            if (now > overdueDate) {
              memberPaymentStatus = "OVERDUE";
            }
          } else if (memberJoiningDate < currentMonthStart) {
            const fifthOfMonth = new Date(currentYear, currentMonth - 1, 5);
            if (now > fifthOfMonth) {
              memberPaymentStatus = "OVERDUE";
            }
          }
        }

        return { 
          ...member, 
          currentMonthPaymentStatus: memberPaymentStatus,
          currentMonthApprovalStatus: memberApprovalStatus 
        };
      });

      // Apply filters to count
      let filteredForCount = allProcessedMembers;
      if (paymentStatus && ["PAID", "PENDING", "OVERDUE"].includes(paymentStatus)) {
        filteredForCount = filteredForCount.filter(
          (member) => member.currentMonthPaymentStatus === paymentStatus
        );
      }
      if (approvalStatus && ["APPROVED", "PENDING", "REJECTED"].includes(approvalStatus)) {
        filteredForCount = filteredForCount.filter(
          (member) => member.currentMonthApprovalStatus === approvalStatus
        );
      }

      finalTotal = filteredForCount.length;
    }

    const response = {
      tableData: filteredMembers,
      pagination: {
        page,
        limit,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / limit),
      },
    };

    res.status(200).json({
      success: true,
      message: "Members payment data retrieved successfully",
      data: response,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting members payment data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve members payment data",
    } as ApiResponse<null>);
  }
};

// Get filter options for members payment data filtering
export const getMembersPaymentFilterOptions = async (
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

    // Get all PGs of admin's type
    const pgs = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { id: true, name: true, location: true },
    });

    const pgIds = pgs.map((pg) => pg.id);

    // Get unique PG locations for admin's PG type
    const pgLocations = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { location: true },
      distinct: ["location"],
    });

    // Get unique rent types from members of admin's PG type
    const rentTypes = await prisma.member.findMany({
      where: { pgId: { in: pgIds } },
      select: { rentType: true },
      distinct: ["rentType"],
    });

    // Get current date for generating month/year options
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Generate month options
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    const monthOptions = monthNames.map((name, index) => ({
      value: (index + 1).toString(),
      label: name,
    }));

    // Generate year options (current year and 2 years back)
    const yearOptions = [];
    for (let year = currentYear; year >= currentYear - 2; year--) {
      yearOptions.push({
        value: year.toString(),
        label: year.toString(),
      });
    } 

    // Build filter options with proper structure for frontend
    const filters = [
      {
        id: "search",
        type: "search" as const,
        placeholder: "Search by name, memberId, email, phone...",
        fullWidth: true,
        gridSpan: 4,
      },
      {
        id: "month",
        label: "Month",
        placeholder: "Select month",
        type: "select",
        options: monthOptions,
        defaultValue: currentMonth.toString(),
      },
      {
        id: "year",
        label: "Year",
        placeholder: "Select year",
        type: "select",
        options: yearOptions,
        defaultValue: currentYear.toString(),
      },
      {
        id: "pgLocation",
        label: "PG Location",
        placeholder: "Select PG location",
        type: "multiSelect",
        options: pgLocations
          .filter(pg => pg.location)
          .map((pgLoc) => ({
            value: pgLoc.location,
            label: pgLoc.location,
          })),
        variant: "dropdown" as const,
        searchable: true,
        showSelectAll: true,
      },
      {
        id: "rentType",
        label: "Rent Type",
        placeholder: "Select rent type",
        type: "select",
        options: rentTypes.map((rt) => ({
          value: rt.rentType,
          label: rt.rentType === "LONG_TERM" ? "Long Term" : "Short Term",
        })),
      },
      {
        id: "paymentStatus",
        label: "Payment Status",
        placeholder: "Select payment status",
        type: "select",
        options: [
          { value: "PAID", label: "Paid" },
          { value: "PENDING", label: "Pending" },
          { value: "OVERDUE", label: "Overdue" },
        ],
      },
      {
        id: "approvalStatus",
        label: "Approval Status",
        placeholder: "Select approval status",
        type: "select",
        options: [
          { value: "APPROVED", label: "Approved" },
          { value: "PENDING", label: "Pending" },
          { value: "REJECTED", label: "Rejected" },
        ],
      },
      {
        id: "roomNo",
        label: "Room Number",
        placeholder: "Select room number",
        type: "select",
        options: await prisma.room.findMany({
          where: {
            pGId: { in: pgIds },
          },
          select: {
            id: true,
            roomNo: true,
          },
          distinct: ["roomNo"],
          orderBy: {
            roomNo: "asc",
          },
        }).then(rooms => 
          rooms.map(room => ({
            value: room.roomNo,
            label: room.roomNo,
          }))
        ),
      },
    ];

    res.status(200).json({
      success: true,
      message: "Members payment filter options retrieved successfully",
      data: { 
        filters, 
        totalPGs: pgs.length,
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting members payment filter options:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve members payment filter options",
    } as ApiResponse<null>);
  }
};
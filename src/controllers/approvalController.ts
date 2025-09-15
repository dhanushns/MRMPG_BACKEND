import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import {
  ApproveRejectMemberRequest,
  ApproveRejectPaymentRequest,
} from "../types/request";
import { AuthenticatedRequest } from "../middlewares/auth";
import { generateUniqueMemberId } from "../utils/memberIdGenerator";
import { generateSecureOTP, hashOTP } from "../utils/auth";
import {
  sendEmail,
  createApprovalEmailContent,
  createRejectionEmailContent,
} from "../utils/emailService";
import { deleteImage, ImageType } from "../utils/imageUpload";

// GET registered members of pgType
export const getRegisteredMembers = async (
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

    // Optional filters
    const search = req.query.search as string;
    const rentType = req.query.rentType as string;

    // Build where clause
    const whereClause: any = {
      pgType: admin.pgType,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
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
        createdAt: "desc",
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
export const approveOrRejectMember = async (
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

    const { id } = req.params;
    const {
      status,
      pgId,
      roomId,
      advanceAmount,
      dateOfJoining,
      pricePerDay,
      dateOfRelieving,
    }: ApproveRejectMemberRequest = req.body;

    // Validate required fields
    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
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

    if (status === "REJECTED") {
      // Delete the registered member record
      await prisma.registeredMember.delete({
        where: { id },
      });

      // Send rejection email notification
      try {
        const emailContent = createRejectionEmailContent(
          registeredMember.name,
          registeredMember.pgType
        );
        await sendEmail({
          to: registeredMember.email,
          subject: `Application Update - ${registeredMember.name}`,
          body: emailContent,
        });
        console.log(`Rejection email sent to ${registeredMember.email}`);
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
      }

      // Delete the uploaded images
      await deleteImage(registeredMember.photoUrl || "", ImageType.PROFILE);
      await deleteImage(registeredMember.documentUrl || "", ImageType.DOCUMENT);

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

    // Validate additional fields for short-term members
    if (registeredMember.rentType === "SHORT_TERM") {
      if (!pricePerDay || pricePerDay <= 0) {
        res.status(400).json({
          success: false,
          message:
            "pricePerDay is required and must be greater than 0 for short-term members",
        } as ApiResponse<null>);
        return;
      }

      if (!dateOfRelieving) {
        res.status(400).json({
          success: false,
          message: "endingDate is required for short-term members",
        } as ApiResponse<null>);
        return;
      }

      // Validate that date of relieving is after joining date
      const joiningDateObj = dateOfJoining
        ? new Date(dateOfJoining)
        : new Date();
      const dateOfRelievingObj = new Date(dateOfRelieving);

      if (dateOfRelievingObj <= joiningDateObj) {
        res.status(400).json({
          success: false,
          message:
            "Date of relieving must be after joining date for short-term members",
        } as ApiResponse<null>);
        return;
      }
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

    // Validate room if roomId is provided
    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });

      if (!room) {
        res.status(404).json({
          success: false,
          message: "Room not found",
        } as ApiResponse<null>);
        return;
      }

      // Verify room belongs to the specified PG
      if (room.pGId !== pgId) {
        res.status(400).json({
          success: false,
          message: "Room does not belong to the specified PG",
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
    }

    // Generate unique member ID
    const uniqueMemberId = await generateUniqueMemberId();

    // Parse dates
    const joiningDate = dateOfJoining ? new Date(dateOfJoining) : new Date();
    const memberDateOfRelieving =
      registeredMember.rentType === "SHORT_TERM" && dateOfRelieving
        ? new Date(dateOfRelieving)
        : registeredMember.dateOfRelieving;

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
          documentUrl: registeredMember.documentUrl,
          rentType: registeredMember.rentType,
          dateOfRelieving: memberDateOfRelieving,
          advanceAmount: parseFloat(String(advanceAmount || "0")) || 0,
          pricePerDay:
            registeredMember.rentType === "SHORT_TERM"
              ? parseFloat(String(pricePerDay || "0")) || 0
              : null,
          pgType: registeredMember.pgType,
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

      // Create initial payment record for the member
      if (newMember.room) {
        const joiningDate = new Date(newMember.dateOfJoining);

        if (newMember.rentType === "LONG_TERM") {
          // Long-term members: Payment for current month of service, due next month

          // Payment record is for the current month they joined (service period)
          const currentMonth = joiningDate.getMonth() + 1;
          const currentYear = joiningDate.getFullYear();

          // Due date is next month, same date as joining date
          const dueDate = new Date(joiningDate);
          dueDate.setMonth(dueDate.getMonth() + 1);

          // Handle month-end edge cases for due date
          const joiningDay = joiningDate.getDate();
          if (dueDate.getDate() !== joiningDay) {
            const lastDayOfDueMonth = new Date(
              dueDate.getFullYear(),
              dueDate.getMonth() + 1,
              0
            ).getDate();
            dueDate.setDate(Math.min(joiningDay, lastDayOfDueMonth));
          }

          // Calculate overdue date (7 days after due date)
          const overdueDate = new Date(dueDate);
          overdueDate.setDate(overdueDate.getDate() + 7);

          // Set amount based on room rent
          const paymentAmount = newMember.room.rent;

          await tx.payment.create({
            data: {
              memberId: newMember.id,
              pgId: newMember.pgId,
              month: currentMonth, // Payment for September (current month)
              year: currentYear, // 2025
              amount: paymentAmount,
              dueDate: dueDate, // Due on October 13 (next month)
              overdueDate: overdueDate, // Overdue after October 20
              paymentStatus: "PENDING",
              approvalStatus: "PENDING",
            },
          });
        } else if (
          newMember.rentType === "SHORT_TERM" &&
          newMember.dateOfRelieving &&
          newMember.pricePerDay
        ) {
          // Short-term members: One-time payment based on number of days
          // Since they pay upfront, create payment record as PAID and APPROVED

          // Calculate number of days between joining and ending date
          const endingDate = new Date(newMember.dateOfRelieving);
          const timeDifference = endingDate.getTime() - joiningDate.getTime();
          const numberOfDays = Math.ceil(timeDifference / (1000 * 3600 * 24));

          // Calculate total amount (days * pricePerDay)
          const totalAmount = numberOfDays * newMember.pricePerDay;

          // Set due date as the joining date (immediate payment)
          const dueDate = new Date(joiningDate);

          // Calculate overdue date (7 days after due date)
          const overdueDate = new Date(dueDate);
          overdueDate.setDate(overdueDate.getDate() + 7);

          await tx.payment.create({
            data: {
              memberId: newMember.id,
              pgId: newMember.pgId,
              month: joiningDate.getMonth() + 1,
              year: joiningDate.getFullYear(),
              amount: totalAmount,
              dueDate: dueDate,
              overdueDate: overdueDate,
              paymentStatus: "PAID",
              approvalStatus: "APPROVED",
              paidDate: new Date(), // Set paid date to current time
              approvedAt: new Date(), // Set approved date to current time
              approvedBy: req.admin?.id, // Set approved by admin who approved the member
            },
          });
        }
      }

      // Delete the registered member record
      await tx.registeredMember.delete({
        where: { id },
      });
      return newMember;
    });

    // Generate OTP and send approval email notification
    try {
      let otpCode: string | undefined = undefined;
      
      // For long-term members, generate OTP and include in approval email
      if (result.rentType === "LONG_TERM") {
        // Generate OTP
        otpCode = generateSecureOTP();
        const hashedOTP = await hashOTP(otpCode);

        // Delete existing unused OTPs for this member of INITIAL_SETUP type
        await prisma.oTP.deleteMany({
          where: {
            memberId: result.id,
            type: 'INITIAL_SETUP',
          },
        });

        // Create new OTP with 24 hours expiry
        await prisma.oTP.create({
          data: {
            memberId: result.id,
            email: result.email,
            code: hashedOTP,
            type: 'INITIAL_SETUP',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });

        console.log(`Initial setup OTP generated for long-term member: ${result.email}`);
      }

      const emailContent = createApprovalEmailContent(
        result.name,
        result.memberId,
        result.pg.name,
        result.pg.location,
        result.room?.roomNo,
        result.rentType === "LONG_TERM" ? result.room?.rent : undefined,
        result.advanceAmount,
        result.dateOfJoining,
        result.rentType,
        result.pricePerDay || undefined,
        result.dateOfRelieving || undefined,
        otpCode
      );

      await sendEmail({
        to: result.email,
        subject: `🎉 Application Approved - Welcome to ${result.pg.name}!`,
        body: emailContent,
      });

      console.log(`Approval email sent to ${result.email}${otpCode ? ' with initial setup OTP' : ''}`);
    } catch (emailError) {
      console.error("Failed to send approval email:", emailError);
    }

    res.status(201).json({
      success: true,
      message: result.rentType === "LONG_TERM" 
        ? "Member approved and created successfully. Initial setup OTP is included in the approval email (valid for 24 hours)."
        : "Member approved and created successfully.",
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
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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
        subtitle: `${Math.round(
          (totalLongTermRequests / Math.max(totalPendingRequests, 1)) * 100
        )}% of total requests`,
      },
      {
        title: "Short Term Requests",
        value: formatNumber(totalShortTermRequests),
        icon: "clock",
        color: "secondary",
        subtitle: `${Math.round(
          (totalShortTermRequests / Math.max(totalPendingRequests, 1)) * 100
        )}% of total requests`,
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
        color:
          totalPendingPayments > 0
            ? "warning"
            : totalPendingPayments === 0
            ? "neutral"
            : "success",
        subtitle: `Members who paid but awaiting admin approval for ${
          monthNames[currentMonth - 1]
        } ${currentYear}`,
        ...(totalPendingPayments > 0 && {
          badge: {
            text: "Action Required",
            color: "error",
          },
        }),
      },
      {
        title: "Total Amount Due",
        value: formatCurrency(totalAmountPending),
        icon: "indianRupee",
        color: "warning",
        subtitle: `Total amount that needs to be paid for ${
          monthNames[currentMonth - 1]
        } ${currentYear}`,
      },
      {
        title: "Overdue Payments",
        value: formatNumber(totalOverduePayments),
        icon: "alertTriangle",
        color: totalOverduePayments > 0 ? "error" : "success",
        subtitle:
          totalOverduePayments > 0
            ? `Members who didn't pay after due date for ${
                monthNames[currentMonth - 1]
              } ${currentYear}`
            : "No overdue payments",
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
    const requestedMonth =
      parseInt(req.query.month as string) || now.getMonth() + 1;
    const requestedYear =
      parseInt(req.query.year as string) || now.getFullYear();
    const pgLocations = req.query.pgLocation
      ? (req.query.pgLocation as string).split(",").map((loc) => loc.trim())
      : [];

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

    // Update overdue payment statuses in real-time before calculating stats
    const currentTime = new Date();
    await prisma.payment.updateMany({
      where: {
        pgId: { in: pgIds },
        month: requestedMonth,
        year: requestedYear,
        approvalStatus: "PENDING",
        paymentStatus: "PENDING", // Only update PENDING to OVERDUE
        overdueDate: {
          lt: currentTime, // overdue date has passed
        },
      },
      data: {
        paymentStatus: "OVERDUE",
      },
    });

    // Calculate payment statistics dynamically for the requested month/year and filtered PGs
    const [pendingPaymentApprovals, totalApprovedAmount, overduePayments] =
      await Promise.all([
        prisma.payment.count({
          where: {
            pgId: { in: pgIds },
            month: requestedMonth,
            year: requestedYear,
            approvalStatus: "PENDING",
            paymentStatus: "PAID",
          },
        }),

        prisma.payment
          .aggregate({
            where: {
              pgId: { in: pgIds },
              month: requestedMonth,
              year: requestedYear,
              approvalStatus: "APPROVED",
            },
            _sum: { amount: true },
          })
          .then((result) => result._sum?.amount || 0),

        // Overdue payments: Members who didn't pay after overdue date in requested month
        prisma.payment.count({
          where: {
            pgId: { in: pgIds },
            month: requestedMonth,
            year: requestedYear,
            paymentStatus: "OVERDUE",
          },
        }),
      ]);

    // Calculate total amount due based on actual payment records for the requested month
    // This ensures we use the correct amounts for both long-term and short-term members
    const totalAmountDue = await prisma.payment
      .aggregate({
        where: {
          pgId: { in: pgIds },
          month: requestedMonth,
          year: requestedYear,
          // Only count payments that are still due (not yet approved)
          approvalStatus: { not: "APPROVED" },
        },
        _sum: { amount: true },
      })
      .then((result) => result._sum?.amount || 0);

    // Calculate registration statistics dynamically for the requested month/year
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
            gte: new Date(requestedYear, requestedMonth - 1, 1),
            lt: new Date(requestedYear, requestedMonth, 1),
          },
        },
      }),
    ]);

    // Create registration stats object for formatting
    const registrationStats = [
      {
        totalPendingRequests,
        longTermRequests,
        shortTermRequests,
        thisMonthRegistrations,
      },
    ];

    // Create payment stats object for formatting
    const paymentStats = [
      {
        totalPendingPayments: pendingPaymentApprovals,
        totalAmountPending: totalAmountDue,
        totalOverduePayments: overduePayments,
        thisMonthPendingPaymentCount: 0,
      },
    ];

    const lastUpdatedRegistration = new Date();
    const lastUpdatedPayment = new Date();
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
        count: {
          registrationPending: totalPendingRequests,
          pendingApprovals: pendingPaymentApprovals,
        },
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
    const paymentStatus = (req.query.paymentStatus as string) || "PAID";
    const approvalStatus = (req.query.approvalStatus as string) || "PENDING";

    // Get sorting parameters
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";

    // Parse comma-separated values for multi-select filters
    const parseMultipleValues = (param: string | undefined): string[] => {
      if (!param) return [];
      return param
        .split(",")
        .map((val) => decodeURIComponent(val.trim()))
        .filter((val) => val.length > 0);
    };

    const pgLocations = parseMultipleValues(req.query.pgLocation as string);

    // Get month and year filters (default to current month/year)
    const now = new Date();
    const requestedMonth =
      parseInt(req.query.month as string) || now.getMonth() + 1;
    const requestedYear =
      parseInt(req.query.year as string) || now.getFullYear();

    // Check if requested month/year is in the future
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const isFutureMonth =
      requestedYear > currentYear ||
      (requestedYear === currentYear && requestedMonth > currentMonth);

    // If requesting future data, return empty result since no payment records should exist
    if (isFutureMonth) {
      res.status(200).json({
        success: true,
        message: `No payment data available for future month ${requestedMonth}/${requestedYear}`,
        data: {
          tableData: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      } as ApiResponse<any>);
      return;
    }

    // Get all PGs of admin's type
    const pgs = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { id: true, name: true, location: true },
    });

    const pgIds = pgs.map((pg) => pg.id);

    // Only get members who have actual payment records for the requested month/year
    // This ensures we only work with stored database values
    const whereClause: any = {
      pgId: { in: pgIds },
      isActive: true,
      payment: {
        some: {
          month: requestedMonth,
          year: requestedYear,
        },
      },
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

    // Remove the dateOfJoining filter since we're only working with existing payment records
    // The payment records themselves will determine which members have data for the requested month

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { memberId: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Update overdue payment statuses in real-time before fetching data
    const currentTime = new Date();
    await prisma.payment.updateMany({
      where: {
        pgId: { in: pgIds },
        month: requestedMonth,
        year: requestedYear,
        approvalStatus: "PENDING",
        paymentStatus: "PENDING",
        overdueDate: {
          lt: currentTime,
        },
      },
      data: {
        paymentStatus: "OVERDUE",
      },
    });

    // Build order by clause for sorting
    const buildOrderBy = (sortBy: string, sortOrder: string): any => {
      const order = sortOrder === "asc" ? "asc" : "desc";

      switch (sortBy) {
        case "name":
        case "memberId":
        case "dateOfJoining":
        case "createdAt":
        case "age":
        case "location":
        case "work":
          return { [sortBy]: order };
        case "pgName":
          return { pg: { name: order } };
        case "pgLocation":
          return { pg: { location: order } };
        case "roomNo":
          return { room: { roomNo: order } };
        case "rentAmount":
          return { room: { rent: order } };
        default:
          return { createdAt: "desc" };
      }
    };

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
            month: requestedMonth,
            year: requestedYear,
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
      orderBy: buildOrderBy(sortBy, sortOrder),
    });

    // Process members data using only stored payment data from database
    const processedMembers = members
      .map((member) => {
        // Find requested month payment - this MUST exist since we filtered for it
        const requestedMonthPayment = member.payment.find(
          (p) => p.month === requestedMonth && p.year === requestedYear
        );

        // Flatten the data structure - extract pg and room data to top level
        const { payment, pg, room, ...memberData } = member;

        // Use stored values from database only
        if (!requestedMonthPayment) {
          // This should not happen since we filtered for existing payment records
          // But adding as safety check - skip this member
          return null;
        }

        return {
          ...memberData,
          pgLocation: pg?.location || "",
          pgName: pg?.name || "",
          roomNo: room?.roomNo || "",
          rentAmount: room?.rent || 0,
          // Use stored payment status and approval status from database
          requestedMonthPaymentStatus: requestedMonthPayment.paymentStatus,
          requestedMonthApprovalStatus: requestedMonthPayment.approvalStatus,
          requestedMonthPayment: {
            id: requestedMonthPayment.id,
            amount: requestedMonthPayment.amount,
            paymentStatus: requestedMonthPayment.paymentStatus,
            approvalStatus: requestedMonthPayment.approvalStatus,
            month: requestedMonthPayment.month,
            year: requestedMonthPayment.year,
            attemptNumber: requestedMonthPayment.attemptNumber,
            dueDate: requestedMonthPayment.dueDate,
            overdueDate: requestedMonthPayment.overdueDate,
            paidDate: requestedMonthPayment.paidDate,
            rentBillScreenshot: requestedMonthPayment.rentBillScreenshot,
            electricityBillScreenshot:
              requestedMonthPayment.electricityBillScreenshot,
            createdAt: requestedMonthPayment.createdAt,
          },
          hasRequestedMonthPayment: true,
        };
      })
      .filter((member) => member !== null); // Remove any null entries

    // Apply payment status and approval status filters after processing
    let filteredMembers = processedMembers;

    if (
      paymentStatus &&
      ["PAID", "PENDING", "OVERDUE"].includes(paymentStatus)
    ) {
      filteredMembers = filteredMembers.filter(
        (member) => member.requestedMonthPaymentStatus === paymentStatus
      );
    }

    if (
      approvalStatus &&
      ["APPROVED", "PENDING", "REJECTED"].includes(approvalStatus)
    ) {
      filteredMembers = filteredMembers.filter(
        (member) => member.requestedMonthApprovalStatus === approvalStatus
      );
    }

    // Since we're only working with existing payment records,
    // the total count is based on the filtered results
    const finalTotal = filteredMembers.length;

    // Apply pagination to filtered results
    const paginatedMembers = filteredMembers.slice(offset, offset + limit);

    const response = {
      tableData: paginatedMembers,
      pagination: {
        page,
        limit,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / limit),
      },
    };

    res.status(200).json({
      success: true,
      message: `Members payment data retrieved successfully for ${requestedMonth}/${requestedYear}`,
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

    // Generate month options - exclude future months for current year
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Create month options based on available months (no future months)
    const monthOptions = monthNames
      .map((name, index) => ({
        value: (index + 1).toString(),
        label: name,
      }))
      .filter((month, index) => {
        // For current year, only show months up to current month
        // For past years, show all months
        const monthNumber = index + 1;
        return monthNumber <= currentMonth;
      });

    // Generate year options - get years that actually have payment data
    // Start from current year and go back, but only include years with data
    const availableYears = await prisma.payment.findMany({
      where: {
        pgId: { in: pgIds },
      },
      select: {
        year: true,
      },
      distinct: ["year"],
      orderBy: {
        year: "desc",
      },
    });

    // Create year options from available data, but don't exceed current year
    const yearOptions = availableYears
      .filter((payment) => payment.year <= currentYear)
      .map((payment) => ({
        value: payment.year.toString(),
        label: payment.year.toString(),
      }));

    // If no payment data exists, at least include current year
    if (yearOptions.length === 0) {
      yearOptions.push({
        value: currentYear.toString(),
        label: currentYear.toString(),
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
        id: "year",
        label: "Year",
        placeholder: "Select year",
        type: "select",
        options: yearOptions,
        defaultValue: currentYear.toString(),
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
        id: "pgLocation",
        label: "PG Location",
        placeholder: "Select PG location",
        type: "multiSelect",
        options: pgLocations
          .filter((pg) => pg.location)
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
        options: [
          { value: "LONG_TERM", label: "Long Term" },
          { value: "SHORT_TERM", label: "Short Term" },
        ],
        variant: "dropdown" as const,
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
        defaultValue: "PAID",
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
        defaultValue: "PENDING",
      },
      {
        id: "sortBy",
        label: "Sort By",
        placeholder: "Select sort field",
        type: "select",
        options: [
          { value: "createdAt", label: "Date Joined" },
          { value: "name", label: "Name" },
          { value: "memberId", label: "Member ID" },
          { value: "dateOfJoining", label: "Joining Date" },
          { value: "age", label: "Age" },
          { value: "location", label: "Member Location" },
          { value: "work", label: "Work Type" },
          { value: "pgName", label: "PG Name" },
          { value: "pgLocation", label: "PG Location" },
          { value: "roomNo", label: "Room Number" },
          { value: "rentAmount", label: "Rent Amount" },
        ],
        defaultValue: "createdAt",
      },
      {
        id: "sortOrder",
        label: "Sort Order",
        placeholder: "Select sort order",
        type: "select",
        options: [
          { value: "desc", label: "Descending" },
          { value: "asc", label: "Ascending" },
        ],
        defaultValue: "desc",
      },
    ];

    res.status(200).json({
      success: true,
      message: "Members payment filter options retrieved successfully",
      data: {
        filters,
        totalPGs: pgs.length,
        currentDate: {
          month: currentMonth,
          year: currentYear,
        },
        // Helper function for frontend to generate month options based on year
        monthOptionsGenerator: {
          currentYear: currentYear,
          currentMonth: currentMonth,
          allMonths: monthNames.map((name, index) => ({
            value: (index + 1).toString(),
            label: name,
          })),
        },
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

// Helper function to get month options for a specific year
export const getMonthOptionsForYear = async (
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

    const selectedYear = parseInt(req.query.year as string);
    if (!selectedYear) {
      res.status(400).json({
        success: false,
        message: "Year parameter is required",
      } as ApiResponse<null>);
      return;
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    let availableMonths: { value: string; label: string }[];

    if (selectedYear === currentYear) {
      // For current year, only show months up to current month
      availableMonths = monthNames
        .slice(0, currentMonth)
        .map((name, index) => ({
          value: (index + 1).toString(),
          label: name,
        }));
    } else if (selectedYear < currentYear) {
      // For past years, show all months
      availableMonths = monthNames.map((name, index) => ({
        value: (index + 1).toString(),
        label: name,
      }));
    } else {
      // For future years (shouldn't happen with proper year filtering), show empty
      availableMonths = [];
    }

    res.status(200).json({
      success: true,
      message: `Month options retrieved for year ${selectedYear}`,
      data: {
        year: selectedYear,
        months: availableMonths,
        maxMonth: selectedYear === currentYear ? currentMonth : 12,
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting month options for year:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve month options",
    } as ApiResponse<null>);
  }
};

// Approve or reject payment for a member
export const approveOrRejectPayment = async (
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

    const { paymentId } = req.params;
    const { approvalStatus }: ApproveRejectPaymentRequest = req.body;

    // Validate required fields
    if (!approvalStatus || !["APPROVED", "REJECTED"].includes(approvalStatus)) {
      res.status(400).json({
        success: false,
        message: "Invalid approval status. Must be APPROVED or REJECTED",
      } as ApiResponse<null>);
      return;
    }

    // Get admin details to know their pgType
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, pgType: true },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      } as ApiResponse<null>);
      return;
    }

    // Find the payment with member and PG details
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            memberId: true,
            email: true,
            dateOfJoining: true,
          },
        },
        pg: {
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
          },
        },
      },
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        message: "Payment record not found",
      } as ApiResponse<null>);
      return;
    }

    // Verify admin can manage this payment (same pgType)
    if (payment.pg.type !== admin.pgType) {
      res.status(403).json({
        success: false,
        message: "You can only manage payments for your PG type",
      } as ApiResponse<null>);
      return;
    }

    // Check if payment is in a state that can be approved/rejected
    if (
      payment.approvalStatus === "APPROVED" ||
      payment.approvalStatus === "REJECTED"
    ) {
      res.status(400).json({
        success: false,
        message: `Payment has already been ${payment.approvalStatus.toLowerCase()}`,
      } as ApiResponse<null>);
      return;
    }

    // Use transaction to update payment and create next payment record
    const result = await prisma.$transaction(async (tx) => {
      // Update payment approval status
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          approvalStatus: approvalStatus as any,
          approvedBy: admin.id,
          approvedAt: new Date(),
          // If approved, also update payment status to PAID
          ...(approvalStatus === "APPROVED" && {
            paymentStatus: "PAID",
            paidDate: new Date(),
          }),
          // If rejected, update payment status to OVERDUE
          ...(approvalStatus === "REJECTED" && {
            paymentStatus: "OVERDUE",
          }),
        },
        include: {
          member: {
            select: {
              id: true,
              name: true,
              memberId: true,
              email: true,
              dateOfJoining: true,
            },
          },
          pg: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
      });

      // If payment is approved, create the next payment record
      if (approvalStatus === "APPROVED") {
        // Get member's room details for rent amount
        const memberWithRoom = await tx.member.findUnique({
          where: { id: payment.memberId },
          include: {
            room: {
              select: {
                rent: true,
              },
            },
          },
        });

        if (memberWithRoom?.room) {
          // Calculate next billing cycle month and year
          const nextMonth = payment.month === 12 ? 1 : payment.month + 1;
          const nextYear =
            payment.month === 12 ? payment.year + 1 : payment.year;

          // Check if next payment record already exists
          const existingNextPayment = await tx.payment.findFirst({
            where: {
              memberId: payment.memberId,
              month: nextMonth,
              year: nextYear,
            },
          });

          if (!existingNextPayment) {
            // Calculate next payment record for the next service month
            const joiningDate = new Date(payment.member.dateOfJoining);
            const joiningDay = joiningDate.getDate();

            // The due date for next payment should be in the month AFTER the next service month
            // If current payment is for September (service), next payment is for October (service)
            // Due date for October payment should be November 13
            const nextServiceMonth = nextMonth;
            const nextServiceYear = nextYear;

            // Calculate due date: same day as joining date but in the month after service month
            const dueMonth = nextServiceMonth === 12 ? 1 : nextServiceMonth + 1;
            const dueYear =
              nextServiceMonth === 12 ? nextServiceYear + 1 : nextServiceYear;
            const nextDueDate = new Date(dueYear, dueMonth - 1, joiningDay);

            // Handle month-end edge cases
            if (nextDueDate.getDate() !== joiningDay) {
              const lastDayOfDueMonth = new Date(
                dueYear,
                dueMonth,
                0
              ).getDate();
              nextDueDate.setDate(Math.min(joiningDay, lastDayOfDueMonth));
            }

            // Calculate overdue date (7 days after due date)
            const nextOverdueDate = new Date(nextDueDate);
            nextOverdueDate.setDate(nextOverdueDate.getDate() + 7);

            // Create next payment record for the service month
            // Payment is for the service month, but due date is in the following month
            await tx.payment.create({
              data: {
                memberId: payment.memberId,
                pgId: payment.pgId,
                month: nextServiceMonth, // Service month (e.g., October service)
                year: nextServiceYear,
                amount: memberWithRoom.room.rent,
                dueDate: nextDueDate, // Due date (e.g., November 13 for October service)
                overdueDate: nextOverdueDate,
                paymentStatus: "PENDING",
                approvalStatus: "PENDING",
              },
            });
          }
        }
      }

      return updatedPayment;
    });

    const statusText = approvalStatus === "APPROVED" ? "approved" : "rejected";

    res.status(200).json({
      success: true,
      message: `Payment ${statusText} successfully`,
      data: {
        paymentId: result.id,
        memberId: result.member.memberId,
        memberName: result.member.name,
        pgName: result.pg.name,
        month: result.month,
        year: result.year,
        amount: result.amount,
        approvalStatus: result.approvalStatus,
        paymentStatus: result.paymentStatus,
        approvedBy: result.approvedBy,
        approvedAt: result.approvedAt,
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error approving/rejecting payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to process payment approval/rejection",
    } as ApiResponse<null>);
  }
};

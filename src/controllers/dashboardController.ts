import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { AuthenticatedRequest } from "../middlewares/auth";

// Calculate and update current month dashboard statistics
export const calculateAndUpdateDashboardStats = async (
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

    // Calculate current month statistics for each PG
    for (const pg of pgs) {
      // Get aggregate statistics for this PG
      const [
        totalMembers,
        rentCollection,
        newMembers,
        paymentApprovals,
        registrationApprovals,
      ] = await Promise.all([
        // Total members in this PG
        prisma.member.count({
          where: { pgId: pg.id },
        }),

        // Rent collection for current month
        prisma.payment.aggregate({
          where: {
            pgId: pg.id,
            month: currentMonth,
            year: currentYear,
            status: "APPROVED",
          },
          _sum: { amount: true },
        }),

        // New members this month
        prisma.member.count({
          where: {
            pgId: pg.id,
            dateOfJoining: {
              gte: new Date(currentYear, currentMonth - 1, 1),
              lt: new Date(currentYear, currentMonth, 1),
            },
          },
        }),

        // Payment approvals this month
        prisma.payment.count({
          where: {
            pgId: pg.id,
            month: currentMonth,
            year: currentYear,
            status: "APPROVED",
          },
        }),

        // Registration approvals this month (approximation based on new members)
        prisma.member.count({
          where: {
            pgId: pg.id,
            createdAt: {
              gte: new Date(currentYear, currentMonth - 1, 1),
              lt: new Date(currentYear, currentMonth, 1),
            },
          },
        }),
      ]);

      // Get previous month stats for trend calculation
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const previousStats = await prisma.dashboardStats.findFirst({
        where: {
          pgId: pg.id,
          month: prevMonth,
          year: prevYear,
        },
      });

      // Calculate trends
      const totalMemberTrend = previousStats
        ? totalMembers - previousStats.totalMembers
        : 0;

      const rentCollectionTrend = previousStats
        ? (rentCollection._sum.amount || 0) - previousStats.rentCollection
        : 0;

      const newMemberTrend = previousStats
        ? newMembers - previousStats.newMembers
        : 0;

      // Upsert dashboard stats
      await prisma.dashboardStats.upsert({
        where: {
          pgId_month_year: {
            pgId: pg.id,
            month: currentMonth,
            year: currentYear,
          },
        },
        update: {
          totalMembers,
          rentCollection: rentCollection._sum.amount || 0,
          newMembers,
          paymentApprovals,
          registrationApprovals,
          totalMemberTrend,
          rentCollectionTrend,
          newMemberTrend,
          updatedAt: new Date(),
        },
        create: {
          pgId: pg.id,
          month: currentMonth,
          year: currentYear,
          totalMembers,
          rentCollection: rentCollection._sum.amount || 0,
          newMembers,
          paymentApprovals,
          registrationApprovals,
          totalMemberTrend,
          rentCollectionTrend,
          newMemberTrend,
        },
      });
    }

    // After updating stats, fetch the aggregated data and format response
    const dashboardStats = await prisma.dashboardStats.findMany({
      where: {
        pgId: { in: pgIds },
        month: currentMonth,
        year: currentYear,
      },
    });

    const lastUpdated = dashboardStats.reduce((latest, stat) => {
      return latest > stat.updatedAt ? latest : stat.updatedAt;
    }, new Date(0));

    // Calculate totals from updated data
    const totalMembers = dashboardStats.reduce(
      (sum, stat) => sum + stat.totalMembers,
      0
    );
    const totalRentCollection = dashboardStats.reduce(
      (sum, stat) => sum + stat.rentCollection,
      0
    );
    const totalNewMembers = dashboardStats.reduce(
      (sum, stat) => sum + stat.newMembers,
      0
    );
    const totalMemberTrend = dashboardStats.reduce(
      (sum, stat) => sum + stat.totalMemberTrend,
      0
    );
    const totalRentCollectionTrend = dashboardStats.reduce(
      (sum, stat) => sum + stat.rentCollectionTrend,
      0
    );
    const totalNewMemberTrend = dashboardStats.reduce(
      (sum, stat) => sum + stat.newMemberTrend,
      0
    );

    // Get pending approvals (real-time data)
    const [pendingPayments, pendingRegistrations] = await Promise.all([
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          status: "PENDING",
        },
      }),
      prisma.registeredMember.count({
        where: { pgType: admin.pgType },
      }),
    ]);

    // Format cards using helper function
    const cards = formatDashboardCards(
      admin,
      totalMembers,
      totalRentCollection,
      totalNewMembers,
      totalMemberTrend,
      totalRentCollectionTrend,
      totalNewMemberTrend,
      pendingPayments,
      pendingRegistrations,
      currentMonth,
      currentYear
    );

    res.status(200).json({
      success: true,
      message: "Dashboard statistics calculated and updated successfully",
      data: { cards, lastUpdated },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error calculating dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to calculate dashboard statistics",
    } as ApiResponse<null>);
  }
};

// Helper function to format dashboard cards
const formatDashboardCards = (
  admin: { pgType: any },
  totalMembers: number,
  totalRentCollection: number,
  totalNewMembers: number,
  totalMemberTrend: number,
  totalRentCollectionTrend: number,
  totalNewMemberTrend: number,
  pendingPayments: number,
  pendingRegistrations: number,
  currentMonth: number,
  currentYear: number
) => {
  // Calculate trend percentages
  const calculateTrendPercentage = (current: number, trend: number): number => {
    if (current === 0) return 0;
    const previous = current - trend;
    if (previous === 0) return trend > 0 ? 100 : 0;
    return Math.round((trend / previous) * 100);
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
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

  return [
    {
      title: "Total Members",
      value: formatNumber(totalMembers),
      trend: totalMemberTrend >= 0 ? "up" : "down",
      percentage: Math.abs(
        calculateTrendPercentage(totalMembers, totalMemberTrend)
      ),
      icon: "users",
      color: "primary",
      subtitle: `Compared to last month in ${admin.pgType.toLowerCase()}'s PG`,
    },
    {
      title: "Rent Collection",
      value: formatCurrency(totalRentCollection),
      trend: totalRentCollectionTrend >= 0 ? "up" : "down",
      percentage: Math.abs(
        calculateTrendPercentage(totalRentCollection, totalRentCollectionTrend)
      ),
      icon: "indianRupee",
      color: "success",
      subtitle: `${monthNames[currentMonth - 1]} ${currentYear}`,
    },
    {
      title: "New Members",
      value: formatNumber(totalNewMembers),
      trend: totalNewMemberTrend >= 0 ? "up" : "down",
      percentage: Math.abs(
        calculateTrendPercentage(totalNewMembers, totalNewMemberTrend)
      ),
      icon: totalNewMemberTrend >= 0 ? "userPlus" : "userMinus",
      color: totalNewMemberTrend >= 0 ? "success" : "error",
      subtitle:
        totalNewMemberTrend >= 0
          ? "More than previous month"
          : "Lesser than previous month",
    },
    {
      title: "Pending Payment Approvals",
      value: formatNumber(pendingPayments),
      icon: "clock",
      color: "warning",
      subtitle: "Awaiting admin action",
      ...(pendingPayments > 0 && {
        badge: {
          text: "Action Required",
          color: "error",
        },
        onClickRoute: "/admin/approvals/payments",
      }),
    },
    {
      title: "Pending Registration Approvals",
      value: formatNumber(pendingRegistrations),
      icon: "file",
      color: "warning",
      subtitle: "Awaiting admin action",
      ...(pendingRegistrations > 0 && {
        badge: {
          text: "Action Required",
          color: "error",
        },
        onClickRoute: "/admin/approvals/members",
      }),
    },
  ];
};

// Get dashboard statistics in card format (only fetch and format)
export const getDashboardStats = async (
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

    // Get aggregated dashboard stats from DashboardStats model
    const dashboardStats = await prisma.dashboardStats.findMany({
      where: {
        pgId: { in: pgIds },
        month: currentMonth,
        year: currentYear,
      },
    });

    const lastUpdated = dashboardStats.reduce((latest, stat) => {
      return stat.updatedAt > latest ? stat.updatedAt : latest;
    }, new Date(0));

    // Calculate totals from stored data
    const totalMembers = dashboardStats.reduce(
      (sum, stat) => sum + stat.totalMembers,
      0
    );
    const totalRentCollection = dashboardStats.reduce(
      (sum, stat) => sum + stat.rentCollection,
      0
    );
    const totalNewMembers = dashboardStats.reduce(
      (sum, stat) => sum + stat.newMembers,
      0
    );
    const totalMemberTrend = dashboardStats.reduce(
      (sum, stat) => sum + stat.totalMemberTrend,
      0
    );
    const totalRentCollectionTrend = dashboardStats.reduce(
      (sum, stat) => sum + stat.rentCollectionTrend,
      0
    );
    const totalNewMemberTrend = dashboardStats.reduce(
      (sum, stat) => sum + stat.newMemberTrend,
      0
    );

    // Get pending approvals (real-time data)
    const [pendingPayments, pendingRegistrations] = await Promise.all([
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          status: "PENDING",
        },
      }),
      prisma.registeredMember.count({
        where: { pgType: admin.pgType },
      }),
    ]);

    // Format cards using helper function
    const cards = formatDashboardCards(
      admin,
      totalMembers,
      totalRentCollection,
      totalNewMembers,
      totalMemberTrend,
      totalRentCollectionTrend,
      totalNewMemberTrend,
      pendingPayments,
      pendingRegistrations,
      currentMonth,
      currentYear
    );

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: { cards, lastUpdated },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve dashboard statistics",
    } as ApiResponse<null>);
  }
};

// Get all members data with pagination and filters
export const getAllMembers = async (
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

    // Get filter parameters
    const pgId = req.query.pgId as string;
    const rentType = req.query.rentType as string;
    const pgLocation = req.query.pgLocation as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    // Get current month and year for payment status
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all PGs of admin's type
    const pgs = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { id: true },
    });

    const pgIds = pgs.map((pg) => pg.id);

    // Build where clause for members
    const whereClause: any = {
      pgId: { in: pgIds },
    };

    // Apply filters
    if (pgId && pgIds.includes(pgId)) {
      whereClause.pgId = pgId;
    }

    if (rentType) {
      whereClause.rentType = rentType;
    }

    if (pgLocation) {
      whereClause.location = { contains: pgLocation, mode: "insensitive" };
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

    // Get members with related data
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
            month: currentMonth,
            year: currentYear,
          },
          select: {
            id: true,
            status: true,
            amount: true,
            month: true,
            year: true,
          },
        },
      },
      skip: offset,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Process members data to determine payment status
    const processedMembers = members.map((member) => {
      // Determine payment status for current month
      let paymentStatus: "PAID" | "PENDING" | "OVERDUE" = "PENDING";

      const currentMonthPayment = member.payment.find(
        (p) => p.month === currentMonth && p.year === currentYear
      );

      if (currentMonthPayment) {
        if (currentMonthPayment.status === "APPROVED") {
          paymentStatus = "PAID";
        } else if (
          currentMonthPayment.status === "REJECTED" ||
          currentMonthPayment.status === "OVERDUE"
        ) {
          paymentStatus = "OVERDUE";
        } else {
          paymentStatus = "PENDING";
        }
      } else {
        // Check if it's overdue (after 5 days from dateOfJoining in current month)
        const memberJoiningDate = new Date(member.dateOfJoining);
        const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
        const currentMonthEnd = new Date(currentYear, currentMonth, 0);
        
        // If member joined in current month, calculate overdue based on joining date + 5 days
        if (memberJoiningDate >= currentMonthStart && memberJoiningDate <= currentMonthEnd) {
          const overdueDate = new Date(memberJoiningDate);
          overdueDate.setDate(overdueDate.getDate() + 5);
          if (now > overdueDate) {
            paymentStatus = "OVERDUE";
          }
        } else if (memberJoiningDate < currentMonthStart) {
          // If member joined before current month, use 5th of current month as deadline
          const fifthOfMonth = new Date(currentYear, currentMonth - 1, 5);
          if (now > fifthOfMonth) {
            paymentStatus = "OVERDUE";
          }
        }
      }

      // Flatten the data structure - extract pg and room data to top level
      const { payment, pg, room, ...memberData } = member;
      return {
        ...memberData,
        pgLocation: pg?.location || '',
        pgName: pg?.name || '',
        roomNo: room?.roomNo || '',
        rent: room?.rent || 0,
        paymentStatus,
        status: paymentStatus, // Additional status field as requested
      };
    });

    // Filter by payment status if specified
    let filteredMembers = processedMembers;
    if (status) {
      filteredMembers = processedMembers.filter(
        (member) => member.paymentStatus === status
      );
    }

    // Recalculate total count if status filter is applied
    let finalTotal = total;
    if (status) {
      finalTotal = filteredMembers.length;
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
      message: "Members data retrieved successfully",
      data: response,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting members data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve members data",
    } as ApiResponse<null>);
  }
};

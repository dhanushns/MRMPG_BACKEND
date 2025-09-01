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

    // Calculate current month statistics aggregated for the entire pgType
    const [
      aggregatedTotalMembers,
      aggregatedRentCollection,
      aggregatedNewMembers,
      aggregatedPaymentApprovals,
      aggregatedRegistrationApprovals,
    ] = await Promise.all([
      // Total members across all PGs of this type
      prisma.member.count({
        where: { pgId: { in: pgIds } },
      }),

      // Rent collection for current month across all PGs of this type
      prisma.payment.aggregate({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          approvalStatus: "APPROVED",
        },
        _sum: { amount: true },
      }),

      // New members this month across all PGs of this type
      prisma.member.count({
        where: {
          pgId: { in: pgIds },
          dateOfJoining: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1),
          },
        },
      }),

      // Payment approvals this month across all PGs of this type
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          approvalStatus: "APPROVED",
        },
      }),

      // Registration approvals this month across all PGs of this type
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

    // Get previous month stats for trend calculation
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const previousStats = await prisma.dashboardStats.findFirst({
      where: {
        pgId: `${admin.pgType}_AGGREGATE`, // Use a special pgId for aggregated stats
        month: prevMonth,
        year: prevYear,
      },
    });

    // Calculate trends
    const aggregatedTotalMemberTrend = previousStats
      ? aggregatedTotalMembers - previousStats.totalMembers
      : 0;

    const aggregatedRentCollectionTrend = previousStats
      ? (aggregatedRentCollection._sum.amount || 0) - previousStats.rentCollection
      : 0;

    const aggregatedNewMemberTrend = previousStats
      ? aggregatedNewMembers - previousStats.newMembers
      : 0;

    // Upsert aggregated dashboard stats for the pgType
    await prisma.dashboardStats.upsert({
      where: {
        pgId_month_year: {
          pgId: `${admin.pgType}_AGGREGATE`, // Use a special pgId for aggregated stats
          month: currentMonth,
          year: currentYear,
        },
      },
      update: {
        totalMembers: aggregatedTotalMembers,
        rentCollection: aggregatedRentCollection._sum.amount || 0,
        newMembers: aggregatedNewMembers,
        paymentApprovals: aggregatedPaymentApprovals,
        registrationApprovals: aggregatedRegistrationApprovals,
        totalMemberTrend: aggregatedTotalMemberTrend,
        rentCollectionTrend: aggregatedRentCollectionTrend,
        newMemberTrend: aggregatedNewMemberTrend,
        updatedAt: new Date(),
      },
      create: {
        pgId: `${admin.pgType}_AGGREGATE`, // Use a special pgId for aggregated stats
        month: currentMonth,
        year: currentYear,
        totalMembers: aggregatedTotalMembers,
        rentCollection: aggregatedRentCollection._sum.amount || 0,
        newMembers: aggregatedNewMembers,
        paymentApprovals: aggregatedPaymentApprovals,
        registrationApprovals: aggregatedRegistrationApprovals,
        totalMemberTrend: aggregatedTotalMemberTrend,
        rentCollectionTrend: aggregatedRentCollectionTrend,
        newMemberTrend: aggregatedNewMemberTrend,
      },
    });

    // After updating stats, fetch the aggregated data and format response
    const dashboardStats = await prisma.dashboardStats.findMany({
      where: {
        pgId: `${admin.pgType}_AGGREGATE`,
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
          paymentStatus: "PAID",
          approvalStatus: "PENDING",
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
        pgId: `${admin.pgType}_AGGREGATE`,
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
          paymentStatus: "PAID",
          approvalStatus: "PENDING",
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

    // Get filter parameters from query - handle multiple values
    const pgId = req.query.pgId as string;
    const rentType = req.query.rentType as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    // Parse comma-separated values for multi-select filters
    const parseMultipleValues = (param: string | undefined): string[] => {
      if (!param) return [];
      return param.split(',').map(val => decodeURIComponent(val.trim())).filter(val => val.length > 0);
    };

    const locations = parseMultipleValues(req.query.location as string);
    const pgLocations = parseMultipleValues(req.query.pgLocation as string);
    const works = parseMultipleValues(req.query.work as string);

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

    // Handle multiple locations
    if (locations.length > 0) {
      whereClause.location = { in: locations };
    }

    // Handle multiple work types
    if (works.length > 0) {
      whereClause.work = { in: works };
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
      const currentMonthPayment = member.payment.find(
        (p) => p.month === currentMonth && p.year === currentYear
      );

      // Flatten the data structure - extract pg and room data to top level
      const { payment, pg, room, ...memberData } = member;
      
      // Determine payment status based on payment record existence
      let paymentStatus = "PENDING"; // Default to PENDING when no payment record exists
      
      if (currentMonthPayment) {
        // If payment record exists, use the approval status to determine final status
        if (currentMonthPayment.approvalStatus === "APPROVED") {
          paymentStatus = "PAID";
        } else if (currentMonthPayment.approvalStatus === "REJECTED") {
          paymentStatus = "OVERDUE";
        } else if (currentMonthPayment.paymentStatus === "OVERDUE") {
          paymentStatus = "OVERDUE";
        } else {
          paymentStatus = "PENDING"; // Payment made but approval pending
        }
      }
      
      return {
        ...memberData,
        pgLocation: pg?.location || '',
        pgName: pg?.name || '',
        roomNo: room?.roomNo || '',
        paymentStatus: paymentStatus,
        rentAmount: room?.rent || 0,
        currentMonthPayment: currentMonthPayment || null,
        hasCurrentMonthPayment: !!currentMonthPayment,
      };
    });

    // Apply status filter if specified (filter by calculated payment status)
    let filteredMembers = processedMembers;
    if (status) {
      filteredMembers = processedMembers.filter((member) => {
        // Use the calculated paymentStatus directly
        return member.paymentStatus === status;
      });
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

// Get filter options for dashboard member filtering
export const getDashboardFilterOptions = async (
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

    // Get pgLocation parameter for room filtering (cascading filter)
    const pgLocation = req.query.pgLocation as string;

    // Get unique work types from members of admin's PG type
    const workTypes = await prisma.member.findMany({
      where: { pgId: { in: pgIds } },
      select: { work: true },
      distinct: ["work"],
    });

    // Get unique locations from members of admin's PG type
    const locations = await prisma.member.findMany({
      where: { pgId: { in: pgIds } },
      select: { location: true },
      distinct: ["location"],
    });

    // Get unique PG locations for admin's PG type
    const pgLocations = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { location: true },
      distinct: ["location"],
    });

    // Get PG options for admin's PG type
    const pgOptions = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { id: true, name: true, location: true },
      orderBy: { name: "asc" },
    });

    // Get rooms based on selected pg location (cascading filter)
    let roomsFilter: any = { pGId: { in: pgIds } };
    if (pgLocation) {
      // Parse comma-separated values for multiple PG locations
      const selectedPgLocations = pgLocation
        .split(',')
        .map(loc => decodeURIComponent(loc.trim()))
        .filter(loc => loc.length > 0);

      if (selectedPgLocations.length > 0) {
        const pgsInLocation = await prisma.pG.findMany({
          where: {
            type: admin.pgType,
            location: { in: selectedPgLocations },
          },
          select: { id: true },
        });
        const pgIdsInLocation = pgsInLocation.map((pg) => pg.id);
        roomsFilter = { pGId: { in: pgIdsInLocation } };
      }
    }

    const rooms = await prisma.room.findMany({
      where: roomsFilter,
      select: { id: true, roomNo: true },
      orderBy: { roomNo: "asc" },
    });

    // Get unique rent types from members of admin's PG type
    const rentTypes = await prisma.member.findMany({
      where: { pgId: { in: pgIds } },
      select: { rentType: true },
      distinct: ["rentType"],
    });

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
        id: "pgId",
        label: "PG",
        placeholder: "Select PG",
        type: "select",
        options: pgOptions.map((pg) => ({
          value: pg.id,
          label: `${pg.name} - ${pg.location}`,
        })),
        variant: "dropdown" as const,
        searchable: true,
      },
      {
        id: "pgLocation",
        label: "PG Location",
        placeholder: "Select PG location",
        type: "multiSelect",
        options: pgLocations
          .filter(pg => pg.location) // Filter out null/undefined PG location values
          .map((pgLoc) => ({
            value: pgLoc.location,
            label: pgLoc.location,
          })),
        variant: "dropdown" as const,
        searchable: true,
        showSelectAll: true,
      },
      {
        id: "location",
        label: "Member Location",
        placeholder: "Select member location",
        type: "multiSelect",
        options: locations
          .filter(l => l.location) // Filter out null/undefined location values
          .map((location) => ({
            value: location.location,
            label: location.location,
          })),
        variant: "dropdown" as const,
        searchable: true,
        showSelectAll: true,
      },
      {
        id: "work",
        label: "Work",
        placeholder: "Select work type",
        type: "multiSelect",
        options: workTypes
          .filter(w => w.work)
          .map((work) => ({
            value: work.work,
            label: work.work,
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
        id: "status",
        label: "Payment Status",
        placeholder: "Select payment status",
        type: "select",
        options: [
          { value: "PAID", label: "Paid" },
          { value: "PENDING", label: "Pending" },
          { value: "OVERDUE", label: "Overdue" },
        ],
      },
    ];

    res.status(200).json({
      success: true,
      message: "Dashboard filter options retrieved successfully",
      data: { 
        filters, 
        totalPGs: pgs.length,
        totalRooms: rooms.length 
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting dashboard filter options:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve dashboard filter options",
    } as ApiResponse<null>);
  }
};

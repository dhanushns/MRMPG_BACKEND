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
    // This aggregates data across all PGs of the same type (MENS/WOMENS)
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
        pgType: admin.pgType, // Use pgType directly
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

    const updatedStats = await prisma.dashboardStats.upsert({
      where: {
        pgType_month_year: {
          pgType: admin.pgType,
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
        pgType: admin.pgType,
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

    // Use the updated stats directly (no need to fetch and re-aggregate)
    const lastUpdated = updatedStats.updatedAt;
    const totalMembers = updatedStats.totalMembers;
    const totalRentCollection = updatedStats.rentCollection;
    const totalNewMembers = updatedStats.newMembers;
    const totalMemberTrend = updatedStats.totalMemberTrend;
    const totalRentCollectionTrend = updatedStats.rentCollectionTrend;
    const totalNewMemberTrend = updatedStats.newMemberTrend;

    // Get pending approvals (real-time data with proper overdue detection)
    const [pendingPayments, pendingRegistrations, overduePayments] = await Promise.all([
      // Pending payment approvals: Members who paid and waiting for admin approval
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          paymentStatus: "PAID",
          approvalStatus: "PENDING",
        },
      }),
      prisma.registeredMember.count({
        where: { pgType: admin.pgType },
      }),
      // Count overdue payments that need status update
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          approvalStatus: "PENDING",
          paymentStatus: { in: ["PENDING", "OVERDUE"] },
          overdueDate: {
            lt: now, // overdue date has passed
          },
        },
      }),
    ]);

    // Update overdue payment statuses in real-time
    if (overduePayments > 0) {
      await prisma.payment.updateMany({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          approvalStatus: "PENDING",
          paymentStatus: "PENDING", // Only update PENDING to OVERDUE
          overdueDate: {
            lt: now,
          },
        },
        data: {
          paymentStatus: "OVERDUE",
        },
      });
    }

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

    const dashboardStats = await prisma.dashboardStats.findFirst({
      where: {
        pgType: admin.pgType,
        month: currentMonth,
        year: currentYear,
      },
    });

    if (!dashboardStats) {
      res.status(200).json({
        success: true,
        message: "No dashboard statistics found. Please calculate stats first.",
        data: { 
          cards: [], 
          lastUpdated: new Date(),
          isEmpty: true,
        },
      } as ApiResponse<any>);
      return;
    }

    // Use the stats directly (single record, no need to aggregate)
    const lastUpdated = dashboardStats.updatedAt;
    const totalMembers = dashboardStats.totalMembers;
    const totalRentCollection = dashboardStats.rentCollection;
    const totalNewMembers = dashboardStats.newMembers;
    const totalMemberTrend = dashboardStats.totalMemberTrend;
    const totalRentCollectionTrend = dashboardStats.rentCollectionTrend;
    const totalNewMemberTrend = dashboardStats.newMemberTrend;

    // Get pending approvals (real-time data with proper overdue detection)
    const [pendingPayments, pendingRegistrations, overduePayments] = await Promise.all([
      // Pending payment approvals: Members who paid and waiting for admin approval
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          paymentStatus: "PAID",
          approvalStatus: "PENDING",
        },
      }),
      prisma.registeredMember.count({
        where: { pgType: admin.pgType },
      }),
      // Count overdue payments that need status update
      prisma.payment.count({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          approvalStatus: "PENDING",
          paymentStatus: { in: ["PENDING", "OVERDUE"] },
          overdueDate: {
            lt: now, // overdue date has passed
          },
        },
      }),
    ]);

    // Update overdue payment statuses in real-time
    if (overduePayments > 0) {
      await prisma.payment.updateMany({
        where: {
          pgId: { in: pgIds },
          month: currentMonth,
          year: currentYear,
          approvalStatus: "PENDING",
          paymentStatus: "PENDING", // Only update PENDING to OVERDUE
          overdueDate: {
            lt: now,
          },
        },
        data: {
          paymentStatus: "OVERDUE",
        },
      });
    }

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

    // Get filter parameters (matching dashboard filter options)
    const pgId = req.query.pgId as string;
    const rentType = req.query.rentType as string;
    const paymentStatus = req.query.paymentStatus as string || req.query.status as string; // Support both field names
    const search = req.query.search as string;
    
    // Get sorting parameters
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';

    // Parse comma-separated values for multi-select filters (matching filter options)
    const parseMultiSelectValues = (param: string | undefined): string[] => {
      if (!param) return [];
      return param.split(',').map(val => decodeURIComponent(val.trim())).filter(val => val.length > 0);
    };

    const locations = parseMultiSelectValues(req.query.location as string);
    const pgLocations = parseMultiSelectValues(req.query.pgLocation as string);
    const works = parseMultiSelectValues(req.query.work as string);

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

    // Apply filters (matching dashboard filter structure)
    if (pgId && pgIds.includes(pgId)) {
      whereClause.pgId = pgId;
    }

    if (rentType) {
      whereClause.rentType = rentType;
    }

    // Handle multiple locations (member location filter)
    if (locations.length > 0) {
      whereClause.location = { in: locations };
    }

    // Handle multiple work types
    if (works.length > 0) {
      whereClause.work = { in: works };
    }

    // Filter by multiple PG locations (cascading filter)
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

    // Handle search across multiple fields
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { memberId: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build order by clause for sorting
    const buildOrderBy = (sortBy: string, sortOrder: string): any => {
      const order = sortOrder === 'asc' ? 'asc' : 'desc';
      
      switch (sortBy) {
        case 'name':
        case 'memberId':
        case 'dateOfJoining':
        case 'createdAt':
        case 'age':
        case 'location':
        case 'work':
          return { [sortBy]: order };
        case 'pgName':
          return { pg: { name: order } };
        case 'pgLocation':
          return { pg: { location: order } };
        case 'roomNo':
          return { room: { roomNo: order } };
        case 'rentAmount':
          return { room: { rent: order } };
        default:
          return { createdAt: 'desc' };
      }
    };

    // Get total count for pagination (without payment status filter)
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
      orderBy: buildOrderBy(sortBy, sortOrder),
    });

    // Process members and calculate payment status with proper overdue logic
    const processedMembers = members.map((member: any) => {
      const currentMonthPayment = member.payment?.find(
        (p: any) => p.month === currentMonth && p.year === currentYear
      );

      // Flatten the data structure - extract pg and room data to top level
      const { payment, pg, room, ...memberData } = member;
      
      // Determine payment status based on payment record and dates
      let calculatedPaymentStatus = "PENDING";
      
      if (currentMonthPayment) {
        // If payment record exists, determine status based on approval and payment status
        if (currentMonthPayment.approvalStatus === "APPROVED") {
          calculatedPaymentStatus = "PAID";
        } else if (currentMonthPayment.approvalStatus === "REJECTED") {
          calculatedPaymentStatus = "OVERDUE";
        } else if (currentMonthPayment.paymentStatus === "OVERDUE") {
          calculatedPaymentStatus = "OVERDUE";
        } else if (currentMonthPayment.paymentStatus === "PAID") {
          calculatedPaymentStatus = "PENDING"; // Member paid, waiting for approval
        } else {
          // Check if payment is overdue based on overdueDate
          const overdueDate = currentMonthPayment.overdueDate ? new Date(currentMonthPayment.overdueDate) : null;
          if (overdueDate && now > overdueDate) {
            calculatedPaymentStatus = "OVERDUE";
          } else {
            calculatedPaymentStatus = "PENDING";
          }
        }
      } else {
        // No payment record should not happen with our new system, but handle gracefully
        // This means the member should have a payment record but it's missing
        calculatedPaymentStatus = "PENDING";
      }
      
      return {
        ...memberData,
        pgLocation: pg?.location || '',
        pgName: pg?.name || '',
        roomNo: room?.roomNo || '',
        paymentStatus: calculatedPaymentStatus,
        rentAmount: room?.rent || 0,
        currentMonthPayment: currentMonthPayment || null,
        hasCurrentMonthPayment: !!currentMonthPayment,
      };
    });

    // Apply payment status filter after processing (since it's calculated)
    let filteredMembers = processedMembers;
    if (paymentStatus) {
      filteredMembers = processedMembers.filter((member) => {
        return member.paymentStatus === paymentStatus;
      });
    }

    // Since payment status filter is applied after fetching, we need to handle pagination differently
    // If payment status filter is applied, we need to fetch all and then paginate
    let finalMembers = filteredMembers;
    let finalTotal = total;
    
    if (paymentStatus) {
      // For payment status filter, we need to get all members first, then filter and paginate
      const allMembers = await prisma.member.findMany({
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
        orderBy: buildOrderBy(sortBy, sortOrder),
      });

      const allProcessedMembers = allMembers.map((member: any) => {
        const currentMonthPayment = member.payment?.find(
          (p: any) => p.month === currentMonth && p.year === currentYear
        );

        const { payment, pg, room, ...memberData } = member;
        
        let calculatedPaymentStatus = "PENDING";
        
        if (currentMonthPayment) {
          // Use the same logic as the main processing function
          if (currentMonthPayment.approvalStatus === "APPROVED") {
            calculatedPaymentStatus = "PAID";
          } else if (currentMonthPayment.approvalStatus === "REJECTED") {
            calculatedPaymentStatus = "OVERDUE";
          } else if (currentMonthPayment.paymentStatus === "OVERDUE") {
            calculatedPaymentStatus = "OVERDUE";
          } else if (currentMonthPayment.paymentStatus === "PAID") {
            calculatedPaymentStatus = "PENDING"; // Member paid, waiting for approval
          } else {
            // Check if payment is overdue based on overdueDate
            const overdueDate = currentMonthPayment.overdueDate ? new Date(currentMonthPayment.overdueDate) : null;
            if (overdueDate && now > overdueDate) {
              calculatedPaymentStatus = "OVERDUE";
            } else {
              calculatedPaymentStatus = "PENDING";
            }
          }
        } else {
          // No payment record should not happen with our new system
          calculatedPaymentStatus = "PENDING";
        }
        
        return {
          ...memberData,
          pgLocation: pg?.location || '',
          pgName: pg?.name || '',
          roomNo: room?.roomNo || '',
          paymentStatus: calculatedPaymentStatus,
          rentAmount: room?.rent || 0,
          currentMonthPayment: currentMonthPayment || null,
          hasCurrentMonthPayment: !!currentMonthPayment,
        };
      });

      // Filter by payment status
      const statusFilteredMembers = allProcessedMembers.filter((member) => {
        return member.paymentStatus === paymentStatus;
      });

      // Apply pagination to filtered results
      finalTotal = statusFilteredMembers.length;
      finalMembers = statusFilteredMembers.slice(offset, offset + limit);
    }

    const response = {
      tableData: finalMembers,
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
          .filter(loc => loc.location) // Filter out null/undefined location values
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
        label: "Work Type",
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
        options: rentTypes
          .filter(rt => rt.rentType)
          .map((rentType) => ({
            value: rentType.rentType,
            label: rentType.rentType === 'LONG_TERM' ? 'Long Term' : 'Short Term',
          })),
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

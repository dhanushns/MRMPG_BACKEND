import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { AuthenticatedRequest } from "../middlewares/auth";

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

// Get dashboard statistics in card format (calculate dynamically)
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

    // Calculate current month statistics dynamically
    const [
      totalMembers,
      rentCollection,
      newMembers,
      paymentApprovals,
      registrationApprovals,
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

    const [prevTotalMembers, prevRentCollection, prevNewMembers] =
      await Promise.all([
        // Previous month total members (at the end of previous month)
        prisma.member.count({
          where: {
            pgId: { in: pgIds },
            dateOfJoining: {
              lt: new Date(currentYear, currentMonth - 1, 1),
            },
          },
        }),

        // Previous month rent collection
        prisma.payment.aggregate({
          where: {
            pgId: { in: pgIds },
            month: prevMonth,
            year: prevYear,
            approvalStatus: "APPROVED",
          },
          _sum: { amount: true },
        }),

        // Previous month new members
        prisma.member.count({
          where: {
            pgId: { in: pgIds },
            dateOfJoining: {
              gte: new Date(prevYear, prevMonth - 1, 1),
              lt: new Date(prevYear, prevMonth, 1),
            },
          },
        }),
      ]);

    // Calculate trends
    const totalMemberTrend = totalMembers - prevTotalMembers;
    const totalRentCollection = rentCollection._sum.amount || 0;
    const prevTotalRentCollection = prevRentCollection._sum.amount || 0;
    const totalRentCollectionTrend =
      totalRentCollection - prevTotalRentCollection;
    const totalNewMemberTrend = newMembers - prevNewMembers;

    const lastUpdated = now;

    // Get pending approvals (real-time data with proper overdue detection)
    const [pendingPayments, pendingRegistrations, overduePayments] =
      await Promise.all([
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
      newMembers,
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
    const paymentStatus =
      (req.query.paymentStatus as string) || (req.query.status as string); // Support both field names
    const search = req.query.search as string;

    // Get sorting parameters
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";

    // Parse comma-separated values for multi-select filters (matching filter options)
    const parseMultiSelectValues = (param: string | undefined): string[] => {
      if (!param) return [];
      return param
        .split(",")
        .map((val) => decodeURIComponent(val.trim()))
        .filter((val) => val.length > 0);
    };

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
      isActive: true,
    };

    // Apply filters (matching dashboard filter structure)
    if (pgId && pgIds.includes(pgId)) {
      whereClause.pgId = pgId;
    }

    // Handle multiple work types
    if (works.length > 0) {
      whereClause.work = { in: works };
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

    // Get total count for pagination (without payment status filter)
    const total = await prisma.member.count({
      where: whereClause,
    });

    // Process members and flatten data structure
    const processMembers = (members: any[]) => {
      return members.map((member: any) => {
        const currentMonthPayment = member.payment?.find(
          (p: any) => p.month === currentMonth && p.year === currentYear
        );

        // Flatten the data structure - extract pg and room data to top level
        const { payment, pg, room, ...memberData } = member;

        // Calculate rent amount based on member type
        let rentAmount = 0;
        if (memberData.rentType === 'SHORT_TERM') {
          // For short-term members, calculate total amount for entire stay
          if (memberData.pricePerDay && memberData.dateOfJoining && memberData.dateOfRelieving) {
            const joiningDate = new Date(memberData.dateOfJoining);
            const relievingDate = new Date(memberData.dateOfRelieving);
            const timeDifference = relievingDate.getTime() - joiningDate.getTime();
            const numberOfDays = Math.ceil(timeDifference / (1000 * 3600 * 24));
            rentAmount = numberOfDays * memberData.pricePerDay;
          } else {
            rentAmount = memberData.pricePerDay || 0;
          }
        } else {
          // For long-term members, use room rent
          rentAmount = room?.rent || 0;
        }

        return {
          ...memberData,
          pgLocation: pg?.location || "",
          pgName: pg?.name || "",
          roomNo: room?.roomNo || "", 
          paymentStatus: currentMonthPayment?.paymentStatus || "PENDING",
          approvalStatus: currentMonthPayment?.approvalStatus || "PENDING",
          rentAmount: rentAmount,
          currentMonthPayment: currentMonthPayment || null,
          hasCurrentMonthPayment: !!currentMonthPayment,
        };
      });
    };

    let finalMembers: any[] = [];
    let finalTotal = total;

    if (paymentStatus) {
      // Get all members with payment data for filtering
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

      // Process all members and filter by payment status
      const processedMembers = processMembers(allMembers);
      const statusFilteredMembers = processedMembers.filter((member) => {
        return member.paymentStatus === paymentStatus;
      });

      // Apply pagination to filtered results
      finalTotal = statusFilteredMembers.length;
      finalMembers = statusFilteredMembers.slice(offset, offset + limit);
    } else {
      // No payment status filter - use regular pagination
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

      // Process members with consistent logic
      finalMembers = processMembers(members);
      finalTotal = total;
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

    // Get unique work types from members of admin's PG type
    const workTypes = await prisma.member.findMany({
      where: { pgId: { in: pgIds } },
      select: { work: true },
      distinct: ["work"],
    });

    // Get PG options for admin's PG type
    const pgOptions = await prisma.pG.findMany({
      where: { type: admin.pgType },
      select: { id: true, name: true, location: true },
      orderBy: { name: "asc" },
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
        id: "work",
        label: "Work Type",
        placeholder: "Select work type",
        type: "multiSelect",
        options: workTypes
          .filter((w) => w.work)
          .map((work) => ({
            value: work.work,
            label: work.work,
          })),
        variant: "dropdown" as const,
        searchable: true,
        showSelectAll: true,
      },
      {
        id: "paymentStatus",
        label: "Payment Status",
        placeholder: "Select payment status",
        type: "select",
        options: [
          { value: "PENDING", label: "Pending" },
          { value: "PAID", label: "Paid" },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
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

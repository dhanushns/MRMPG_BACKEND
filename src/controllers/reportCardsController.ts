import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { AuthenticatedRequest } from "../middlewares/auth";
import {
  getWeeklyDateRange,
  getMonthlyDateRange,
  getPreviousPeriodRange,
  getFilteredPgIds,
  formatCurrency,
  formatNumber,
  calculateTrendPercentage,
} from "../utils/reportHelpers";

// Helper function to format weekly report cards
const formatWeeklyReportCards = (
  admin: { pgType: any },
  stats: {
    newMembers: number;
    previousWeekNewMembers: number;
    weeklyRentCollection: number;
    previousWeekRentCollection: number;
    paymentApprovals: number;
    previousWeekPaymentApprovals: number;
    registrationApprovals: number;
    previousWeekRegistrationApprovals: number;
    pendingPayments: number;
    pendingRegistrations: number;
    currentOccupancy: number;
    previousWeekOccupancy: number;
  },
  weekRange: { start: Date; end: Date }
) => {
  const newMemberTrend = stats.newMembers - stats.previousWeekNewMembers;
  const rentTrend = stats.weeklyRentCollection - stats.previousWeekRentCollection;
  const paymentApprovalTrend = stats.paymentApprovals - stats.previousWeekPaymentApprovals;
  const registrationApprovalTrend = stats.registrationApprovals - stats.previousWeekRegistrationApprovals;
  const occupancyTrend = stats.currentOccupancy - stats.previousWeekOccupancy;

  return [
    {
      title: "New Members This Week",
      value: formatNumber(stats.newMembers),
      trend: newMemberTrend >= 0 ? "up" : "down",
      percentage: Math.abs(calculateTrendPercentage(stats.newMembers, stats.previousWeekNewMembers)),
      icon: "userPlus",
      color: "primary",
      subtitle: `${newMemberTrend >= 0 ? 'More' : 'Less'} than previous week`,
    },
    {
      title: "Weekly Rent Collection",
      value: formatCurrency(stats.weeklyRentCollection),
      trend: rentTrend >= 0 ? "up" : "down",
      percentage: Math.abs(calculateTrendPercentage(stats.weeklyRentCollection, stats.previousWeekRentCollection)),
      icon: "indianRupee",
      color: "success",
      subtitle: `Week of ${weekRange.start.toLocaleDateString()} - ${weekRange.end.toLocaleDateString()}`,
    },
    {
      title: "Payment Approvals",
      value: formatNumber(stats.paymentApprovals),
      trend: paymentApprovalTrend >= 0 ? "up" : "down",
      percentage: Math.abs(calculateTrendPercentage(stats.paymentApprovals, stats.previousWeekPaymentApprovals)),
      icon: "checkCircle2",
      color: "success",
      subtitle: `${paymentApprovalTrend >= 0 ? 'More' : 'Less'} approvals than last week`,
    },
    {
      title: "Registration Approvals",
      value: formatNumber(stats.registrationApprovals),
      trend: registrationApprovalTrend >= 0 ? "up" : "down",
      percentage: Math.abs(calculateTrendPercentage(stats.registrationApprovals, stats.previousWeekRegistrationApprovals)),
      icon: "userCheck",
      color: "primary",
      subtitle: `${registrationApprovalTrend >= 0 ? 'More' : 'Less'} than previous week`,
    },
    {
      title: "Current Occupancy Rate",
      value: `${stats.currentOccupancy.toFixed(1)}%`,
      trend: occupancyTrend >= 0 ? "up" : "down",
      percentage: Math.abs(occupancyTrend),
      icon: "building",
      color: "info",
      subtitle: `${occupancyTrend >= 0 ? 'Increased' : 'Decreased'} from last week`,
    },
    {
      title: "Pending Actions",
      value: formatNumber(stats.pendingPayments + stats.pendingRegistrations),
      icon: "clock",
      color: "warning",
      subtitle: `${stats.pendingPayments} payments, ${stats.pendingRegistrations} registrations`,
      ...(stats.pendingPayments + stats.pendingRegistrations > 0 && {
        badge: {
          text: "Action Required",
          color: "error",
        },
      }),
    },
  ];
};

// Helper function to format monthly report cards
const formatMonthlyReportCards = (
  admin: { pgType: any },
  stats: {
    newMembers: number;
    previousMonthNewMembers: number;
    monthlyRentCollection: number;
    previousMonthRentCollection: number;
    paymentApprovals: number;
    previousMonthPaymentApprovals: number;
    registrationApprovals: number;
    previousMonthRegistrationApprovals: number;
    pendingPayments: number;
    pendingRegistrations: number;
    currentOccupancy: number;
    previousMonthOccupancy: number;
    totalRevenue: number;
    previousMonthRevenue: number;
  },
  monthRange: { start: Date; end: Date }
) => {
  const newMemberTrend = stats.newMembers - stats.previousMonthNewMembers;
  const rentTrend = stats.monthlyRentCollection - stats.previousMonthRentCollection;
  const paymentApprovalTrend = stats.paymentApprovals - stats.previousMonthPaymentApprovals;
  const registrationApprovalTrend = stats.registrationApprovals - stats.previousMonthRegistrationApprovals;
  const occupancyTrend = stats.currentOccupancy - stats.previousMonthOccupancy;
  const revenueTrend = stats.totalRevenue - stats.previousMonthRevenue;

  return [
    {
      title: "New Members This Month",
      value: formatNumber(stats.newMembers),
      trend: newMemberTrend >= 0 ? "up" : "down",
      percentage: Math.abs(calculateTrendPercentage(stats.newMembers, stats.previousMonthNewMembers)),
      icon: "userPlus",
      color: "primary",
      subtitle: `${newMemberTrend >= 0 ? 'More' : 'Less'} than previous month`,
    },
    {
      title: "Monthly Rent Collection",
      value: formatCurrency(stats.monthlyRentCollection),
      trend: rentTrend >= 0 ? "up" : "down",
      percentage: Math.abs(calculateTrendPercentage(stats.monthlyRentCollection, stats.previousMonthRentCollection)),
      icon: "indianRupee",
      color: "success",
      subtitle: `Month of ${monthRange.start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      trend: revenueTrend >= 0 ? "up" : "down",
      percentage: Math.abs(calculateTrendPercentage(stats.totalRevenue, stats.previousMonthRevenue)),
      icon: "trendingUp",
      color: "success",
      subtitle: `${revenueTrend >= 0 ? 'Increased' : 'Decreased'} from last month`,
    },
    {
      title: "Payment Approvals",
      value: formatNumber(stats.paymentApprovals),
      trend: paymentApprovalTrend >= 0 ? "up" : "down",
      percentage: Math.abs(calculateTrendPercentage(stats.paymentApprovals, stats.previousMonthPaymentApprovals)),
      icon: "checkCircle2",
      color: "success",
      subtitle: `${paymentApprovalTrend >= 0 ? 'More' : 'Less'} approvals than last month`,
    },
    {
      title: "Current Occupancy Rate",
      value: `${stats.currentOccupancy.toFixed(1)}%`,
      trend: occupancyTrend >= 0 ? "up" : "down",
      percentage: Math.abs(occupancyTrend),
      icon: "building",
      color: "info",
      subtitle: `${occupancyTrend >= 0 ? 'Increased' : 'Decreased'} from last month`,
    },
    {
      title: "Pending Actions",
      value: formatNumber(stats.pendingPayments + stats.pendingRegistrations),
      icon: "clock",
      color: "warning",
      subtitle: `${stats.pendingPayments} payments, ${stats.pendingRegistrations} registrations`,
      ...(stats.pendingPayments + stats.pendingRegistrations > 0 && {
        badge: {
          text: "Action Required",
          color: "error",
        },
      }),
    },
  ];
};

// Get weekly report cards
export const getWeeklyReportCards = async (
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

    // Get admin details
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

    const {
      dateRange = 'last7days',
      startDate,
      endDate,
      pgLocation,
      pgId,
    } = req.query;

    // Get date range - use custom dates if provided, otherwise use dateRange
    const weekRange = getWeeklyDateRange(
      startDate && endDate ? 'custom' : (dateRange as string),
      startDate as string,
      endDate as string
    );

    // Get previous week range for trend comparison
    const previousWeekRange = getPreviousPeriodRange(weekRange, 'weekly');

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      pgLocation as string,
      pgId as string
    );

    // Update overdue payment statuses in real-time before calculating stats
    const currentTime = new Date();
    await prisma.payment.updateMany({
      where: {
        member: { pgId: { in: filteredPgIds } },
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

    // Calculate weekly stats with proper date filtering and improved overdue detection
    const [
      // Current week stats
      newMembers,
      weeklyRentCollection,
      paymentApprovals,
      
      // Previous week stats for comparison
      previousWeekNewMembers,
      previousWeekRentCollection,
      previousWeekPaymentApprovals,
      
      // Current pending and overdue items (not date-restricted as they represent current state)
      pendingPayments,
      overduePayments,
      pendingRegistrations,
      
      // Occupancy data
      totalRooms,
      occupiedRooms,
      
      // Member registrations approved in current week
      registrationApprovals,
      previousWeekRegistrationApprovals,
    ] = await Promise.all([
      // Current week - New members (members created in this week range)
      prisma.member.count({
        where: {
          pgId: { in: filteredPgIds },
          createdAt: {
            gte: weekRange.start,
            lte: weekRange.end,
          },
        },
      }),
      
      // Current week - Rent collection (approved payments in this week)
      prisma.payment.aggregate({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "APPROVED",
          updatedAt: { // Use updatedAt for when approval happened
            gte: weekRange.start,
            lte: weekRange.end,
          },
        },
        _sum: { amount: true },
      }),
      
      // Current week - Payment approvals (payments approved in this week)
      prisma.payment.count({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "APPROVED",
          updatedAt: { // Use updatedAt for when approval happened
            gte: weekRange.start,
            lte: weekRange.end,
          },
        },
      }),
      
      // Previous week - New members
      prisma.member.count({
        where: {
          pgId: { in: filteredPgIds },
          createdAt: {
            gte: previousWeekRange.start,
            lte: previousWeekRange.end,
          },
        },
      }),
      
      // Previous week - Rent collection
      prisma.payment.aggregate({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "APPROVED",
          updatedAt: {
            gte: previousWeekRange.start,
            lte: previousWeekRange.end,
          },
        },
        _sum: { amount: true },
      }),
      
      // Previous week - Payment approvals
      prisma.payment.count({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "APPROVED",
          updatedAt: {
            gte: previousWeekRange.start,
            lte: previousWeekRange.end,
          },
        },
      }),
      
      // Current pending payments (current state, not date-restricted)
      prisma.payment.count({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "PENDING",
        },
      }),
      
      // Current overdue payments (current state with real-time detection)
      prisma.payment.count({
        where: {
          member: { pgId: { in: filteredPgIds } },
          OR: [
            { paymentStatus: "OVERDUE" },
            {
              overdueDate: { lt: currentTime },
              approvalStatus: "PENDING",
            },
          ],
        },
      }),
      
      // Current pending registrations (current state)
      prisma.registeredMember.count({
        where: { pgType: admin.pgType },
      }),
      
      // Total rooms for occupancy calculation
      prisma.room.count({
        where: { pGId: { in: filteredPgIds } },
      }),
      
      // Occupied rooms (current state)
      prisma.room.count({
        where: {
          pGId: { in: filteredPgIds },
          members: { some: {} },
        },
      }),
      
      // Registration approvals in current week (members who were approved/migrated in this week)
      prisma.member.count({
        where: {
          pgId: { in: filteredPgIds },
          createdAt: {
            gte: weekRange.start,
            lte: weekRange.end,
          },
        },
      }),
      
      // Registration approvals in previous week
      prisma.member.count({
        where: {
          pgId: { in: filteredPgIds },
          createdAt: {
            gte: previousWeekRange.start,
            lte: previousWeekRange.end,
          },
        },
      }),
    ]);

    // Calculate occupancy rates
    const currentOccupancy = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
    const previousWeekOccupancy = currentOccupancy; // For now, using same value (would need historical data for accurate comparison)

    // Format stats for cards
    const weeklyStats = {
      newMembers,
      previousWeekNewMembers,
      weeklyRentCollection: weeklyRentCollection._sum.amount || 0,
      previousWeekRentCollection: previousWeekRentCollection._sum.amount || 0,
      paymentApprovals,
      previousWeekPaymentApprovals,
      registrationApprovals,
      previousWeekRegistrationApprovals,
      pendingPayments,
      pendingRegistrations,
      currentOccupancy,
      previousWeekOccupancy,
    };

    // Generate cards with additional pending/overdue info
    const cards = formatWeeklyReportCards(admin, weeklyStats, weekRange);
    
    // Update the pending actions card to include overdue payments
    const pendingActionsCardIndex = cards.findIndex(card => card.title === "Pending Actions");
    if (pendingActionsCardIndex !== -1) {
      cards[pendingActionsCardIndex] = {
        ...cards[pendingActionsCardIndex],
        value: formatNumber(pendingPayments + pendingRegistrations + overduePayments),
        subtitle: `${pendingPayments} payments, ${overduePayments} overdue, ${pendingRegistrations} registrations`,
        ...(pendingPayments + pendingRegistrations + overduePayments > 0 && {
          badge: {
            text: "Action Required",
            color: "error",
          },
        }),
      };
    }

    res.status(200).json({
      success: true,
      message: "Weekly report cards retrieved successfully",
      data: {
        cards,
        weekRange: {
          start: weekRange.start.toISOString(),
          end: weekRange.end.toISOString(),
        },
        lastUpdated: new Date(),
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting weekly report cards:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve weekly report cards",
    } as ApiResponse<null>);
  }
};

// Get monthly report cards (placeholder for future implementation)
export const getMonthlyReportCards = async (
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

    // Get admin details
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

    // Parse query parameters - prioritize startDate/endDate if provided
    const {
      dateRange = 'current_month',
      month,
      year,
      startDate,
      endDate,
      pgLocation,
      pgId,
    } = req.query;

    // Get date range - use custom dates if provided, otherwise use dateRange
    const monthRange = startDate && endDate ? 
      getMonthlyDateRange('custom', undefined, undefined, startDate as string, endDate as string) :
      getMonthlyDateRange(
        dateRange as string,
        month ? parseInt(month as string) : undefined,
        year ? parseInt(year as string) : undefined,
        startDate as string,
        endDate as string
      );

    // Get previous month range for trend comparison
    const previousMonthRange = getPreviousPeriodRange(monthRange, 'monthly');

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      pgLocation as string,
      pgId as string
    );

    // Update overdue payment statuses in real-time before calculating stats
    const currentTime = new Date();
    await prisma.payment.updateMany({
      where: {
        member: { pgId: { in: filteredPgIds } },
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

    // Calculate monthly stats with improved overdue detection with proper date filtering
    const [
      // Current month stats
      newMembers,
      monthlyRentCollection,
      paymentApprovals,
      totalRevenue,

      // Previous month stats for comparison
      previousMonthNewMembers,
      previousMonthRentCollection,
      previousMonthPaymentApprovals,
      previousMonthRevenue,

      // Current pending and overdue items (not date-restricted as they represent current state)
      pendingPayments,
      overduePayments,
      pendingRegistrations,

      // Occupancy data
      totalRooms,
      occupiedRooms,
      previousMonthOccupiedRooms,

      // Member registrations approved in current month
      registrationApprovals,
      previousMonthRegistrationApprovals,
    ] = await Promise.all([
      // Current month - New members (members created in this month range)
      prisma.member.count({
        where: {
          pgId: { in: filteredPgIds },
          createdAt: {
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
      }),

      // Current month - Rent collection (approved payments in this month)
      prisma.payment.aggregate({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "APPROVED",
          updatedAt: { // Use updatedAt for when approval happened
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
        _sum: { amount: true },
      }),

      // Current month - Payment approvals (payments approved in this month)
      prisma.payment.count({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "APPROVED",
          updatedAt: { // Use updatedAt for when approval happened
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
      }),

      // Current month - Total revenue (all payments created in this month)
      prisma.payment.aggregate({
        where: {
          member: { pgId: { in: filteredPgIds } },
          createdAt: {
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
        _sum: { amount: true },
      }),

      // Previous month - New members
      prisma.member.count({
        where: {
          pgId: { in: filteredPgIds },
          createdAt: {
            gte: previousMonthRange.start,
            lte: previousMonthRange.end,
          },
        },
      }),

      // Previous month - Rent collection
      prisma.payment.aggregate({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "APPROVED",
          updatedAt: {
            gte: previousMonthRange.start,
            lte: previousMonthRange.end,
          },
        },
        _sum: { amount: true },
      }),

      // Previous month - Payment approvals
      prisma.payment.count({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "APPROVED",
          updatedAt: {
            gte: previousMonthRange.start,
            lte: previousMonthRange.end,
          },
        },
      }),

      // Previous month - Total revenue
      prisma.payment.aggregate({
        where: {
          member: { pgId: { in: filteredPgIds } },
          createdAt: {
            gte: previousMonthRange.start,
            lte: previousMonthRange.end,
          },
        },
        _sum: { amount: true },
      }),

      // Current pending payments (current state, not date-restricted)
      prisma.payment.count({
        where: {
          member: { pgId: { in: filteredPgIds } },
          approvalStatus: "PENDING",
        },
      }),

      // Current overdue payments (current state with real-time detection)
      prisma.payment.count({
        where: {
          member: { pgId: { in: filteredPgIds } },
          OR: [
            { paymentStatus: "OVERDUE" },
            {
              overdueDate: { lt: currentTime },
              approvalStatus: "PENDING",
            },
          ],
        },
      }),

      // Current pending registrations (current state)
      prisma.registeredMember.count({
        where: { pgType: admin.pgType },
      }),

      // Total rooms for occupancy calculation
      prisma.room.count({
        where: { pGId: { in: filteredPgIds } },
      }),

      // Occupied rooms (current month)
      prisma.room.count({
        where: {
          pGId: { in: filteredPgIds },
          members: { some: {} },
        },
      }),

      // Occupied rooms (previous month) - for now using current state
      prisma.room.count({
        where: {
          pGId: { in: filteredPgIds },
          members: { some: {} },
        },
      }),

      // Registration approvals in current month (members who were approved/migrated in this month)
      prisma.member.count({
        where: {
          pgId: { in: filteredPgIds },
          createdAt: {
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
      }),

      // Registration approvals in previous month
      prisma.member.count({
        where: {
          pgId: { in: filteredPgIds },
          createdAt: {
            gte: previousMonthRange.start,
            lte: previousMonthRange.end,
          },
        },
      }),
    ]);

    // Calculate occupancy rates
    const currentOccupancy = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
    const previousMonthOccupancy = totalRooms > 0 ? (previousMonthOccupiedRooms / totalRooms) * 100 : 0;

    // Format stats for cards
    const monthlyStats = {
      newMembers,
      previousMonthNewMembers,
      monthlyRentCollection: monthlyRentCollection._sum.amount || 0,
      previousMonthRentCollection: previousMonthRentCollection._sum.amount || 0,
      paymentApprovals,
      previousMonthPaymentApprovals,
      registrationApprovals,
      previousMonthRegistrationApprovals,
      pendingPayments,
      pendingRegistrations,
      currentOccupancy,
      previousMonthOccupancy,
      totalRevenue: totalRevenue._sum.amount || 0,
      previousMonthRevenue: previousMonthRevenue._sum.amount || 0,
    };

    // Generate cards with additional pending/overdue info
    const cards = formatMonthlyReportCards(admin, monthlyStats, monthRange);
    
    // Update the pending actions card to include overdue payments
    const pendingActionsCardIndex = cards.findIndex(card => card.title === "Pending Actions");
    if (pendingActionsCardIndex !== -1) {
      cards[pendingActionsCardIndex] = {
        ...cards[pendingActionsCardIndex],
        value: formatNumber(pendingPayments + pendingRegistrations + overduePayments),
        subtitle: `${pendingPayments} payments, ${overduePayments} overdue, ${pendingRegistrations} registrations`,
        ...(pendingPayments + pendingRegistrations + overduePayments > 0 && {
          badge: {
            text: "Action Required",
            color: "error",
          },
        }),
      };
    }

    res.status(200).json({
      success: true,
      message: "Monthly report cards retrieved successfully",
      data: {
        cards,
        monthRange: {
          start: monthRange.start.toISOString(),
          end: monthRange.end.toISOString(),
        },
        summary: {
          totalNewMembers: newMembers,
          totalRentCollection: monthlyRentCollection._sum.amount || 0,
          totalRevenue: totalRevenue._sum.amount || 0,
          occupancyRate: currentOccupancy,
          pendingActions: pendingPayments + pendingRegistrations + overduePayments,
          overduePayments: overduePayments,
        },
        lastUpdated: new Date(),
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting monthly report cards:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve monthly report cards",
    } as ApiResponse<null>);
  }
};

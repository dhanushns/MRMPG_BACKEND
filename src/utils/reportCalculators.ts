import { PrismaClient } from "@prisma/client";

export interface PGPerformanceData {
  pgId: string;
  pgName: string;
  pgLocation: string;
  pgType: string;
  totalMembers: number;
  newMembersThisWeek: number;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  occupancyRate: number;
  weeklyRevenue: number;
  pendingPayments: number;
  overduePayments: number;
  paymentApprovalRate: number;
  avgPaymentAmount: number;
  revenuePerMember: number;
}

export interface RoomUtilizationData {
  pgName: string;
  pgLocation: string;
  roomNo: string;
  roomId: string;
  capacity: number;
  currentOccupants: number;
  utilizationRate: number;
  rentAmount: number;
  weeklyRevenue: number;
  isFullyOccupied: boolean;
  revenueEfficiency: number;
}

export interface PaymentAnalyticsData {
  pgName: string;
  pgLocation: string;
  totalPaymentsDue: number;
  paymentsReceived: number;
  paymentsApproved: number;
  paymentsPending: number;
  paymentsOverdue: number;
  totalAmountDue: number;
  totalAmountReceived: number;
  collectionEfficiency: number;
}

export interface FinancialSummaryData {
  pgName: string;
  pgLocation: string;
  expectedRevenue: number;
  actualRevenue: number;
  pendingRevenue: number;
  overdueRevenue: number;
  advanceCollected: number;
  totalCashInflow: number;
  revenueVariance: number;
  cashFlowStatus: string;
  collectionTrend: number;
}

// Helper function to calculate PG performance data with improved payment logic
export const calculatePGPerformance = async (
  prisma: any,
  pgIds: string[],
  startDate: Date,
  endDate: Date
): Promise<PGPerformanceData[]> => {
  // Update overdue payment statuses in real-time before calculating stats
  const currentTime = new Date();
  await prisma.payment.updateMany({
    where: {
      pgId: { in: pgIds },
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

  const pgs = await prisma.pG.findMany({
    where: { id: { in: pgIds } },
    include: {
      members: {
        include: {
          payment: {
            where: {
              OR: [
                { createdAt: { gte: startDate, lte: endDate } },
                { dueDate: { gte: startDate, lte: endDate } },
              ],
            },
          },
          room: { select: { rent: true } },
        },
      },
      rooms: {
        include: {
          members: true,
        },
      },
    },
  });

  return pgs.map((pg: any) => {
    const totalMembers = pg.members.length;
    const newMembersThisWeek = pg.members.filter((m: any) =>
      m.createdAt >= startDate && m.createdAt <= endDate
    ).length;

    const totalRooms = pg.rooms.length;
    const occupiedRooms = pg.rooms.filter((r: any) => r.members.length > 0).length;
    const vacantRooms = totalRooms - occupiedRooms;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Get all payments for this PG in the time range
    const allPayments = pg.members.flatMap((m: any) => m.payment);
    const approvedPayments = allPayments.filter((p: any) => p.approvalStatus === 'APPROVED');
    const pendingPayments = allPayments.filter((p: any) => p.approvalStatus === 'PENDING').length;
    
    // Use real-time overdue detection based on overdueDate
    const overduePayments = allPayments.filter((p: any) => 
      p.paymentStatus === 'OVERDUE' || 
      (p.overdueDate && currentTime > new Date(p.overdueDate))
    ).length;

    const weeklyRevenue = approvedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const avgPaymentAmount = approvedPayments.length > 0 ? weeklyRevenue / approvedPayments.length : 0;
    const paymentApprovalRate = allPayments.length > 0 ? (approvedPayments.length / allPayments.length) * 100 : 0;
    const revenuePerMember = totalMembers > 0 ? weeklyRevenue / totalMembers : 0;

    return {
      pgId: pg.id,
      pgName: pg.name,
      pgLocation: pg.location,
      pgType: pg.type,
      totalMembers,
      newMembersThisWeek,
      totalRooms,
      occupiedRooms,
      vacantRooms,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      weeklyRevenue,
      pendingPayments,
      overduePayments,
      paymentApprovalRate: Math.round(paymentApprovalRate * 100) / 100,
      avgPaymentAmount: Math.round(avgPaymentAmount),
      revenuePerMember: Math.round(revenuePerMember),
    };
  });
};

// Helper function to calculate room utilization data
export const calculateRoomUtilization = async (
  prisma: any,
  pgIds: string[],
  startDate: Date,
  endDate: Date
): Promise<RoomUtilizationData[]> => {
  const rooms = await prisma.room.findMany({
    where: { pGId: { in: pgIds } },
    include: {
      PG: { select: { name: true, location: true } },
      members: {
        include: {
          payment: {
            where: {
              createdAt: { gte: startDate, lte: endDate },
              approvalStatus: 'APPROVED',
            },
          },
        },
      },
    },
  });

  return rooms.map((room: any) => {
    const currentOccupants = room.members.length;
    const utilizationRate = room.capacity > 0 ? (currentOccupants / room.capacity) * 100 : 0;
    const isFullyOccupied = currentOccupants >= room.capacity;

    // Calculate weekly revenue for this room
    const weeklyRevenue = room.members
      .flatMap((m: any) => m.payment)
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const revenueEfficiency = room.rent > 0 ? (weeklyRevenue * 4) / room.rent : 0; // Weekly to monthly comparison

    return {
      pgName: room.PG?.name || '',
      pgLocation: room.PG?.location || '',
      roomNo: room.roomNo,
      roomId: room.id,
      capacity: room.capacity,
      currentOccupants,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      rentAmount: room.rent,
      weeklyRevenue,
      isFullyOccupied,
      revenueEfficiency: Math.round(revenueEfficiency * 100) / 100,
    };
  });
};

// Helper function to calculate payment analytics data with improved overdue detection
export const calculatePaymentAnalytics = async (
  prisma: any,
  pgIds: string[],
  startDate: Date,
  endDate: Date
): Promise<PaymentAnalyticsData[]> => {
  // Update overdue payment statuses in real-time before calculating stats
  const currentTime = new Date();
  await prisma.payment.updateMany({
    where: {
      pgId: { in: pgIds },
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

  const pgs = await prisma.pG.findMany({
    where: { id: { in: pgIds } },
    include: {
      members: {
        include: {
          payment: {
            where: {
              OR: [
                { createdAt: { gte: startDate, lte: endDate } },
                { dueDate: { gte: startDate, lte: endDate } },
              ],
            },
          },
          room: { select: { rent: true } },
        },
      },
    },
  });

  return pgs.map((pg: any) => {
    const allPayments = pg.members.flatMap((m: any) => m.payment);

    // Calculate payment metrics with improved overdue detection
    const paymentsReceived = allPayments.length;
    const paymentsApproved = allPayments.filter((p: any) => p.approvalStatus === 'APPROVED').length;
    const paymentsPending = allPayments.filter((p: any) => p.approvalStatus === 'PENDING').length;
    const paymentsOverdue = allPayments.filter((p: any) => 
      p.paymentStatus === 'OVERDUE' || 
      (p.overdueDate && currentTime > new Date(p.overdueDate))
    ).length;

    // Calculate expected payments based on active members for the period
    const activeMembers = pg.members.filter((m: any) => m.createdAt <= endDate);
    const totalPaymentsDue = activeMembers.length; // Assuming one payment per member for the period

    // Calculate amounts
    const totalAmountReceived = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const approvedAmount = allPayments
      .filter((p: any) => p.approvalStatus === 'APPROVED')
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    
    // Estimate expected amount based on room rents
    const totalAmountDue = activeMembers.reduce((sum: number, m: any) => {
      return sum + (m.room?.rent || 0);
    }, 0);

    const collectionEfficiency = totalAmountDue > 0 ? (approvedAmount / totalAmountDue) * 100 : 0;

    return {
      pgName: pg.name,
      pgLocation: pg.location,
      totalPaymentsDue,
      paymentsReceived,
      paymentsApproved,
      paymentsPending,
      paymentsOverdue,
      totalAmountDue,
      totalAmountReceived,
      collectionEfficiency: Math.round(collectionEfficiency * 100) / 100,
    };
  });
};

// Helper function to calculate financial summary data with improved overdue detection
export const calculateFinancialSummary = async (
  prisma: any,
  pgIds: string[],
  startDate: Date,
  endDate: Date
): Promise<FinancialSummaryData[]> => {
  // Update overdue payment statuses in real-time before calculating stats
  const currentTime = new Date();
  await prisma.payment.updateMany({
    where: {
      pgId: { in: pgIds },
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

  const pgs = await prisma.pG.findMany({
    where: { id: { in: pgIds } },
    include: {
      members: {
        include: {
          payment: {
            where: {
              OR: [
                { createdAt: { gte: startDate, lte: endDate } },
                { dueDate: { gte: startDate, lte: endDate } },
              ],
            },
          },
          room: { select: { rent: true } },
        },
      },
    },
  });

  return pgs.map((pg: any) => {
    const allPayments = pg.members.flatMap((m: any) => m.payment);
    
    // Calculate revenue streams with improved overdue detection
    const actualRevenue = allPayments
      .filter((p: any) => p.approvalStatus === 'APPROVED')
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    
    const pendingRevenue = allPayments
      .filter((p: any) => p.approvalStatus === 'PENDING')
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    
    const overdueRevenue = allPayments
      .filter((p: any) => 
        p.paymentStatus === 'OVERDUE' || 
        (p.overdueDate && currentTime > new Date(p.overdueDate))
      )
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    // Calculate expected revenue based on room rents for active members in the period
    const activeMembers = pg.members.filter((m: any) => m.createdAt <= endDate);
    const expectedRevenue = activeMembers.reduce((sum: number, m: any) => {
      return sum + (m.room?.rent || 0);
    }, 0);

    // Calculate advance collected from new members
    const advanceCollected = pg.members
      .filter((m: any) => m.createdAt >= startDate && m.createdAt <= endDate)
      .reduce((sum: number, m: any) => sum + m.advanceAmount, 0);

    const totalCashInflow = actualRevenue + advanceCollected;
    const revenueVariance = expectedRevenue > 0 ? 
      ((actualRevenue - expectedRevenue) / expectedRevenue) * 100 : 0;

    const cashFlowStatus = totalCashInflow >= expectedRevenue ? 'Positive' : 'Negative';

    // Calculate collection trend (simplified - comparing with previous period would need additional logic)
    const collectionTrend = 0; // Placeholder - would need previous period data

    return {
      pgName: pg.name,
      pgLocation: pg.location,
      expectedRevenue,
      actualRevenue,
      pendingRevenue,
      overdueRevenue,
      advanceCollected,
      totalCashInflow,
      revenueVariance: Math.round(revenueVariance * 100) / 100,
      cashFlowStatus,
      collectionTrend,
    };
  });
};

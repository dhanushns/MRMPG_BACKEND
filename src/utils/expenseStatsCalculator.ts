import prisma from '../config/prisma';
import { PgType, EntryType, PaymentMethod } from '@prisma/client';

/**
 * Calculate expense statistics for a specific month and PG type
 */
export const calculateExpenseStatsForMonth = async (
  month: number,
  year: number,
  pgType: PgType
) => {
  try {
    console.log(`Calculating expense stats for ${pgType} - ${month}/${year}`);

    // Get start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get all PGs of the specified type
    const pgs = await prisma.pG.findMany({
      where: { type: pgType },
      select: { id: true }
    });

    const pgIds = pgs.map(pg => pg.id);

    if (pgIds.length === 0) {
      console.log(`No PGs found for type: ${pgType}`);
      return null;
    }

    // Calculate cash in statistics
    const cashInStats = await prisma.expense.aggregate({
      where: {
        pgId: { in: pgIds },
        entryType: EntryType.CASH_IN,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: { amount: true },
      _count: true
    });

    // Calculate cash out statistics
    const cashOutStats = await prisma.expense.aggregate({
      where: {
        pgId: { in: pgIds },
        entryType: EntryType.CASH_OUT,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: { amount: true },
      _count: true
    });

    // Calculate payment method breakdown for cash in
    const [cashInOnline, cashInCash] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          pgId: { in: pgIds },
          entryType: EntryType.CASH_IN,
          paymentType: PaymentMethod.ONLINE,
          date: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: {
          pgId: { in: pgIds },
          entryType: EntryType.CASH_IN,
          paymentType: PaymentMethod.CASH,
          date: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true }
      })
    ]);

    // Calculate payment method breakdown for cash out
    const [cashOutOnline, cashOutCash] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          pgId: { in: pgIds },
          entryType: EntryType.CASH_OUT,
          paymentType: PaymentMethod.ONLINE,
          date: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: {
          pgId: { in: pgIds },
          entryType: EntryType.CASH_OUT,
          paymentType: PaymentMethod.CASH,
          date: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true }
      })
    ]);

    // Extract values with defaults
    const totalCashInAmount = cashInStats._sum.amount || 0;
    const totalCashInCount = cashInStats._count || 0;
    const totalCashOutAmount = cashOutStats._sum.amount || 0;
    const totalCashOutCount = cashOutStats._count || 0;
    const netAmount = totalCashInAmount - totalCashOutAmount;

    const cashInOnlineAmount = cashInOnline._sum.amount || 0;
    const cashInCashAmount = cashInCash._sum.amount || 0;
    const cashOutOnlineAmount = cashOutOnline._sum.amount || 0;
    const cashOutCashAmount = cashOutCash._sum.amount || 0;

    // Get previous month's data for trend calculation
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;

    const previousStats = await prisma.expenseStats.findUnique({
      where: {
        pgType_month_year: {
          pgType,
          month: previousMonth,
          year: previousYear
        }
      }
    });

    // Calculate percentage changes
    let cashInPercentChange = 0;
    let cashOutPercentChange = 0;
    let netPercentChange = 0;

    if (previousStats) {
      // Calculate cash in percentage change
      if (previousStats.totalCashInAmount > 0) {
        cashInPercentChange = ((totalCashInAmount - previousStats.totalCashInAmount) / previousStats.totalCashInAmount) * 100;
      } else if (totalCashInAmount > 0) {
        cashInPercentChange = 100; // First month with cash in
      }

      // Calculate cash out percentage change
      if (previousStats.totalCashOutAmount > 0) {
        cashOutPercentChange = ((totalCashOutAmount - previousStats.totalCashOutAmount) / previousStats.totalCashOutAmount) * 100;
      } else if (totalCashOutAmount > 0) {
        cashOutPercentChange = 100; // First month with cash out
      }

      // Calculate net percentage change
      if (previousStats.netAmount !== 0) {
        netPercentChange = ((netAmount - previousStats.netAmount) / Math.abs(previousStats.netAmount)) * 100;
      } else if (netAmount !== 0) {
        netPercentChange = netAmount > 0 ? 100 : -100; // First month with net income/loss
      }
    }

    // Round percentage changes to 2 decimal places
    cashInPercentChange = Math.round(cashInPercentChange * 100) / 100;
    cashOutPercentChange = Math.round(cashOutPercentChange * 100) / 100;
    netPercentChange = Math.round(netPercentChange * 100) / 100;

    const statsData = {
      month,
      year,
      pgType,
      totalCashInAmount,
      totalCashInCount,
      totalCashOutAmount,
      totalCashOutCount,
      netAmount,
      cashOutOnline: cashOutOnlineAmount,
      cashOutCash: cashOutCashAmount,
      cashInOnline: cashInOnlineAmount,
      cashInCash: cashInCashAmount,
      cashInPercentChange,
      cashOutPercentChange,
      netPercentChange
    };

    console.log(`Calculated stats for ${pgType} - ${month}/${year}:`, statsData);
    return statsData;

  } catch (error) {
    console.error(`Error calculating expense stats for ${pgType} - ${month}/${year}:`, error);
    throw error;
  }
};

/**
 * Calculate and save expense statistics for both PG types for a specific month
 */
export const calculateAndSaveMonthlyExpenseStats = async (month: number, year: number) => {
  try {
    console.log(`Starting expense stats calculation for ${month}/${year}`);

    const pgTypes: PgType[] = [PgType.MENS, PgType.WOMENS];
    const results = [];

    for (const pgType of pgTypes) {
      try {
        // Calculate stats for this PG type
        const statsData = await calculateExpenseStatsForMonth(month, year, pgType);
        
        if (!statsData) {
          console.log(`No data to save for ${pgType} - ${month}/${year}`);
          continue;
        }

        // Upsert the stats (create or update if exists)
        const savedStats = await prisma.expenseStats.upsert({
          where: {
            pgType_month_year: {
              pgType,
              month,
              year
            }
          },
          create: statsData,
          update: {
            totalCashInAmount: statsData.totalCashInAmount,
            totalCashInCount: statsData.totalCashInCount,
            totalCashOutAmount: statsData.totalCashOutAmount,
            totalCashOutCount: statsData.totalCashOutCount,
            netAmount: statsData.netAmount,
            cashOutOnline: statsData.cashOutOnline,
            cashOutCash: statsData.cashOutCash,
            cashInOnline: statsData.cashInOnline,
            cashInCash: statsData.cashInCash,
            cashInPercentChange: statsData.cashInPercentChange,
            cashOutPercentChange: statsData.cashOutPercentChange,
            netPercentChange: statsData.netPercentChange,
            updatedAt: new Date()
          }
        });

        results.push(savedStats);
        console.log(`Successfully saved expense stats for ${pgType} - ${month}/${year}`);

      } catch (error) {
        console.error(`Failed to calculate/save stats for ${pgType} - ${month}/${year}:`, error);
        // Continue with other PG types even if one fails
      }
    }

    console.log(`Completed expense stats calculation for ${month}/${year}. Processed ${results.length} PG types.`);
    return results;

  } catch (error) {
    console.error(`Error in calculateAndSaveMonthlyExpenseStats for ${month}/${year}:`, error);
    throw error;
  }
};

/**
 * Calculate expense statistics for the previous completed month
 */
export const calculatePreviousMonthStats = async () => {
  const now = new Date();
  const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-based
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  return await calculateAndSaveMonthlyExpenseStats(previousMonth, year);
};

/**
 * Recalculate stats for a specific month (useful for data corrections)
 */
export const recalculateMonthStats = async (month: number, year: number) => {
  console.log(`Recalculating expense stats for ${month}/${year}`);
  return await calculateAndSaveMonthlyExpenseStats(month, year);
};

/**
 * Get expense stats summary for dashboard
 */
export const getExpenseStatsSummary = async (pgType: PgType, year: number) => {
  try {
    const stats = await prisma.expenseStats.findMany({
      where: {
        pgType,
        year
      },
      orderBy: {
        month: 'asc'
      }
    });

    const summary = {
      totalMonths: stats.length,
      totalCashIn: stats.reduce((sum, stat) => sum + stat.totalCashInAmount, 0),
      totalCashOut: stats.reduce((sum, stat) => sum + stat.totalCashOutAmount, 0),
      totalNet: stats.reduce((sum, stat) => sum + stat.netAmount, 0),
      avgMonthlyNetChange: stats.length > 0 ? 
        stats.reduce((sum, stat) => sum + stat.netPercentChange, 0) / stats.length : 0,
      growthMonths: stats.filter(stat => stat.netPercentChange > 0).length,
      declineMonths: stats.filter(stat => stat.netPercentChange < 0).length,
      bestMonth: stats.reduce((best, current) => 
        current.netAmount > best.netAmount ? current : best, stats[0]),
      worstMonth: stats.reduce((worst, current) => 
        current.netAmount < worst.netAmount ? current : worst, stats[0])
    };

    return summary;
  } catch (error) {
    console.error(`Error getting expense stats summary for ${pgType} - ${year}:`, error);
    throw error;
  }
};
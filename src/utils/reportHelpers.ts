// Helper function to get date range for weekly reports
export const getWeeklyDateRange = (dateRange: string, startDate?: string, endDate?: string) => {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now);

  switch (dateRange) {
    case 'last14days':
      start = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
      break;
    case 'custom':
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      }
      break;
    case 'last7days':
    default:
      start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      break;
  }

  // Set to start and end of day
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// Helper function to get date range for monthly reports
export const getMonthlyDateRange = (dateRange: string, month?: number, year?: number, startDate?: string, endDate?: string) => {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (dateRange) {
    case 'current_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'previous_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'last_3_months':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'custom':
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else if (month && year) {
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
  }

  // Set to start and end of day
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// Helper function to parse multi-select filter values
export const parseMultiSelectValues = (param: string | undefined): string[] => {
  if (!param) return [];
  return param.split(',').map(val => decodeURIComponent(val.trim())).filter(val => val.length > 0);
};

// Helper function to calculate trend percentages
export const calculateTrendPercentage = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

// Helper function to format currency
export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString("en-IN")}`;
};

// Helper function to format number with commas
export const formatNumber = (num: number): string => {
  return num.toLocaleString("en-IN");
};

// Helper function to get previous period range
export const getPreviousPeriodRange = (currentRange: { start: Date; end: Date }, periodType: 'weekly' | 'monthly') => {
  const duration = currentRange.end.getTime() - currentRange.start.getTime();
  
  if (periodType === 'weekly') {
    return {
      start: new Date(currentRange.start.getTime() - duration),
      end: new Date(currentRange.end.getTime() - duration),
    };
  } else {
    // For monthly, get the previous month
    const start = new Date(currentRange.start);
    start.setMonth(start.getMonth() - 1);
    const end = new Date(currentRange.end);
    end.setMonth(end.getMonth() - 1);
    return { start, end };
  }
};

// Helper function to get filtered PG IDs based on admin type and filters
export const getFilteredPgIds = async (
  prisma: any,
  adminPgType: string,
  pgLocation?: string,
  pgId?: string
): Promise<string[]> => {
  // Get all PGs of admin's type
  const pgs = await prisma.pG.findMany({
    where: { type: adminPgType },
    select: { id: true },
  });

  let filteredPgIds = pgs.map((pg: any) => pg.id);

  // Filter PGs based on location if specified
  if (pgLocation) {
    const selectedPgLocations = parseMultiSelectValues(pgLocation);
    if (selectedPgLocations.length > 0) {
      const pgsInLocation = await prisma.pG.findMany({
        where: {
          type: adminPgType,
          location: { in: selectedPgLocations },
        },
        select: { id: true },
      });
      filteredPgIds = pgsInLocation.map((pg: any) => pg.id);
    }
  }

  // Filter by specific PG if provided
  if (pgId && filteredPgIds.includes(pgId)) {
    filteredPgIds = [pgId];
  }

  return filteredPgIds;
};

import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { AuthenticatedRequest } from "../middlewares/auth";

// Helper function to calculate member's next due date based on joining date
const calculateMemberNextDueDate = (joiningDate: Date, currentDate: Date = new Date()): Date => {
  const joiningDay = joiningDate.getDate();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Start with current month
  let nextDueDate = new Date(currentYear, currentMonth, joiningDay);
  
  // If the due date for current month has passed, move to next month
  if (nextDueDate <= currentDate) {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }
  
  // Handle cases where the joining day doesn't exist in the target month
  if (nextDueDate.getDate() !== joiningDay) {
    nextDueDate = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0); // Last day of month
  }
  
  return nextDueDate;
};

// Helper function to calculate member's current billing cycle due date
const calculateCurrentBillingCycleDueDate = (joiningDate: Date, currentDate: Date = new Date()): Date => {
  const joiningDay = joiningDate.getDate();
  
  // Start from joining date to find current billing cycle
  let cycleStartDate = new Date(joiningDate);
  let currentDueDate = new Date(joiningDate);
  currentDueDate.setMonth(currentDueDate.getMonth() + 1); // First due date
  
  // Handle month-end edge cases for first due date
  if (currentDueDate.getDate() !== joiningDay) {
    const targetMonth = currentDueDate.getMonth();
    const targetYear = currentDueDate.getFullYear();
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    currentDueDate.setDate(Math.min(joiningDay, lastDayOfMonth));
  }
  
  // If we're still in the first billing cycle, return first due date
  if (currentDate < currentDueDate) {
    return currentDueDate;
  }
  
  // Keep moving forward until we find the current billing cycle
  while (currentDueDate <= currentDate) {
    const nextDueDate = new Date(currentDueDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    
    // Handle month-end edge cases
    if (nextDueDate.getDate() !== joiningDay) {
      const targetMonth = nextDueDate.getMonth();
      const targetYear = nextDueDate.getFullYear();
      const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      nextDueDate.setDate(Math.min(joiningDay, lastDayOfMonth));
    }
    
    // If the next due date would be in the future, current due date is the one we want
    if (nextDueDate > currentDate) {
      break;
    }
    
    currentDueDate = nextDueDate;
  }
  
  return currentDueDate;
};

// Helper function to determine payment status based on member's payment records and real-time overdue detection
const determineMemberPaymentStatus = (
  member: any,
  currentDate: Date = new Date()
): { status: string; currentDueDate: Date | null; isOverdue: boolean } => {
  const joiningDate = new Date(member.dateOfJoining);
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  // Find payment record for current month/year
  const currentMonthPayment = member.payment?.find((p: any) => {
    return p.month === currentMonth && p.year === currentYear;
  });
  
  let status = "PENDING";
  let currentDueDate: Date | null = null;
  let isOverdue = false;
  
  if (currentMonthPayment) {
    // Use existing payment record's due date and status
    currentDueDate = currentMonthPayment.dueDate ? new Date(currentMonthPayment.dueDate) : null;
    const overdueDate = currentMonthPayment.overdueDate ? new Date(currentMonthPayment.overdueDate) : null;
    
    if (currentMonthPayment.approvalStatus === "APPROVED") {
      status = "PAID";
    } else if (currentMonthPayment.approvalStatus === "REJECTED") {
      status = "OVERDUE";
      isOverdue = true;
    } else if (currentMonthPayment.paymentStatus === "OVERDUE" || 
               (overdueDate && currentDate > overdueDate)) {
      status = "OVERDUE";
      isOverdue = true;
    } else {
      status = "PENDING";
    }
  } else {
    // No payment record for current month - calculate due date and check if overdue
    const joiningDay = joiningDate.getDate();
    currentDueDate = new Date(currentYear, currentMonth - 1, joiningDay);
    
    // Handle month-end edge cases
    if (currentDueDate.getDate() !== joiningDay) {
      const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
      currentDueDate.setDate(Math.min(joiningDay, lastDayOfMonth));
    }
    
    // Calculate overdue date (7 days after due date)
    const overdueDate = new Date(currentDueDate);
    overdueDate.setDate(overdueDate.getDate() + 7);
    
    // Check if member should have a payment for current month
    const currentMonthEnd = new Date(currentYear, currentMonth, 0);
    if (joiningDate <= currentMonthEnd) {
      if (currentDate > overdueDate) {
        status = "OVERDUE";
        isOverdue = true;
      } else {
        status = "PENDING";
      }
    }
  }
  
  return { status, currentDueDate, isOverdue };
};

// Get members by rent type with filters
export const getMembersByRentType = async (
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

    // Get rent type from route params
    const rentTypeParam = req.params.rentType as string;
    let rentType: "LONG_TERM" | "SHORT_TERM";

    // Map route param to enum value
    if (rentTypeParam === "long-term") {
      rentType = "LONG_TERM";
    } else if (rentTypeParam === "short-term") {
      rentType = "SHORT_TERM";
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid rent type. Use 'long-term' or 'short-term'",
      } as ApiResponse<null>);
      return;
    }

    // Get pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get filter parameters from query - handle multiple values
    const paymentStatus = req.query.paymentStatus as string;
    const search = req.query.search as string;

    // Parse comma-separated values for multi-select filters
    const parseMultipleValues = (param: string | undefined): string[] => {
      if (!param) return [];
      return param.split(',').map(val => decodeURIComponent(val.trim())).filter(val => val.length > 0);
    };

    const locations = parseMultipleValues(req.query.location as string);
    const pgLocations = parseMultipleValues(req.query.pgLocation as string);
    const works = parseMultipleValues(req.query.work as string);

    // Get sorting parameters
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";

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

    const whereClause: any = {
      pgId: { in: pgIds },
      rentType: rentType,
    };

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

    // Prepare order by clause for sorting
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
        case 'gender':
        case 'email':
        case 'phone':
        case 'rentType':
        case 'advanceAmount':
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
          select: {
            id: true,
            paymentStatus: true,
            approvalStatus: true,
            amount: true,
            month: true,
            year: true,
            dueDate: true,
            overdueDate: true,
          },
        },
      },
      skip: offset,
      take: limit,
      orderBy: buildOrderBy(sortBy, sortOrder),
    });

    // Process members data to determine payment status based on current month payment records
    const processedMembers = members.map((member) => {
      // Flatten the data structure - extract pg and room data to top level
      const { payment, pg, room, ...memberData } = member;
      
      // Determine payment status based on current month payment record
      const { status: calculatedPaymentStatus, currentDueDate, isOverdue } = determineMemberPaymentStatus(member, now);
      
      // Find payment for current month
      const currentMonthPayment = payment?.find((p) => {
        return p.month === currentMonth && p.year === currentYear;
      });
      
      return {
        ...memberData,
        pgLocation: pg?.location || '',
        pgName: pg?.name || '',
        roomNo: room?.roomNo || '',
        rentAmount: room?.rent || 0,
        paymentStatus: calculatedPaymentStatus,
        status: calculatedPaymentStatus, // Additional status field as requested
        currentDueDate: currentDueDate,
        isOverdue: isOverdue,
        nextDueDate: calculateMemberNextDueDate(new Date(memberData.dateOfJoining), now),
        currentMonthPayment: currentMonthPayment || null,
        hasCurrentMonthPayment: !!currentMonthPayment,
      };
    });

    // Filter by payment status if specified
    let filteredMembers = processedMembers;
    if (paymentStatus && ["PAID", "PENDING", "OVERDUE"].includes(paymentStatus)) {
      filteredMembers = processedMembers.filter(
        (member) => member.paymentStatus === paymentStatus
      );
    }

    
    let finalMembers = filteredMembers;
    let finalTotal = total;
    
    if (paymentStatus && ["PAID", "PENDING", "OVERDUE"].includes(paymentStatus)) {
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

      const allProcessedMembers = allMembers.map((member) => {
        // Flatten the data structure - extract pg and room data to top level
        const { payment, pg, room, ...memberData } = member;
        
        // Determine payment status based on current month payment record
        const { status: calculatedPaymentStatus, currentDueDate, isOverdue } = determineMemberPaymentStatus(member, now);
        
        // Find payment for current month
        const currentMonthPayment = payment?.find((p) => {
          return p.month === currentMonth && p.year === currentYear;
        });
        
        return {
          ...memberData,
          pgLocation: pg?.location || '',
          pgName: pg?.name || '',
          roomNo: room?.roomNo || '',
          rentAmount: room?.rent || 0,
          paymentStatus: calculatedPaymentStatus,
          status: calculatedPaymentStatus,
          currentDueDate: currentDueDate,
          isOverdue: isOverdue,
          nextDueDate: calculateMemberNextDueDate(new Date(memberData.dateOfJoining), now),
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

    res.status(200).json({
      success: true,
      message: `${rentType.toLowerCase().replace('_', '-')} members retrieved successfully`,
      data: {
        tableData: finalMembers,
      },
      pagination: {
        page,
        limit,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / limit),
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting members by rent type:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve members",
    } as ApiResponse<null>);
  }
};

// Get filter options for member filtering
export const getMemberFilterOptions = async (
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
      message: "Member filter options retrieved successfully",
      data: { 
        filters, 
        totalPGs: pgs.length,
        totalRooms: rooms.length 
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting member filter options:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve member filter options",
    } as ApiResponse<null>);
  }
};

// Get detailed member information including payment history
export const getMemberDetails = async (
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

    const { memberId } = req.params;

    // Get pagination parameters for payment history
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Find the member with all related data
    const member = await prisma.member.findUnique({
      where: { id: memberId },
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

    if (!member) {
      res.status(404).json({
        success: false,
        message: "Member not found",
      } as ApiResponse<null>);
      return;
    }

    // Verify admin can access this member (same pgType)
    if (member.pg.type !== admin.pgType) {
      res.status(403).json({
        success: false,
        message: "You can only access members of your PG type",
      } as ApiResponse<null>);
      return;
    }

    // Calculate tenure
    const now = new Date();
    const joiningDate = new Date(member.dateOfJoining);
    const diffTime = Math.abs(now.getTime() - joiningDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = diffDays % 30;

    // Get all payments for accurate calculation
    const allPayments = await prisma.payment.findMany({
      where: { memberId: member.id },
      select: {
        id: true,
        amount: true,
        paymentStatus: true,
        approvalStatus: true,
        dueDate: true,
        overdueDate: true,
        paidDate: true,
        month: true,
        year: true,
        createdAt: true,
      },
    });

    // Get payment history with pagination
    const paymentHistory = allPayments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);

    // Calculate payment summary based on member's individual billing cycles
    const memberJoiningDate = new Date(member.dateOfJoining);
    
    let approvedPaymentsCount = 0;
    let pendingPaymentsCount = 0;
    let rejectedPaymentsCount = 0;
    let overduePaymentsCount = 0;
    let totalAmountPaid = 0;
    let totalAmountPending = 0;
    let totalAmountRejected = 0;
    let totalAmountOverdue = 0;
    let lastPaymentDate: Date | null = null;
    let lastApprovedPayment: Date | null = null;

    // Process existing payment records
    allPayments.forEach((payment) => {
      const paymentDate = payment.paidDate ? new Date(payment.paidDate) : null;

      // Update last payment date regardless of status
      if (paymentDate && (!lastPaymentDate || paymentDate > lastPaymentDate)) {
        lastPaymentDate = paymentDate;
      }

      // Categorize payments based on approval status
      if (payment.approvalStatus === "APPROVED") {
        approvedPaymentsCount++;
        totalAmountPaid += payment.amount;
        
        if (paymentDate && (!lastApprovedPayment || paymentDate > lastApprovedPayment)) {
          lastApprovedPayment = paymentDate;
        }
      } else if (payment.approvalStatus === "REJECTED") {
        rejectedPaymentsCount++;
        totalAmountRejected += payment.amount;
        
        // Rejected payments are also overdue since they need to be paid again
        overduePaymentsCount++;
        totalAmountOverdue += payment.amount;
      } else if (payment.approvalStatus === "PENDING") {
        // Check if payment is overdue based on overdue date
        const overdueDate = payment.overdueDate ? new Date(payment.overdueDate) : null;
        const isOverdue = payment.paymentStatus === "OVERDUE" || 
                         (overdueDate && now > overdueDate);

        if (isOverdue) {
          overduePaymentsCount++;
          totalAmountOverdue += payment.amount;
        } else {
          pendingPaymentsCount++;
          totalAmountPending += payment.amount;
        }
      } else {
        // Handle null or other approval statuses
        const overdueDate = payment.overdueDate ? new Date(payment.overdueDate) : null;
        const isOverdue = payment.paymentStatus === "OVERDUE" || 
                         (overdueDate && now > overdueDate);

        if (isOverdue) {
          overduePaymentsCount++;
          totalAmountOverdue += payment.amount;
        } else {
          pendingPaymentsCount++;
          totalAmountPending += payment.amount;
        }
      }
    });

    // Calculate next due date
    const nextDueDate = calculateMemberNextDueDate(memberJoiningDate, now);

    // Format member data
    const { pg, room, ...memberData } = member;
    const formattedMember = {
      ...memberData,
      pgDetails: pg,
      roomDetails: room,
      tenure: {
        days,
        months,
        years,
      },
    };

    // Simplified payment summary with only essential fields
    const paymentSummary = {
      approvedPayments: approvedPaymentsCount,
      pendingPayments: pendingPaymentsCount,
      rejectedPayments: rejectedPaymentsCount,
      overduePayments: overduePaymentsCount,
      totalAmountPaid,
      totalAmountPending,
      totalAmountRejected,
      totalAmountOverdue,
      lastPaymentDate,
      lastApprovedPayment,
      nextDueDate,
    };

    res.status(200).json({
      success: true,
      message: "Member details retrieved successfully",
      data: {
        member: formattedMember,
        paymentHistory: {
          data: paymentHistory,
          pagination: {
            page,
            limit,
            total: allPayments.length,
            totalPages: Math.ceil(allPayments.length / limit),
          },
        },
        paymentSummary,
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting member details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve member details",
    } as ApiResponse<null>);
  }
};
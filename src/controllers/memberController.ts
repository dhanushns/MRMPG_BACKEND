import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { AuthenticatedRequest } from "../middlewares/auth";

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
    const orderByClause: any = {};

    // Valid sortable fields from Member model
    const validSortFields = [
      "name",
      "age",
      "gender",
      "location",
      "email",
      "phone",
      "work",
      "rentType",
      "advanceAmount",
      "dateOfJoining",
      "createdAt",
      "updatedAt",
    ];

    if (validSortFields.includes(sortBy)) {
      orderByClause[sortBy] = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderByClause.createdAt = "desc"; // Default sorting
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
      orderBy: orderByClause,
    });

    // Process members data to determine payment status
    const processedMembers = members.map((member) => {
      // Determine payment status based on due dates and approval status
      let paymentStatus: "PAID" | "PENDING" | "OVERDUE" = "PENDING";

      // Find the most relevant payment (closest to current date or current month)
      const relevantPayment = member.payment.find(
        (p) => {
          // Prioritize current calendar month
          if (p.month === currentMonth && p.year === currentYear) {
            return true;
          }
          // Or find payment with due date closest to now
          if (p.dueDate) {
            const daysDiff = Math.abs((now.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff <= 30; // Within 30 days
          }
          return false;
        }
      ) || member.payment[0]; // Fallback to first payment if any

      if (relevantPayment) {
        // Calculate payment status based on approval status and due dates
        if (relevantPayment.approvalStatus === "APPROVED") {
          paymentStatus = "PAID";
        } else if (relevantPayment.approvalStatus === "REJECTED") {
          paymentStatus = "OVERDUE";
        } else {
          // Check if payment is overdue based on overdueDate
          if (relevantPayment.overdueDate && now > new Date(relevantPayment.overdueDate)) {
            paymentStatus = "OVERDUE";
          } else if (relevantPayment.dueDate && now > new Date(relevantPayment.dueDate)) {
            // Past due date but within grace period
            paymentStatus = "PENDING";
          } else {
            paymentStatus = "PENDING";
          }
        }
      } else {
        // No payment record found - check if member should have a payment by now
        const memberJoiningDate = new Date(member.dateOfJoining);
        const oneMonthAfterJoining = new Date(memberJoiningDate);
        oneMonthAfterJoining.setMonth(oneMonthAfterJoining.getMonth() + 1);
        
        const overdueThreshold = new Date(oneMonthAfterJoining);
        overdueThreshold.setDate(overdueThreshold.getDate() + 5);

        if (now > overdueThreshold) {
          paymentStatus = "OVERDUE";
        } else if (now > oneMonthAfterJoining) {
          paymentStatus = "PENDING";
        } else {
          // Member hasn't reached their first payment due date yet
          paymentStatus = "PENDING";
        }
      }

      // Flatten the data structure - extract pg and room data to top level
      const { payment, pg, room, ...memberData } = member;
      
      return {
        ...memberData,
        pgLocation: pg?.location || "",
        pgName: pg?.name || "",
        roomNo: room?.roomNo || "",
        rent: room?.rent || 0,
        paymentStatus,
        status: paymentStatus, // Additional status field as requested
        currentMonthPayment: relevantPayment ? {
          paymentStatus: relevantPayment.paymentStatus,
          approvalStatus: relevantPayment.approvalStatus,
          amount: relevantPayment.amount,
          dueDate: relevantPayment.dueDate,
          overdueDate: relevantPayment.overdueDate,
        } : null,
      };
    });

    // Filter by payment status if specified
    let filteredMembers = processedMembers;
    if (
      paymentStatus &&
      ["PAID", "PENDING", "OVERDUE"].includes(paymentStatus)
    ) {
      filteredMembers = processedMembers.filter(
        (member) => member.paymentStatus === paymentStatus
      );
    }

    // Recalculate total count if payment status filter is applied
    let finalTotal = total;
    if (
      paymentStatus &&
      ["PAID", "PENDING", "OVERDUE"].includes(paymentStatus)
    ) {
      // For payment status filter, we need to count all matching members
      // and then apply the payment status filter
      const allMembers = await prisma.member.findMany({
        where: whereClause,
        include: {
          payment: {
            where: {
              month: currentMonth,
              year: currentYear,
            },
            select: {
              paymentStatus: true,
              approvalStatus: true,
              month: true,
              year: true,
            },
          },
        },
      });

      const allProcessedMembers = allMembers.map((member) => {
        let memberPaymentStatus: "PAID" | "PENDING" | "OVERDUE" = "PENDING";

        const currentMonthPayment = member.payment.find(
          (p) => p.month === currentMonth && p.year === currentYear
        );

        if (currentMonthPayment) {
          if (currentMonthPayment.approvalStatus === "APPROVED") {
            memberPaymentStatus = "PAID";
          } else if (
            currentMonthPayment.approvalStatus === "REJECTED" ||
            currentMonthPayment.paymentStatus === "OVERDUE"
          ) {
            memberPaymentStatus = "OVERDUE";
          } else {
            memberPaymentStatus = "PENDING";
          }
        } else {
          const memberJoiningDate = new Date(member.dateOfJoining);
          const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
          const currentMonthEnd = new Date(currentYear, currentMonth, 0);

          if (
            memberJoiningDate >= currentMonthStart &&
            memberJoiningDate <= currentMonthEnd
          ) {
            const overdueDate = new Date(memberJoiningDate);
            overdueDate.setDate(overdueDate.getDate() + 5);
            if (now > overdueDate) {
              memberPaymentStatus = "OVERDUE";
            }
          } else if (memberJoiningDate < currentMonthStart) {
            const fifthOfMonth = new Date(currentYear, currentMonth - 1, 5);
            if (now > fifthOfMonth) {
              memberPaymentStatus = "OVERDUE";
            }
          }
        }

        return { ...member, paymentStatus: memberPaymentStatus };
      });

      finalTotal = allProcessedMembers.filter(
        (member) => member.paymentStatus === paymentStatus
      ).length;
    }

    res.status(200).json({
      success: true,
      message: `${rentType.toLowerCase().replace('_', '-')} members retrieved successfully`,
      data: {
        tableData: filteredMembers,
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
        id: "location",
        label: "Location",
        placeholder: "Select location",
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
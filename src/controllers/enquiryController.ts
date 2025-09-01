import { Response, Request } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { CreateEnquiryRequest, UpdateEnquiryStatusRequest } from "../types/request";
import { AuthenticatedRequest } from "../middlewares/auth";

// CREATE new enquiry (public route - no authentication required)
export const createEnquiry = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, phone, message }: CreateEnquiryRequest = req.body;

    // Create new enquiry
    const newEnquiry = await prisma.enquiry.create({
      data: {
        name,
        phone,
        message,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully. We will get back to you soon.",
      data: newEnquiry,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error creating enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to submit enquiry",
    } as ApiResponse<null>);
  }
};

// GET all enquiries (admin only - both admin types can view)
export const getEnquiries = async (
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

    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Parse pagination parameters
    const pageNumber = parseInt(page as string, 10) || 1;
    const pageSize = parseInt(limit as string, 10) || 10;
    const skip = (pageNumber - 1) * pageSize;

    // Build where clause for filtering
    const whereClause: any = {};

    // Filter by status if provided
    if (status && typeof status === "string") {
      whereClause.status = status;
    }

    // Search in name, phone, or message
    if (search && typeof search === "string") {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build order by clause
    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    // Get total count for pagination
    const totalCount = await prisma.enquiry.count({
      where: whereClause,
    });

    // Get enquiries with pagination
    const enquiries = await prisma.enquiry.findMany({
      where: whereClause,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        message: true,
        status: true,
        resolvedBy: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
            pgType: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      success: true,
      message: "Enquiries retrieved successfully",
      data: {
        enquiries,
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total: totalCount,
          totalPages,
        },
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting enquiries:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve enquiries",
    } as ApiResponse<null>);
  }
};

// GET single enquiry by ID (admin only)
export const getEnquiryById = async (
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

    const { enquiryId } = req.params;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      select: {
        id: true,
        name: true,
        phone: true,
        message: true,
        status: true,
        resolvedBy: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
            pgType: true,
          },
        },
      },
    });

    if (!enquiry) {
      res.status(404).json({
        success: false,
        message: "Enquiry not found",
      } as ApiResponse<null>);
      return;
    }

    res.status(200).json({
      success: true,
      message: "Enquiry retrieved successfully",
      data: enquiry,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve enquiry",
    } as ApiResponse<null>);
  }
};

// UPDATE enquiry status (admin only)
export const updateEnquiryStatus = async (
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

    const { enquiryId } = req.params;
    const { status }: UpdateEnquiryStatusRequest = req.body;

    // Check if enquiry exists
    const existingEnquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      select: { id: true, status: true },
    });

    if (!existingEnquiry) {
      res.status(404).json({
        success: false,
        message: "Enquiry not found",
      } as ApiResponse<null>);
      return;
    }

    // Prepare update data
    const updateData: any = { status };

    // If status is being set to RESOLVED and it wasn't resolved before
    if (status === "RESOLVED" && existingEnquiry.status !== "RESOLVED") {
      updateData.resolvedBy = req.admin.id;
      updateData.resolvedAt = new Date();
    }

    // If status is being set to NOT_RESOLVED, clear resolved fields
    if (status === "NOT_RESOLVED") {
      updateData.resolvedBy = null;
      updateData.resolvedAt = null;
    }

    // Update enquiry
    const updatedEnquiry = await prisma.enquiry.update({
      where: { id: enquiryId },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        message: true,
        status: true,
        resolvedBy: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
            pgType: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: `Enquiry status updated to ${status.toLowerCase().replace("_", " ")}`,
      data: updatedEnquiry,
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error updating enquiry status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to update enquiry status",
    } as ApiResponse<null>);
  }
};

// GET enquiry statistics (admin only)
export const getEnquiryStats = async (
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

    // Get total enquiries count
    const totalEnquiries = await prisma.enquiry.count();

    // Get resolved enquiries count
    const resolvedEnquiries = await prisma.enquiry.count({
      where: { status: "RESOLVED" },
    });

    // Get pending enquiries count
    const pendingEnquiries = await prisma.enquiry.count({
      where: { status: "NOT_RESOLVED" },
    });

    // Get today's enquiries count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnquiries = await prisma.enquiry.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    });

    // Calculate resolution rate
    const resolutionRate = totalEnquiries > 0 ? Math.round((resolvedEnquiries / totalEnquiries) * 100) : 0;

    // Format number with commas
    const formatNumber = (num: number): string => {
      return num.toLocaleString("en-IN");
    };

    // Format statistics as cards
    const enquiryStatsCards = [
      {
        title: "Total Enquiries",
        value: formatNumber(totalEnquiries),
        icon: "messageCircle",
        color: "primary",
        subtitle: `${formatNumber(todayEnquiries)} new enquiries today`,
      },
      {
        title: "Resolved Enquiries",
        value: formatNumber(resolvedEnquiries),
        icon: "checkCircle",
        color: resolvedEnquiries > 0 ? "success" : "neutral",
        subtitle: `${resolutionRate}% resolution rate`,
        ...(resolutionRate === 100 && totalEnquiries > 0 && {
          badge: {
            text: "Perfect!",
            color: "success",
          },
        }),
      },
      {
        title: "Pending Enquiries",
        value: formatNumber(pendingEnquiries),
        icon: "clock",
        color: pendingEnquiries > 0 ? "warning" : "success",
        subtitle: `${Math.round((pendingEnquiries / (totalEnquiries || 1)) * 100)}% of total enquiries`,
        ...(pendingEnquiries > 0 && {
          badge: {
            text: "Action Required",
            color: "warning",
          },
        }),
      },
    ];

    res.status(200).json({
      success: true,
      message: "Enquiry statistics retrieved successfully",
      data: {
        cards: enquiryStatsCards,
        summary: {
          totalEnquiries,
          resolvedEnquiries,
          pendingEnquiries,
          todayEnquiries,
          resolutionRate,
        },
        lastUpdated: new Date(),
      },
    } as ApiResponse<any>);
  } catch (error) {
    console.error("Error getting enquiry statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve enquiry statistics",
    } as ApiResponse<null>);
  }
};

// DELETE enquiry (admin only)
export const deleteEnquiry = async (
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

    const { enquiryId } = req.params;

    // Check if enquiry exists
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      select: { id: true },
    });

    if (!enquiry) {
      res.status(404).json({
        success: false,
        message: "Enquiry not found",
      } as ApiResponse<null>);
      return;
    }

    // Delete enquiry
    await prisma.enquiry.delete({
      where: { id: enquiryId },
    });

    res.status(200).json({
      success: true,
      message: "Enquiry deleted successfully",
    } as ApiResponse<null>);
  } catch (error) {
    console.error("Error deleting enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to delete enquiry",
    } as ApiResponse<null>);
  }
};

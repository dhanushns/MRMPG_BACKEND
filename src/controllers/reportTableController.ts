import { Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { AuthenticatedRequest } from "../middlewares/auth";
import { getFilteredPgIds } from "../utils/reportHelpers";
import {
  calculatePGPerformance,
  calculateRoomUtilization,
  calculatePaymentAnalytics,
  calculateFinancialSummary,
} from "../utils/pgReportCalculators";

// Get weekly PG performance table data
export const getWeeklyPGPerformance = async (
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

    const { startDate, endDate, page = "1", limit = "10" } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      } as ApiResponse<null>);
      return;
    }

    const weekStart = new Date(startDate as string);
    const weekEnd = new Date(endDate as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      undefined,
      undefined
    );

    // Calculate PG performance data
    const allPgData = await calculatePGPerformance(
      prisma,
      filteredPgIds,
      weekStart,
      weekEnd
    );

    // Apply pagination
    const totalRecords = allPgData.length;
    const paginatedData = allPgData.slice(offset, offset + limitNum);

    res.status(200).json({
      success: true,
      message: "Weekly PG performance data retrieved successfully",
      data: {
        tableData: paginatedData,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error getting weekly PG performance data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve weekly PG performance data",
    } as ApiResponse<null>);
  }
};

// Get weekly room utilization table data
export const getWeeklyRoomUtilization = async (
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

    const { startDate, endDate, page = "1", limit = "10" } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      } as ApiResponse<null>);
      return;
    }

    const weekStart = new Date(startDate as string);
    const weekEnd = new Date(endDate as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      undefined,
      undefined
    );

    // Calculate room utilization data
    const allRoomData = await calculateRoomUtilization(
      prisma,
      filteredPgIds,
      weekStart,
      weekEnd
    );

    // Apply pagination
    const totalRecords = allRoomData.length;
    const paginatedData = allRoomData.slice(offset, offset + limitNum);

    res.status(200).json({
      success: true,
      message: "Weekly room utilization data retrieved successfully",
      data: {
        tableData: paginatedData,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error getting weekly room utilization data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve weekly room utilization data",
    } as ApiResponse<null>);
  }
};

// Get weekly payment analytics table data
export const getWeeklyPaymentAnalytics = async (
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

    const { startDate, endDate, page = "1", limit = "10" } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      } as ApiResponse<null>);
      return;
    }

    const weekStart = new Date(startDate as string);
    const weekEnd = new Date(endDate as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      undefined,
      undefined
    );

    // Calculate payment analytics data
    const allPaymentData = await calculatePaymentAnalytics(
      prisma,
      filteredPgIds,
      weekStart,
      weekEnd
    );

    // Apply pagination
    const totalRecords = allPaymentData.length;
    const paginatedData = allPaymentData.slice(offset, offset + limitNum);

    res.status(200).json({
      success: true,
      message: "Weekly payment analytics data retrieved successfully",
      data: {
        tableData: paginatedData,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error getting weekly payment analytics data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve weekly payment analytics data",
    } as ApiResponse<null>);
  }
};

// Get weekly financial summary table data
export const getWeeklyFinancialSummary = async (
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

    const { startDate, endDate, page = "1", limit = "10" } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      } as ApiResponse<null>);
      return;
    }

    const weekStart = new Date(startDate as string);
    const weekEnd = new Date(endDate as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      undefined,
      undefined
    );

    // Calculate financial summary data
    const allFinancialData = await calculateFinancialSummary(
      prisma,
      filteredPgIds,
      weekStart,
      weekEnd
    );

    // Apply pagination
    const totalRecords = allFinancialData.length;
    const paginatedData = allFinancialData.slice(offset, offset + limitNum);

    res.status(200).json({
      success: true,
      message: "Weekly financial summary data retrieved successfully",
      data: {
        tableData: paginatedData,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error getting weekly financial summary data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve weekly financial summary data",
    } as ApiResponse<null>);
  }
};

// Get monthly PG performance table data
export const getMonthlyPGPerformance = async (
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

    const { month, year, page = "1", limit = "10" } = req.query;

    if (!month || !year) {
      res.status(400).json({
        success: false,
        message: "Month and year are required",
      } as ApiResponse<null>);
      return;
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const monthStart = new Date(yearNum, monthNum - 1, 1);
    const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      undefined,
      undefined
    );

    // Calculate PG performance data for the month
    const allPgData = await calculatePGPerformance(
      prisma,
      filteredPgIds,
      monthStart,
      monthEnd
    );

    // Apply pagination
    const totalRecords = allPgData.length;
    const paginatedData = allPgData.slice(offset, offset + limitNum);

    res.status(200).json({
      success: true,
      message: "Monthly PG performance data retrieved successfully",
      data: {
        tableData: paginatedData,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error getting monthly PG performance data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve monthly PG performance data",
    } as ApiResponse<null>);
  }
};

// Get monthly room utilization table data
export const getMonthlyRoomUtilization = async (
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

    const { month, year, page = "1", limit = "10" } = req.query;

    if (!month || !year) {
      res.status(400).json({
        success: false,
        message: "Month and year are required",
      } as ApiResponse<null>);
      return;
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const monthStart = new Date(yearNum, monthNum - 1, 1);
    const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      undefined,
      undefined
    );

    // Calculate room utilization data for the month
    const allRoomData = await calculateRoomUtilization(
      prisma,
      filteredPgIds,
      monthStart,
      monthEnd
    );

    // Apply pagination
    const totalRecords = allRoomData.length;
    const paginatedData = allRoomData.slice(offset, offset + limitNum);

    res.status(200).json({
      success: true,
      message: "Monthly room utilization data retrieved successfully",
      data: {
        tableData: paginatedData,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error getting monthly room utilization data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve monthly room utilization data",
    } as ApiResponse<null>);
  }
};

// Get monthly payment analytics table data
export const getMonthlyPaymentAnalytics = async (
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

    const { month, year, page = "1", limit = "10" } = req.query;

    if (!month || !year) {
      res.status(400).json({
        success: false,
        message: "Month and year are required",
      } as ApiResponse<null>);
      return;
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const monthStart = new Date(yearNum, monthNum - 1, 1);
    const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      undefined,
      undefined
    );

    // Calculate payment analytics data for the month
    const allPaymentData = await calculatePaymentAnalytics(
      prisma,
      filteredPgIds,
      monthStart,
      monthEnd
    );

    // Apply pagination
    const totalRecords = allPaymentData.length;
    const paginatedData = allPaymentData.slice(offset, offset + limitNum);

    res.status(200).json({
      success: true,
      message: "Monthly payment analytics data retrieved successfully",
      data: {
        tableData: paginatedData,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error getting monthly payment analytics data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve monthly payment analytics data",
    } as ApiResponse<null>);
  }
};

// Get monthly financial summary table data
export const getMonthlyFinancialSummary = async (
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

    const { month, year, page = "1", limit = "10" } = req.query;

    if (!month || !year) {
      res.status(400).json({
        success: false,
        message: "Month and year are required",
      } as ApiResponse<null>);
      return;
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const monthStart = new Date(yearNum, monthNum - 1, 1);
    const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);

    // Get filtered PG IDs
    const filteredPgIds = await getFilteredPgIds(
      prisma,
      admin.pgType,
      undefined,
      undefined
    );

    // Calculate financial summary data for the month
    const allFinancialData = await calculateFinancialSummary(
      prisma,
      filteredPgIds,
      monthStart,
      monthEnd
    );

    // Apply pagination
    const totalRecords = allFinancialData.length;
    const paginatedData = allFinancialData.slice(offset, offset + limitNum);

    res.status(200).json({
      success: true,
      message: "Monthly financial summary data retrieved successfully",
      data: {
        tableData: paginatedData,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error("Error getting monthly financial summary data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve monthly financial summary data",
    } as ApiResponse<null>);
  }
};

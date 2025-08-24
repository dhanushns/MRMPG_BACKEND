import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AdminLoginRequest, AssignStaffToPGRequest, CreateAdminRequest, CreateStaffRequest, UpdateAdminRequest, UpdateStaffRequest } from "../types/request";
import { ApiResponse, AdminResponse, AdminLoginResponse, PaginatedResponse, StaffWithPGResponse } from "../types/response";
import { hashPassword, comparePassword, generateAdminToken } from "../utils/auth";
import { AuthenticatedRequest } from "../middlewares/auth";
import { ENV } from "../config/env";

// Admin login
export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: AdminLoginRequest = req.body;

    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: "Invalid email or password",
      } as ApiResponse<null>);
      return;
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, admin.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: "Invalid email or password",
      } as ApiResponse<null>);
      return;
    }

    // Generate JWT token
    const token = generateAdminToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });

    // Remove password from response
    const { password: _, ...adminResponse } = admin;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        admin: adminResponse,
        token,
        expiresIn: ENV.JWT_EXPIRES_IN,
      },
    } as ApiResponse<AdminLoginResponse>);
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to login",
    } as ApiResponse<null>);
  }
};

// Create a new admin (TEMP ROUTE)
export const createAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password }: CreateAdminRequest = req.body;

    // Check if admin with email already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      res.status(409).json({
        success: false,
        message: "Admin with this email already exists",
      } as ApiResponse<null>);
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new admin
    const newAdmin = await prisma.admin.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Remove password from response
    const { password: _, ...adminResponse } = newAdmin;

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: adminResponse,
    } as ApiResponse<AdminResponse>);
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to create admin",
    } as ApiResponse<null>);
  }
};


// Get current admin profile
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      } as ApiResponse<null>);
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: admin,
    } as ApiResponse<AdminResponse>);
  } catch (error) {
    console.error("Error getting admin profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve profile",
    } as ApiResponse<null>);
  }
};

// Create a new staff member
export const createStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, pgId }: CreateStaffRequest  = req.body;

    // Check if PG exists
    const pgExists = await prisma.pG.findUnique({
      where: { id: pgId },
    });

    if (!pgExists) {
      res.status(404).json({
        success: false,
        message: "PG not found",
      } as ApiResponse<null>);
      return;
    }

    // Check if email already exists
    const existingStaff = await prisma.staff.findUnique({
      where: { email },
    });

    if (existingStaff) {
      res.status(409).json({
        success: false,
        message: "Staff with this email already exists",
      } as ApiResponse<null>);
      return;
    }

    // Create new staff member
    const hashedPassword = await hashPassword(password);
    const newStaff = await prisma.staff.create({
      data: {
        name,
        email,
        password: hashedPassword,
        pgId,
      },
      include: {
        pg: true,
      },
    });

    // Remove password from response
    const { password: _, ...staffResponse } = newStaff;

    res.status(201).json({
      success: true,
      message: "Staff created successfully",
      data: staffResponse,
    } as ApiResponse<StaffWithPGResponse>);
  } catch (error) {
    console.error("Error creating staff:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to create staff",
    } as ApiResponse<null>);
  }
};

// Get all staff with pagination
export const getAllStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await prisma.staff.count();

    // Get staff members
    const staff = await prisma.staff.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        pgId: true,
        createdAt: true,
        updatedAt: true,
        pg: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Staff retrieved successfully",
      data: staff,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    } as PaginatedResponse<StaffWithPGResponse>);
  } catch (error) {
    console.error("Error getting staff:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve staff",
    } as ApiResponse<null>);
  }
};

// Get staff by ID
export const getStaffById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        pgId: true,
        createdAt: true,
        updatedAt: true,
        pg: true,
      },
    });

    if (!staff) {
      res.status(404).json({
        success: false,
        message: "Staff not found",
      } as ApiResponse<null>);
      return;
    }

    res.status(200).json({
      success: true,
      message: "Staff retrieved successfully",
      data: staff,
    } as ApiResponse<StaffWithPGResponse>);
  } catch (error) {
    console.error("Error getting staff:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve staff",
    } as ApiResponse<null>);
  }
};

// Get all staff for a specific PG
export const getStaffByPG = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { pgId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Check if PG exists
    const pgExists = await prisma.pG.findUnique({
      where: { id: pgId },
    });

    if (!pgExists) {
      res.status(404).json({
        success: false,
        message: "PG not found",
      } as ApiResponse<null>);
      return;
    }

    // Get total count for pagination
    const total = await prisma.staff.count({
      where: { pgId },
    });

    // Get staff members for the PG
    const staff = await prisma.staff.findMany({
      where: { pgId },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        pgId: true,
        createdAt: true,
        updatedAt: true,
        pg: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Staff retrieved successfully",
      data: staff,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    } as PaginatedResponse<StaffWithPGResponse>);
  } catch (error) {
    console.error("Error getting staff by PG:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve staff",
    } as ApiResponse<null>);
  }
};

// Update staff
export const updateStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData: UpdateStaffRequest = req.body;

    // Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!existingStaff) {
      res.status(404).json({
        success: false,
        message: "Staff not found",
      } as ApiResponse<null>);
      return;
    }

    // Check if email already exists (if being updated)
    if (updateData.email && updateData.email !== existingStaff.email) {
      const emailExists = await prisma.staff.findUnique({
        where: { email: updateData.email },
      });

      if (emailExists) {
        res.status(409).json({
          success: false,
          message: "Email already in use",
        } as ApiResponse<null>);
        return;
      }
    }

    // Update staff
    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        pgId: true,
        createdAt: true,
        updatedAt: true,
        pg: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Staff updated successfully",
      data: updatedStaff,
    } as ApiResponse<StaffWithPGResponse>);
  } catch (error) {
    console.error("Error updating staff:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to update staff",
    } as ApiResponse<null>);
  }
};

// Delete staff
export const deleteStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!existingStaff) {
      res.status(404).json({
        success: false,
        message: "Staff not found",
      } as ApiResponse<null>);
      return;
    }

    // Delete staff
    await prisma.staff.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Staff deleted successfully",
    } as ApiResponse<null>);
  } catch (error) {
    console.error("Error deleting staff:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to delete staff",
    } as ApiResponse<null>);
  }
};

// Assign staff to a different PG
export const assignStaffToPG = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { pgId }: AssignStaffToPGRequest = req.body;

    // Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!existingStaff) {
      res.status(404).json({
        success: false,
        message: "Staff not found",
      } as ApiResponse<null>);
      return;
    }

    // Check if PG exists
    const pgExists = await prisma.pG.findUnique({
      where: { id: pgId },
    });

    if (!pgExists) {
      res.status(404).json({
        success: false,
        message: "PG not found",
      } as ApiResponse<null>);
      return;
    }

    // Check if staff is already assigned to this PG
    if (existingStaff.pgId === pgId) {
      res.status(409).json({
        success: false,
        message: "Staff is already assigned to this PG",
      } as ApiResponse<null>);
      return;
    }

    // Assign staff to new PG
    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: { pgId },
      select: {
        id: true,
        name: true,
        email: true,
        pgId: true,
        createdAt: true,
        updatedAt: true,
        pg: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Staff assigned to PG successfully",
      data: updatedStaff,
    } as ApiResponse<StaffWithPGResponse>);
  } catch (error) {
    console.error("Error assigning staff to PG:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to assign staff to PG",
    } as ApiResponse<null>);
  }
};
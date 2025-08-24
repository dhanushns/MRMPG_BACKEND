import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/response";
import {
  verifyToken,
  extractTokenFromHeader,
  JWTPayload,
  AdminJWTPayload,
  StaffJWTPayload,
} from "../utils/auth";
import prisma from "../config/prisma";

// Extended Request interface to include admin and staff data
export interface AuthenticatedRequest extends Request {
  admin?: AdminJWTPayload;
  staff?: StaffJWTPayload & { pgId: string };
}

// Authentication middleware with JWT
export const authenticateAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "Authorization token is required",
      } as ApiResponse<null>);
    }

    // Verify JWT token
    const payload = verifyToken(token) as AdminJWTPayload;

    // Verify it's an admin token (if role is present)
    if (payload.role && payload.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        error: "Admin authentication is required",
      } as ApiResponse<null>);
    }

    // Attach admin data to request
    req.admin = {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: "admin",
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: "Invalid or expired token",
    } as ApiResponse<null>);
  }
};

// Authorization middleware to ensure only admins can access staff operations
export const authorizeAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      error: "Admin authentication is required for this operation",
    } as ApiResponse<null>);
  }

  // Additional admin role checks can be added here
  next();
};

// Authentication middleware for staff with JWT
export const authenticateStaff = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "Authorization token is required",
      } as ApiResponse<null>);
    }

    // Verify JWT token
    const payload = verifyToken(token) as StaffJWTPayload;

    // Verify it's a staff token
    if (payload.role !== "staff") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        error: "Staff authentication is required",
      } as ApiResponse<null>);
    }

    // Verify staff exists in database and get PG info
    const staff = await prisma.staff.findUnique({
      where: { id: payload.id },
      include: { pg: true },
    });

    if (!staff || !staff.pgId) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: "Staff not found or not assigned to a PG",
      } as ApiResponse<null>);
    }

    // Attach staff data to request
    req.staff = {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      pgId: staff.pgId,
      role: "staff",
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: "Invalid or expired token",
    } as ApiResponse<null>);
  }
};

// Authorization middleware to ensure only staff can access staff-specific operations
export const authorizeStaff = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.staff) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      error: "Staff authentication is required for this operation",
    } as ApiResponse<null>);
  }

  next();
};

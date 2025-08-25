import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ENV } from "../config/env";
import { PgType } from "@prisma/client";

// JWT payload interface
export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  pgType: PgType;
  role: "admin";
  iat?: number;
  exp?: number;
}

// Generate JWT token for admin
export const generateAdminToken = (payload: Omit<JWTPayload, 'iat' | 'exp' | 'role'>): string => {
  return jwt.sign({ ...payload, role: 'admin' }, ENV.JWT_SECRET, {
    expiresIn: "24h",
  });
};

// Generate JWT token (backward compatibility)
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: "24h",
  });
};

// Verify JWT token
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, ENV.JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, ENV.BCRYPT_SALT_ROUNDS);
};

// Compare password
export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// Extract token from Authorization header
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7); // Remove "Bearer " prefix
};

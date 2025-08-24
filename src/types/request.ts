import { PgType, Gender, RentType } from "@prisma/client";

// Admin related types
export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface CreateAdminRequest {
  name: string;
  email: string;
  password: string;
}

export interface UpdateAdminRequest {
  name?: string;
  email?: string;
  password?: string;
}

// PG related types
export interface CreatePGRequest {
  name: string;
  type: PgType;
  location: string;
}

export interface UpdatePGRequest {
  name?: string;
  type?: PgType;
  location?: string;
}

// Staff related types
export interface StaffLoginRequest {
  email: string;
  password: string;
}

export interface CreateStaffRequest {
  name: string;
  email: string;
  password: string;
  pgId: string;
}

export interface UpdateStaffRequest {
  name?: string;
  email?: string;
  password?: string;
}

export interface AssignStaffToPGRequest {
  pgId: string;
}

// Room related types
export interface CreateRoomRequest {
  roomNo: string;
  rent: number;
  capacity: number;
  pgId: string;
}

export interface UpdateRoomRequest {
  roomNo?: string;
  rent?: number;
  capacity?: number;
}

// Member related types
export interface CreateMemberRequest {
  name: string;
  age: number;
  gender: Gender;
  location: string;
  pgLocation: string;
  email: string;
  phone: string;
  work: string;
  photoUrl?: string;
  aadharUrl?: string;
  rentType: RentType;
  pgType: PgType;
}

export interface PersonalDataValidation {
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  location: string;
}

export interface CreateRoomRequest {
  roomNo: string;
  rent: number;
  capacity: number;
}

export interface UpdateRoomRequest {
  roomNo?: string;
  rent?: number;
  capacity?: number;
}

// Member filter types
export interface GetMembersFilterRequest {
  page?: number;
  limit?: number;
  search?: string; // Search by name, email, phone, or memberId
  gender?: Gender;
  rentType?: RentType;
  roomNo?: string;
  ageMin?: number;
  ageMax?: number;
  advanceAmountMin?: number;
  advanceAmountMax?: number;
  dateJoinedFrom?: string; // ISO date string
  dateJoinedTo?: string; // ISO date string
}
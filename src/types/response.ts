import { PG, Staff, Room, Member, Admin } from "@prisma/client";

// Generic response types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Admin response types
export interface AdminResponse extends Omit<Admin, 'password'> {}

export interface AdminLoginResponse {
  admin: AdminResponse;
  token: string;
  expiresIn: string;
}

// PG response types
export interface PGResponse extends PG {
  _count?: {
    rooms: number;
    members: number;
    staff: number;
    payments: number;
  };
}

// Staff response types
export interface StaffResponse extends Omit<Staff, 'password'> {
  pg?: PG;
}

export interface StaffLoginResponse {
  staff: StaffWithPGResponse;
  token: string;
  expiresIn: string;
}

export interface StaffWithPGResponse extends Omit<Staff, 'password'> {
  pg: PG;
}

// Member response types
export interface MemberWithRoomResponse extends Member {
  room: Room | null;
}

export interface MembersPaginatedResponse extends PaginatedResponse<MemberWithRoomResponse> {
  filterSummary?: {
    totalMembers: number;
    filteredCount: number;
    pgName: string;
    appliedFilters: string[];
  };
}

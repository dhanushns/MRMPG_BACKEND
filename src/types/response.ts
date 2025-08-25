import { PG, Room, Member, Admin } from "@prisma/client";

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
    payments: number;
  };
}

// Member response types
export interface MemberPaymentStatus {
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  month: string;
  paymentDetails?: {
    id: string;
    amount: number;
    paidDate: Date;
  } | null;
}

export interface MemberInfo extends Member {
  room: Room | null;
  paymentStatus: MemberPaymentStatus | null;
}

export interface MembersPaginatedResponse extends PaginatedResponse<MemberInfo> {
  filterSummary?: {
    totalMembers: number;
    filteredCount: number;
    pgName: string;
    appliedFilters: string[];
  };
}

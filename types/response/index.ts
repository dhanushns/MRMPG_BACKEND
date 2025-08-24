import { PG, Staff, Room, Member } from "@prisma/client";

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

// PG response types
export interface PGResponse extends PG {
  _count?: {
    rooms: number;
    members: number;
    staff: number;
    payments: number;
  };
}

export interface PGWithDetailsResponse extends PG {
  rooms: Room[];
  members: Member[];
  staff: Staff[];
}

// Staff response types
export interface StaffResponse extends Omit<Staff, 'password'> {
  pg?: PG;
}

// Member response types
export interface MemberResponse extends Member {
  pg?: PG;
  room?: Room;
}

// Room response types
export interface RoomResponse extends Room {
  members: Member[];
  PG?: PG;
}

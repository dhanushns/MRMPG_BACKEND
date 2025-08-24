import { PgType, Gender, RentType } from "@prisma/client";

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

// Staff (Admin) related types
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
  email: string;
  phone: string;
  photoUrl?: string;
  aadharUrl?: string;
  rentType: RentType;
  advanceAmount: number;
  pgId: string;
  roomId?: string;
}

export interface UpdateMemberRequest {
  name?: string;
  age?: number;
  gender?: Gender;
  location?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  aadharUrl?: string;
  rentType?: RentType;
  advanceAmount?: number;
  roomId?: string;
}

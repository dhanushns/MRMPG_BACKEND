-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "public"."RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'APPROVED', 'REJECTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."RentType" AS ENUM ('LONG_TERM', 'SHORT_TERM');

-- CreateEnum
CREATE TYPE "public"."PgType" AS ENUM ('WOMENS', 'MENS');

-- CreateEnum
CREATE TYPE "public"."EnquiryStatus" AS ENUM ('NOT_RESOLVED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('ONLINE', 'CASH');

-- CreateEnum
CREATE TYPE "public"."LeavingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "pgType" "public"."PgType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Enquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "public"."EnquiryStatus" NOT NULL DEFAULT 'NOT_RESOLVED',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PG" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."PgType" NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PG_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Room" (
    "id" TEXT NOT NULL,
    "roomNo" TEXT NOT NULL,
    "rent" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER NOT NULL,
    "pGId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Member" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "location" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "photoUrl" TEXT,
    "documentUrl" TEXT,
    "rentType" "public"."RentType" NOT NULL,
    "advanceAmount" DOUBLE PRECISION NOT NULL,
    "pgId" TEXT NOT NULL,
    "roomId" TEXT,
    "dateOfJoining" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegisteredMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "location" TEXT NOT NULL,
    "pgLocation" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "photoUrl" TEXT,
    "aadharUrl" TEXT,
    "rentType" "public"."RentType" NOT NULL,
    "pgType" "public"."PgType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisteredMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeavingRequest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "roomId" TEXT,
    "requestedLeaveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "public"."LeavingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "pendingDues" DOUBLE PRECISION,
    "finalAmount" DOUBLE PRECISION,
    "settledDate" TIMESTAMP(3),
    "settlementProof" TEXT,
    "paymentMethod" "public"."PaymentMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ElectricityBill" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unitsUsed" DOUBLE PRECISION,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectricityBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "electricityBillId" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "overdueDate" TIMESTAMP(3) NOT NULL,
    "rentBillScreenshot" TEXT,
    "electricityBillScreenshot" TEXT,
    "paidDate" TIMESTAMP(3),
    "paymentMethod" "public"."PaymentMethod",
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "approvalStatus" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentStats" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "pgType" "public"."PgType" NOT NULL,
    "totalPendingPayments" INTEGER NOT NULL,
    "totalAmountPending" INTEGER NOT NULL,
    "totalOverduePayments" INTEGER NOT NULL,
    "thisMonthPendingPaymentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "public"."Admin"("email");

-- CreateIndex
CREATE INDEX "Enquiry_status_idx" ON "public"."Enquiry"("status");

-- CreateIndex
CREATE INDEX "Enquiry_createdAt_idx" ON "public"."Enquiry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomNo_pGId_key" ON "public"."Room"("roomNo", "pGId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberId_key" ON "public"."Member"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "public"."Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_phone_key" ON "public"."Member"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredMember_email_key" ON "public"."RegisteredMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredMember_phone_key" ON "public"."RegisteredMember"("phone");

-- CreateIndex
CREATE INDEX "LeavingRequest_memberId_idx" ON "public"."LeavingRequest"("memberId");

-- CreateIndex
CREATE INDEX "LeavingRequest_pgId_idx" ON "public"."LeavingRequest"("pgId");

-- CreateIndex
CREATE INDEX "LeavingRequest_status_idx" ON "public"."LeavingRequest"("status");

-- CreateIndex
CREATE INDEX "LeavingRequest_requestedLeaveDate_idx" ON "public"."LeavingRequest"("requestedLeaveDate");

-- CreateIndex
CREATE INDEX "ElectricityBill_roomId_month_year_idx" ON "public"."ElectricityBill"("roomId", "month", "year");

-- CreateIndex
CREATE INDEX "ElectricityBill_month_year_idx" ON "public"."ElectricityBill"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityBill_roomId_month_year_key" ON "public"."ElectricityBill"("roomId", "month", "year");

-- CreateIndex
CREATE INDEX "Payment_pgId_month_year_idx" ON "public"."Payment"("pgId", "month", "year");

-- CreateIndex
CREATE INDEX "Payment_memberId_month_year_idx" ON "public"."Payment"("memberId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_memberId_month_year_attemptNumber_key" ON "public"."Payment"("memberId", "month", "year", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentStats_pgType_month_year_key" ON "public"."PaymentStats"("pgType", "month", "year");

-- AddForeignKey
ALTER TABLE "public"."Enquiry" ADD CONSTRAINT "Enquiry_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_pGId_fkey" FOREIGN KEY ("pGId") REFERENCES "public"."PG"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeavingRequest" ADD CONSTRAINT "LeavingRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeavingRequest" ADD CONSTRAINT "LeavingRequest_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeavingRequest" ADD CONSTRAINT "LeavingRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ElectricityBill" ADD CONSTRAINT "ElectricityBill_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_electricityBillId_fkey" FOREIGN KEY ("electricityBillId") REFERENCES "public"."ElectricityBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

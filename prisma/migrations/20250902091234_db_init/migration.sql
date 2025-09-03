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
    "aadharUrl" TEXT,
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
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "overdueDate" TIMESTAMP(3) NOT NULL,
    "rentBillScreenshot" TEXT,
    "electricityBillScreenshot" TEXT,
    "paidDate" TIMESTAMP(3),
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "approvalStatus" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DashboardStats" (
    "id" TEXT NOT NULL,
    "pgType" "public"."PgType" NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalMembers" INTEGER NOT NULL,
    "rentCollection" DOUBLE PRECISION NOT NULL,
    "newMembers" INTEGER NOT NULL,
    "paymentApprovals" INTEGER NOT NULL,
    "registrationApprovals" INTEGER NOT NULL,
    "totalMemberTrend" INTEGER NOT NULL,
    "rentCollectionTrend" INTEGER NOT NULL,
    "newMemberTrend" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegistrationStats" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "pgType" "public"."PgType" NOT NULL,
    "totalPendingRequests" INTEGER NOT NULL,
    "longTermRequests" INTEGER NOT NULL,
    "shortTermRequests" INTEGER NOT NULL,
    "thisMonthRegistrations" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationStats_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Payment_pgId_month_year_idx" ON "public"."Payment"("pgId", "month", "year");

-- CreateIndex
CREATE INDEX "Payment_memberId_month_year_idx" ON "public"."Payment"("memberId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_memberId_month_year_attemptNumber_key" ON "public"."Payment"("memberId", "month", "year", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardStats_pgType_month_year_key" ON "public"."DashboardStats"("pgType", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationStats_pgType_month_year_key" ON "public"."RegistrationStats"("pgType", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentStats_pgType_month_year_key" ON "public"."PaymentStats"("pgType", "month", "year");

-- AddForeignKey
ALTER TABLE "public"."Enquiry" ADD CONSTRAINT "Enquiry_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_pGId_fkey" FOREIGN KEY ("pGId") REFERENCES "public"."PG"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

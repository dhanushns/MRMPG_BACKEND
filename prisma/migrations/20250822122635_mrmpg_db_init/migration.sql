-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "public"."RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."RentType" AS ENUM ('LONG_TERM', 'SHORT_TERM');

-- CreateEnum
CREATE TYPE "public"."PgType" AS ENUM ('WOMENS', 'MENS');

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
CREATE TABLE "public"."Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
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
    "rentBillScreenshot" TEXT NOT NULL,
    "electricityBillScreenshot" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DashboardStats" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalMembers" INTEGER NOT NULL,
    "rentCollection" DOUBLE PRECISION NOT NULL,
    "newMembers" INTEGER NOT NULL,
    "paymentApprovals" INTEGER NOT NULL,
    "registrationApprovals" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "public"."Staff"("email");

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

-- AddForeignKey
ALTER TABLE "public"."Staff" ADD CONSTRAINT "Staff_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

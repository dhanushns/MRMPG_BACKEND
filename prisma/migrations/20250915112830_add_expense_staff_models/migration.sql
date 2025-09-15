-- CreateEnum
CREATE TYPE "public"."EntryType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "entryType" "public"."EntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "partyName" TEXT NOT NULL,
    "paymentType" "public"."PaymentMethod" NOT NULL,
    "remarks" TEXT,
    "attachedBill1" TEXT,
    "attachedBill2" TEXT,
    "attachedBill3" TEXT,
    "createdBy" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNo" TEXT NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "salary" DOUBLE PRECISION NOT NULL,
    "pgId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StaffPayment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentType" "public"."PaymentMethod" NOT NULL,
    "remarks" TEXT,
    "paidBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_pgId_idx" ON "public"."Expense"("pgId");

-- CreateIndex
CREATE INDEX "Expense_createdBy_idx" ON "public"."Expense"("createdBy");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "public"."Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_entryType_idx" ON "public"."Expense"("entryType");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_phoneNo_key" ON "public"."Staff"("phoneNo");

-- CreateIndex
CREATE INDEX "Staff_pgId_idx" ON "public"."Staff"("pgId");

-- CreateIndex
CREATE INDEX "Staff_assignedBy_idx" ON "public"."Staff"("assignedBy");

-- CreateIndex
CREATE INDEX "Staff_isActive_idx" ON "public"."Staff"("isActive");

-- CreateIndex
CREATE INDEX "StaffPayment_staffId_idx" ON "public"."StaffPayment"("staffId");

-- CreateIndex
CREATE INDEX "StaffPayment_paidBy_idx" ON "public"."StaffPayment"("paidBy");

-- CreateIndex
CREATE INDEX "StaffPayment_month_year_idx" ON "public"."StaffPayment"("month", "year");

-- CreateIndex
CREATE INDEX "StaffPayment_paymentDate_idx" ON "public"."StaffPayment"("paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayment_staffId_month_year_key" ON "public"."StaffPayment"("staffId", "month", "year");

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Staff" ADD CONSTRAINT "Staff_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Staff" ADD CONSTRAINT "Staff_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StaffPayment" ADD CONSTRAINT "StaffPayment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StaffPayment" ADD CONSTRAINT "StaffPayment_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

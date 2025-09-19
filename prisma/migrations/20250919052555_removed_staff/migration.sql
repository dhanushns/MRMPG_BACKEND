/*
  Warnings:

  - You are about to drop the `Staff` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StaffPayment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Staff" DROP CONSTRAINT "Staff_assignedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."Staff" DROP CONSTRAINT "Staff_pgId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StaffPayment" DROP CONSTRAINT "StaffPayment_paidBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."StaffPayment" DROP CONSTRAINT "StaffPayment_staffId_fkey";

-- DropTable
DROP TABLE "public"."Staff";

-- DropTable
DROP TABLE "public"."StaffPayment";

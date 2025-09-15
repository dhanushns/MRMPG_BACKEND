/*
  Warnings:

  - You are about to drop the column `electricityBillId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the `ElectricityBill` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ElectricityBill" DROP CONSTRAINT "ElectricityBill_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_electricityBillId_fkey";

-- AlterTable
ALTER TABLE "public"."Payment" DROP COLUMN "electricityBillId";

-- DropTable
DROP TABLE "public"."ElectricityBill";

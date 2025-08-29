/*
  Warnings:

  - Added the required column `dueDate` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `overdueDate` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "overdueDate" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "rentBillScreenshot" DROP NOT NULL,
ALTER COLUMN "electricityBillScreenshot" DROP NOT NULL,
ALTER COLUMN "paidDate" DROP NOT NULL;

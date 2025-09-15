/*
  Warnings:

  - You are about to drop the column `cashInAmountChange` on the `ExpenseStats` table. All the data in the column will be lost.
  - You are about to drop the column `cashInCountChange` on the `ExpenseStats` table. All the data in the column will be lost.
  - You are about to drop the column `cashOutAmountChange` on the `ExpenseStats` table. All the data in the column will be lost.
  - You are about to drop the column `cashOutCountChange` on the `ExpenseStats` table. All the data in the column will be lost.
  - You are about to drop the column `growthRate` on the `ExpenseStats` table. All the data in the column will be lost.
  - You are about to drop the column `isGrowthMonth` on the `ExpenseStats` table. All the data in the column will be lost.
  - You are about to drop the column `netAmountChange` on the `ExpenseStats` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."ExpenseStats_isGrowthMonth_idx";

-- AlterTable
ALTER TABLE "public"."ExpenseStats" DROP COLUMN "cashInAmountChange",
DROP COLUMN "cashInCountChange",
DROP COLUMN "cashOutAmountChange",
DROP COLUMN "cashOutCountChange",
DROP COLUMN "growthRate",
DROP COLUMN "isGrowthMonth",
DROP COLUMN "netAmountChange";

/*
  Warnings:

  - You are about to drop the column `pgId` on the `ExpenseStats` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pgType,month,year]` on the table `ExpenseStats` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pgType` to the `ExpenseStats` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ExpenseStats" DROP CONSTRAINT "ExpenseStats_pgId_fkey";

-- DropIndex
DROP INDEX "public"."ExpenseStats_pgId_idx";

-- DropIndex
DROP INDEX "public"."ExpenseStats_pgId_month_year_key";

-- AlterTable
ALTER TABLE "public"."ExpenseStats" DROP COLUMN "pgId",
ADD COLUMN     "pgType" "public"."PgType" NOT NULL;

-- CreateIndex
CREATE INDEX "ExpenseStats_pgType_idx" ON "public"."ExpenseStats"("pgType");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseStats_pgType_month_year_key" ON "public"."ExpenseStats"("pgType", "month", "year");

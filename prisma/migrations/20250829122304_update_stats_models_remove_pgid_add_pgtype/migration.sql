/*
  Warnings:

  - You are about to drop the column `pgId` on the `PaymentStats` table. All the data in the column will be lost.
  - You are about to drop the column `pgId` on the `RegistrationStats` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pgType,month,year]` on the table `PaymentStats` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pgType,month,year]` on the table `RegistrationStats` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pgType` to the `PaymentStats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pgType` to the `RegistrationStats` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."PaymentStats_pgId_month_year_key";

-- DropIndex
DROP INDEX "public"."RegistrationStats_pgId_month_year_key";

-- AlterTable
ALTER TABLE "public"."PaymentStats" DROP COLUMN "pgId",
ADD COLUMN     "pgType" "public"."PgType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."RegistrationStats" DROP COLUMN "pgId",
ADD COLUMN     "pgType" "public"."PgType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentStats_pgType_month_year_key" ON "public"."PaymentStats"("pgType", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationStats_pgType_month_year_key" ON "public"."RegistrationStats"("pgType", "month", "year");

/*
  Warnings:

  - Added the required column `pgType` to the `Member` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Member" ADD COLUMN     "pgType" "public"."PgType" NOT NULL,
ADD COLUMN     "pricePerDay" DOUBLE PRECISION;

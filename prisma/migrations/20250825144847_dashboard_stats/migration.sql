/*
  Warnings:

  - Added the required column `newMemberTrend` to the `DashboardStats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rentCollectionTrend` to the `DashboardStats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalMemberTrend` to the `DashboardStats` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."DashboardStats" ADD COLUMN     "newMemberTrend" INTEGER NOT NULL,
ADD COLUMN     "rentCollectionTrend" INTEGER NOT NULL,
ADD COLUMN     "totalMemberTrend" INTEGER NOT NULL;

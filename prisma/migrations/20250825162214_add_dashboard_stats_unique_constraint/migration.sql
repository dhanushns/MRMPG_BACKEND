/*
  Warnings:

  - A unique constraint covering the columns `[pgId,month,year]` on the table `DashboardStats` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DashboardStats_pgId_month_year_key" ON "public"."DashboardStats"("pgId", "month", "year");

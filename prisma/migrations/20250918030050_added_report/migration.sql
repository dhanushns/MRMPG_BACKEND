-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "pgType" "public"."PgType" NOT NULL,
    "year" INTEGER NOT NULL,
    "reportType" "public"."ReportType" NOT NULL,
    "period" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "newMembers" INTEGER NOT NULL,
    "newMembersTrendPercent" DOUBLE PRECISION NOT NULL,
    "rentCollected" DOUBLE PRECISION NOT NULL,
    "rentCollectedTrendPercent" DOUBLE PRECISION NOT NULL,
    "memberDepartures" INTEGER NOT NULL,
    "memberDeparturesTrendPercent" DOUBLE PRECISION NOT NULL,
    "totalExpenses" DOUBLE PRECISION NOT NULL,
    "totalExpensesTrendPercent" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "netProfitTrendPercent" DOUBLE PRECISION NOT NULL,
    "pgPerformanceData" JSONB NOT NULL,
    "roomUtilizationData" JSONB NOT NULL,
    "paymentAnalyticsData" JSONB NOT NULL,
    "financialSummaryData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_reportType_year_period_idx" ON "public"."Report"("reportType", "year", "period");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "public"."Report"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_pgType_reportType_period_year_key" ON "public"."Report"("pgType", "reportType", "period", "year");

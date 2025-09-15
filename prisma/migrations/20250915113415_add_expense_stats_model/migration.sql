-- CreateTable
CREATE TABLE "public"."ExpenseStats" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "pgId" TEXT NOT NULL,
    "totalCashInAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCashInCount" INTEGER NOT NULL DEFAULT 0,
    "totalCashOutAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCashOutCount" INTEGER NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOutOnline" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOutCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashInOnline" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashInCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseStats_pgId_idx" ON "public"."ExpenseStats"("pgId");

-- CreateIndex
CREATE INDEX "ExpenseStats_month_year_idx" ON "public"."ExpenseStats"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseStats_pgId_month_year_key" ON "public"."ExpenseStats"("pgId", "month", "year");

-- AddForeignKey
ALTER TABLE "public"."ExpenseStats" ADD CONSTRAINT "ExpenseStats_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "public"."PG"("id") ON DELETE CASCADE ON UPDATE CASCADE;

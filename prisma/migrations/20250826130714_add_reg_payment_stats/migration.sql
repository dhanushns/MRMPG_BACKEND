-- CreateTable
CREATE TABLE "public"."RegistrationStats" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalPendingRequests" INTEGER NOT NULL,
    "longTermRequests" INTEGER NOT NULL,
    "shortTermRequests" INTEGER NOT NULL,
    "thisMonthRegistrations" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentStats" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalPendingPayments" INTEGER NOT NULL,
    "totalAmountPending" INTEGER NOT NULL,
    "totalOverduePayments" INTEGER NOT NULL,
    "thisMonthPendingPaymentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationStats_pgId_month_year_key" ON "public"."RegistrationStats"("pgId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentStats_pgId_month_year_key" ON "public"."PaymentStats"("pgId", "month", "year");

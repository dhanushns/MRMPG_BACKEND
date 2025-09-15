/*
  Warnings:

  - Made the column `memberId` on table `OTP` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."OTPType" AS ENUM ('LOGIN', 'PASSWORD_RESET', 'INITIAL_SETUP');

-- DropForeignKey
ALTER TABLE "public"."OTP" DROP CONSTRAINT "OTP_memberId_fkey";

-- AlterTable
ALTER TABLE "public"."Member" ADD COLUMN     "password" TEXT;

-- AlterTable
ALTER TABLE "public"."OTP" ADD COLUMN     "type" "public"."OTPType" NOT NULL DEFAULT 'LOGIN',
ADD COLUMN     "used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usedAt" TIMESTAMP(3),
ALTER COLUMN "memberId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "OTP_memberId_idx" ON "public"."OTP"("memberId");

-- CreateIndex
CREATE INDEX "OTP_used_idx" ON "public"."OTP"("used");

-- AddForeignKey
ALTER TABLE "public"."OTP" ADD CONSTRAINT "OTP_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

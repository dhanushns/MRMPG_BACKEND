/*
  Warnings:

  - You are about to drop the column `status` on the `Payment` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."Payment" DROP COLUMN "status",
ADD COLUMN     "approvalStatus" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING';

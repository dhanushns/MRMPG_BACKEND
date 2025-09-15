/*
  Warnings:

  - You are about to drop the column `endingDate` on the `RegisteredMember` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Member" ADD COLUMN     "digitalSignature" TEXT,
ADD COLUMN     "isFirstTimeLogin" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."RegisteredMember" DROP COLUMN "endingDate",
ADD COLUMN     "dateOfRelieving" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."OTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OTP_email_idx" ON "public"."OTP"("email");

-- CreateIndex
CREATE INDEX "OTP_expiresAt_idx" ON "public"."OTP"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."OTP" ADD CONSTRAINT "OTP_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

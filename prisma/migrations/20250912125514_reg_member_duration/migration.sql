/*
  Warnings:

  - You are about to drop the column `aadharUrl` on the `RegisteredMember` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."RegisteredMember" DROP COLUMN "aadharUrl",
ADD COLUMN     "documentUrl" TEXT,
ADD COLUMN     "endingDate" TIMESTAMP(3);

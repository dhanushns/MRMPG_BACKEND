/*
  Warnings:

  - Added the required column `work` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `work` to the `RegisteredMember` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Member" ADD COLUMN     "work" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."RegisteredMember" ADD COLUMN     "work" TEXT NOT NULL;

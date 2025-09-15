/*
  Warnings:

  - Made the column `electricityCharge` on table `Room` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Room" ALTER COLUMN "electricityCharge" SET NOT NULL;

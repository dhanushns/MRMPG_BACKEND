/*
  Warnings:

  - You are about to drop the column `endingDate` on the `Member` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Member" DROP COLUMN "endingDate",
ADD COLUMN     "dateOfRelieving" TIMESTAMP(3);

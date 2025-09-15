-- AlterTable
ALTER TABLE "public"."Member" ADD COLUMN     "endingDate" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

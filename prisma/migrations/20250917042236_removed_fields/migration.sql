/*
  Warnings:

  - The values [LOGIN] on the enum `OTPType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `age` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `rejectedReason` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `age` on the `RegisteredMember` table. All the data in the column will be lost.
  - Added the required column `dob` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dob` to the `RegisteredMember` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."OTPType_new" AS ENUM ('PASSWORD_RESET', 'INITIAL_SETUP');
ALTER TABLE "public"."OTP" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "public"."OTP" ALTER COLUMN "type" TYPE "public"."OTPType_new" USING ("type"::text::"public"."OTPType_new");
ALTER TYPE "public"."OTPType" RENAME TO "OTPType_old";
ALTER TYPE "public"."OTPType_new" RENAME TO "OTPType";
DROP TYPE "public"."OTPType_old";
ALTER TABLE "public"."OTP" ALTER COLUMN "type" SET DEFAULT 'PASSWORD_RESET';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Member" DROP COLUMN "age",
ADD COLUMN     "dob" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."OTP" ALTER COLUMN "type" SET DEFAULT 'PASSWORD_RESET';

-- AlterTable
ALTER TABLE "public"."Payment" DROP COLUMN "rejectedReason";

-- AlterTable
ALTER TABLE "public"."RegisteredMember" DROP COLUMN "age",
ADD COLUMN     "dob" TIMESTAMP(3) NOT NULL;

/*
  Warnings:

  - You are about to drop the column `parent_name` on the `students` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "students" DROP COLUMN "parent_name",
ADD COLUMN     "father_name" TEXT,
ADD COLUMN     "father_phone" TEXT,
ADD COLUMN     "metrika_number" TEXT,
ADD COLUMN     "mother_name" TEXT,
ADD COLUMN     "mother_phone" TEXT;

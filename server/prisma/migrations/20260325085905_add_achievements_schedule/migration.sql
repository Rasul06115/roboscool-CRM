-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('PROJECT_DONE', 'HOMEWORK_DONE', 'CONTEST_WIN', 'GOOD_BEHAVIOR', 'ATTENDANCE_STREAK', 'OTHER');

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "sms_sent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "end_time" TEXT,
ADD COLUMN     "start_time" TEXT,
ADD COLUMN     "time_slot" "TimeSlot" NOT NULL DEFAULT 'MORNING',
ADD COLUMN     "week_days" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "total_points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL DEFAULT 'PROJECT_DONE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "sms_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "achievements_student_id_idx" ON "achievements"("student_id");

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

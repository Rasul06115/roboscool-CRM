-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EvaluationRating" AS ENUM ('POOR', 'AVERAGE', 'GOOD', 'EXCELLENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "student_evaluations" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "teamwork" "EvaluationRating" NOT NULL DEFAULT 'AVERAGE',
    "thinking" "EvaluationRating" NOT NULL DEFAULT 'AVERAGE',
    "behavior" "EvaluationRating" NOT NULL DEFAULT 'GOOD',
    "mastery" "EvaluationRating" NOT NULL DEFAULT 'AVERAGE',
    "creativity" "EvaluationRating" NOT NULL DEFAULT 'AVERAGE',
    "decision_making" "EvaluationRating" NOT NULL DEFAULT 'AVERAGE',
    "independence" "EvaluationRating" NOT NULL DEFAULT 'AVERAGE',
    "note" TEXT,
    "sms_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_evaluations_student_id_idx" ON "student_evaluations"("student_id");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "student_evaluations_student_id_period_key" ON "student_evaluations"("student_id", "period");

-- AddForeignKey
ALTER TABLE "student_evaluations" ADD CONSTRAINT "student_evaluations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

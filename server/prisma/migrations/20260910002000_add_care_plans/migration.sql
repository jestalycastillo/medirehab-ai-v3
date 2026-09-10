ALTER TABLE "exercise_assignments"
ADD COLUMN "targetSessionsPerWeek" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "reviewDate" TIMESTAMP(3),
ADD COLUMN "doctorInstructions" TEXT;

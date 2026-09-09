ALTER TABLE "users"
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "lastSeenAt" TIMESTAMP(3);

ALTER TABLE "exercise_assignments"
ADD COLUMN "viewedAt" TIMESTAMP(3),
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "activeAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "exercise_assignments_patientProfileId_activeAt_idx"
ON "exercise_assignments"("patientProfileId", "activeAt");

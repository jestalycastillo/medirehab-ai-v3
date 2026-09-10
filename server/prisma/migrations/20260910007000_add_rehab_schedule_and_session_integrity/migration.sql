ALTER TABLE "exercise_assignments"
ADD COLUMN "scheduledDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "targetSets" INTEGER,
ADD COLUMN "targetRepsPerSet" INTEGER,
ADD COLUMN "targetDurationSeconds" INTEGER,
ADD COLUMN "minimumScore" DOUBLE PRECISION,
ADD COLUMN "minimumDurationSeconds" INTEGER;

ALTER TABLE "exercise_sessions"
ADD COLUMN "durationSeconds" INTEGER,
ADD COLUMN "adherenceQualified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "qualificationReason" TEXT,
ADD COLUMN "clientSessionId" TEXT;

CREATE UNIQUE INDEX "exercise_sessions_clientSessionId_key"
ON "exercise_sessions"("clientSessionId");

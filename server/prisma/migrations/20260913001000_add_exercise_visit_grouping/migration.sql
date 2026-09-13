ALTER TABLE "exercise_sessions"
ADD COLUMN "visitId" TEXT;

CREATE INDEX "exercise_sessions_visitId_idx"
ON "exercise_sessions"("visitId");

CREATE UNIQUE INDEX "exercise_sessions_visitId_selectedSide_key"
ON "exercise_sessions"("visitId", "selectedSide");

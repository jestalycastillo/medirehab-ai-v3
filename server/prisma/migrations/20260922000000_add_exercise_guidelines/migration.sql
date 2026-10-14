ALTER TABLE "exercises"
  ADD COLUMN "guidelineSlides" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "guidelineVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "exercise_guideline_acknowledgements" (
  "id" TEXT NOT NULL,
  "patientUserId" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "guidelineVersion" INTEGER NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercise_guideline_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exercise_guideline_acknowledgements_patientUserId_exerciseId_key"
  ON "exercise_guideline_acknowledgements"("patientUserId", "exerciseId");
CREATE INDEX "exercise_guideline_acknowledgements_exerciseId_idx"
  ON "exercise_guideline_acknowledgements"("exerciseId");

ALTER TABLE "exercise_guideline_acknowledgements"
  ADD CONSTRAINT "exercise_guideline_acknowledgements_patientUserId_fkey"
  FOREIGN KEY ("patientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_guideline_acknowledgements"
  ADD CONSTRAINT "exercise_guideline_acknowledgements_exerciseId_fkey"
  FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link exercise catalog entries to versioned AI analysis models without coupling
-- model selection to generated database identifiers.
ALTER TABLE "exercises" ADD COLUMN "analysisModelKey" TEXT;

CREATE UNIQUE INDEX "exercises_analysisModelKey_key"
ON "exercises"("analysisModelKey");

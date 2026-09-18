ALTER TYPE "NotificationType" ADD VALUE 'PATIENT_HELP';

CREATE TABLE "help_requests" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "doctorUserId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "help_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "help_requests_doctorUserId_resolvedAt_createdAt_idx" ON "help_requests"("doctorUserId", "resolvedAt", "createdAt");
CREATE INDEX "help_requests_patientUserId_createdAt_idx" ON "help_requests"("patientUserId", "createdAt");
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_doctorUserId_fkey" FOREIGN KEY ("doctorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "exercise_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

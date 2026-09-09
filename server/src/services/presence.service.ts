import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";

const findPatientAssignment = async (patientUserId: string, assignmentId: string) => {
    const assignment = await prisma.exerciseAssignment.findFirst({
        where: {
            id: assignmentId,
            archivedAt: null,
            patientProfile: { is: { userId: patientUserId } }
        },
        select: { id: true, startedAt: true }
    });

    if (!assignment) {
        throw new HttpError(404, "Exercise assignment not found.");
    }

    return assignment;
};

export const recordPatientHeartbeat = async (patientUserId: string): Promise<void> => {
    await prisma.user.update({
        where: { id: patientUserId },
        data: { lastSeenAt: new Date() }
    });
};

export const markExercisesViewed = async (patientUserId: string, assignmentIds: string[]): Promise<void> => {
    if (assignmentIds.length === 0) return;

    const patient = await prisma.patientProfile.findUnique({
        where: { userId: patientUserId },
        select: { id: true }
    });
    if (!patient) throw new HttpError(404, "Patient profile not found.");

    const total = await prisma.exerciseAssignment.count({
        where: { id: { in: assignmentIds }, patientProfileId: patient.id, archivedAt: null }
    });
    if (total !== new Set(assignmentIds).size) {
        throw new HttpError(404, "One or more exercise assignments were not found.");
    }

    await prisma.exerciseAssignment.updateMany({
        where: { id: { in: assignmentIds }, patientProfileId: patient.id, archivedAt: null, viewedAt: null },
        data: { viewedAt: new Date() }
    });
};

export const startExerciseActivity = async (patientUserId: string, assignmentId: string): Promise<void> => {
    const assignment = await findPatientAssignment(patientUserId, assignmentId);
    const now = new Date();
    await prisma.$transaction([
        prisma.user.update({ where: { id: patientUserId }, data: { lastSeenAt: now } }),
        prisma.exerciseAssignment.updateMany({
            where: { patientProfile: { is: { userId: patientUserId } }, activeAt: { not: null } },
            data: { activeAt: null }
        }),
        prisma.exerciseAssignment.update({
            where: { id: assignment.id },
            data: { startedAt: assignment.startedAt ?? now, activeAt: now }
        })
    ]);
};

export const stopExerciseActivity = async (patientUserId: string, assignmentId: string): Promise<void> => {
    await findPatientAssignment(patientUserId, assignmentId);
    await prisma.exerciseAssignment.update({ where: { id: assignmentId }, data: { activeAt: null } });
};

export const completeExerciseActivity = async (patientUserId: string, assignmentId: string): Promise<void> => {
    await findPatientAssignment(patientUserId, assignmentId);
    await prisma.exerciseAssignment.update({
        where: { id: assignmentId },
        data: { completedAt: new Date(), activeAt: null }
    });
};

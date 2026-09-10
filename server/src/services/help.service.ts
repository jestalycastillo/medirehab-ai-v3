import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";

const helpSelect = {
    id: true,
    patientUserId: true,
    doctorUserId: true,
    assignmentId: true,
    message: true,
    resolvedAt: true,
    createdAt: true,
    assignment: { select: { exercise: { select: { name: true } } } }
} as const;

export const createHelpRequest = async (patientUserId: string, message: string, assignmentId?: string) => {
    const patient = await prisma.patientProfile.findUnique({
        where: { userId: patientUserId },
        select: { firstName: true, lastName: true, assignedDoctor: { select: { userId: true } } }
    });
    if (!patient?.assignedDoctor) throw new HttpError(403, "A doctor must be assigned before requesting help.");

    if (assignmentId) {
        const assignment = await prisma.exerciseAssignment.findFirst({
            where: { id: assignmentId, archivedAt: null, patientProfile: { is: { userId: patientUserId } } },
            select: { id: true }
        });
        if (!assignment) throw new HttpError(404, "Exercise assignment not found.");
    }

    const request = await prisma.helpRequest.create({
        data: { patientUserId, doctorUserId: patient.assignedDoctor.userId, message, ...(assignmentId ? { assignmentId } : {}) },
        select: helpSelect
    });
    const name = [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "A patient";
    const recipient = await prisma.user.findUnique({ where: { id: patient.assignedDoctor.userId }, select: { careNotificationsEnabled: true } });
    if (recipient?.careNotificationsEnabled) await prisma.notification.create({
        data: {
            userId: patient.assignedDoctor.userId,
            type: "PATIENT_HELP",
            title: "Patient needs help",
            body: `${name}: ${message.slice(0, 160)}`,
            link: `/doctor/patients/${patientUserId}`,
            meta: { helpRequestId: request.id, patientUserId, assignmentId: assignmentId ?? null }
        }
    });
    return request;
};

const doctorProfileId = async (doctorUserId: string) => {
    const profile = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId }, select: { id: true } });
    if (!profile) throw new HttpError(403, "Only doctors can access help requests.");
    return profile.id;
};

export const listHelpRequestsForDoctor = async (doctorUserId: string, patientUserId: string) => {
    const profileId = await doctorProfileId(doctorUserId);
    const patient = await prisma.patientProfile.findFirst({ where: { userId: patientUserId, assignedDoctorId: profileId }, select: { userId: true } });
    if (!patient) throw new HttpError(404, "Patient not found.");
    return prisma.helpRequest.findMany({ where: { doctorUserId, patientUserId }, orderBy: { createdAt: "desc" }, select: helpSelect });
};

export const resolveHelpRequest = async (doctorUserId: string, requestId: string) => {
    await doctorProfileId(doctorUserId);
    const request = await prisma.helpRequest.findFirst({ where: { id: requestId, doctorUserId }, select: { id: true } });
    if (!request) throw new HttpError(404, "Help request not found.");
    return prisma.helpRequest.update({ where: { id: request.id }, data: { resolvedAt: new Date() }, select: helpSelect });
};

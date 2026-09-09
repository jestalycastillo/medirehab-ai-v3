import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import type { ValidatedChatMessageInput } from "../utils/careValidation";

type ChatContext = {
    patientUserId: string;
    doctorUserId: string;
};

const chatMessageSelect = {
    id: true,
    senderUserId: true,
    recipientUserId: true,
    body: true,
    readAt: true,
    createdAt: true,
    updatedAt: true,
    sender: {
        select: {
            id: true,
            email: true,
            role: true,
            doctorProfile: { select: { firstName: true, lastName: true } },
            patientProfile: { select: { firstName: true, lastName: true } }
        }
    }
} satisfies Prisma.ChatMessageSelect;

const displayName = (user: {
    email: string;
    doctorProfile?: { firstName: string | null; lastName: string | null } | null;
    patientProfile?: { firstName: string | null; lastName: string | null } | null;
}): string => {
    const profile = user.doctorProfile ?? user.patientProfile;
    return [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || user.email;
};

const mapMessage = (message: any) => ({
    ...message,
    sender: {
        id: message.sender.id,
        email: message.sender.email,
        role: message.sender.role,
        displayName: displayName(message.sender)
    }
});

const getChatContext = async (
    userId: string,
    role: string,
    patientUserId?: string
): Promise<ChatContext> => {
    if (role === Role.PATIENT) {
        const patient = await prisma.patientProfile.findUnique({
            where: { userId },
            select: { assignedDoctor: { select: { userId: true } } }
        });

        if (!patient?.assignedDoctor) {
            throw new HttpError(403, "A doctor must be assigned before messaging is available.");
        }

        return { patientUserId: userId, doctorUserId: patient.assignedDoctor.userId };
    }

    if (role !== Role.DOCTOR || !patientUserId) {
        throw new HttpError(403, "Only assigned doctors and patients can access messages.");
    }

    const doctor = await prisma.doctorProfile.findUnique({
        where: { userId },
        select: { id: true }
    });

    if (!doctor) {
        throw new HttpError(403, "Only doctors with a profile can access messages.");
    }

    const patient = await prisma.patientProfile.findFirst({
        where: { userId: patientUserId, assignedDoctorId: doctor.id },
        select: { userId: true }
    });

    if (!patient) {
        throw new HttpError(404, "Patient not found.");
    }

    return { patientUserId: patient.userId, doctorUserId: userId };
};

export const listChatMessages = async (
    userId: string,
    role: string,
    patientUserId?: string
) => {
    const context = await getChatContext(userId, role, patientUserId);
    const messages = await prisma.chatMessage.findMany({
        where: {
            OR: [
                { senderUserId: context.patientUserId, recipientUserId: context.doctorUserId },
                { senderUserId: context.doctorUserId, recipientUserId: context.patientUserId }
            ]
        },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: chatMessageSelect
    });

    return { messages: messages.map(mapMessage), context };
};

export const sendChatMessage = async (
    userId: string,
    role: string,
    input: ValidatedChatMessageInput,
    patientUserId?: string
) => {
    const context = await getChatContext(userId, role, patientUserId);
    const recipientUserId = role === Role.PATIENT
        ? context.doctorUserId
        : context.patientUserId;

    const message = await prisma.chatMessage.create({
        data: { senderUserId: userId, recipientUserId, body: input.body },
        select: chatMessageSelect
    });

    await prisma.notification.create({
        data: {
            userId: recipientUserId,
            type: "CHAT_MESSAGE",
            title: "New message",
            body: `${displayName(message.sender)}: ${input.body.slice(0, 140)}`,
            link: role === Role.PATIENT
                ? `/doctor/patients/${context.patientUserId}`
                : "/patient/exercises",
            meta: { patientUserId: context.patientUserId, messageId: message.id }
        }
    });

    return mapMessage(message);
};

export const markChatMessagesRead = async (
    userId: string,
    role: string,
    patientUserId?: string
): Promise<void> => {
    const context = await getChatContext(userId, role, patientUserId);
    const senderUserId = role === Role.PATIENT
        ? context.doctorUserId
        : context.patientUserId;

    await prisma.chatMessage.updateMany({
        where: { senderUserId, recipientUserId: userId, readAt: null },
        data: { readAt: new Date() }
    });
};

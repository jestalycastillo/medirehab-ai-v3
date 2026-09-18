import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import {
    ValidatedCheckInInput,
    ValidatedCommentInput,
    ValidatedSessionUpdateInput
} from "../utils/careValidation";
import { roundScore } from "../utils/score";

const exerciseSelect = {
    id: true,
    name: true,
    description: true,
    analysisModelKey: true,
    isActive: true,
    archivedAt: true,
    images: {
        select: {
            id: true,
            imageName: true,
            filepath: true
        }
    },
    createdAt: true,
    updatedAt: true
} satisfies Prisma.ExerciseSelect;

const notificationSelect = {
    id: true,
    type: true,
    title: true,
    body: true,
    link: true,
    isRead: true,
    readAt: true,
    createdAt: true,
    updatedAt: true
} satisfies Prisma.NotificationSelect;

const sessionCommentSelect = {
    id: true,
    body: true,
    isVisibleToPatient: true,
    createdAt: true,
    updatedAt: true,
    author: {
        select: {
            id: true,
            email: true,
            role: true,
            doctorProfile: {
                select: {
                    firstName: true,
                    lastName: true
                }
            },
            patientProfile: {
                select: {
                    firstName: true,
                    lastName: true
                }
            }
        }
    }
} satisfies Prisma.ExerciseSessionCommentSelect;

const sessionSelect = {
    id: true,
    score: true,
    evaluatedModelKey: true,
    selectedSide: true,
    visitId: true,
    videoUrl: true,
    aiFeedback: true,
    painLevel: true,
    difficultyLevel: true,
    confidenceLevel: true,
    patientNote: true,
    performedAt: true,
    durationSeconds: true,
    adherenceQualified: true,
    qualificationReason: true,
    clientSessionId: true,
    createdAt: true,
    updatedAt: true,
    assignment: {
        select: {
            id: true,
            assignedAt: true,
            archivedAt: true,
            exercise: {
                select: exerciseSelect
            },
            result: {
                select: {
                    id: true,
                    score: true
                }
            },
            minimumScore: true,
            minimumDurationSeconds: true,
            assignedByDoctor: {
                select: {
                    id: true,
                    userId: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            doctorProfile: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    patient: {
        select: {
            id: true,
            email: true,
            role: true,
            patientProfile: {
                select: {
                    firstName: true,
                    lastName: true
                }
            }
        }
    },
    comments: {
        select: sessionCommentSelect,
        orderBy: {
            createdAt: "asc"
        }
    }
} satisfies Prisma.ExerciseSessionSelect;

const userNotificationSelect = {
    ...notificationSelect
} satisfies Prisma.NotificationSelect;

const getDoctorProfileIdForUser = async (doctorUserId: string): Promise<string> => {
    const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: doctorUserId },
        select: { id: true }
    });

    if (!doctorProfile) {
        throw new HttpError(403, "Only doctors with a profile can access this resource.");
    }

    return doctorProfile.id;
};

const getPatientProfileForUser = async (patientUserId: string) => {
    const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: patientUserId },
        select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            assignedDoctorId: true,
            user: {
                select: {
                    id: true,
                    email: true
                }
            }
        }
    });

    if (!patientProfile) {
        throw new HttpError(404, "Patient profile not found.");
    }

    return patientProfile;
};

const ensureDoctorOwnsPatient = async (
    patientUserId: string,
    doctorUserId: string
) => {
    const doctorProfileId = await getDoctorProfileIdForUser(doctorUserId);
    const patientProfile = await prisma.patientProfile.findFirst({
        where: {
            userId: patientUserId,
            assignedDoctorId: doctorProfileId
        },
        select: {
            id: true,
            userId: true,
            assignedDoctorId: true,
            user: {
                select: {
                    id: true,
                    email: true
                }
            }
        }
    });

    if (!patientProfile) {
        throw new HttpError(404, "Patient not found.");
    }

    return { doctorProfileId, patientProfile };
};

const ensureAssignmentForPatient = async (
    patientUserId: string,
    assignmentId: string
) => {
    const patientProfile = await getPatientProfileForUser(patientUserId);

    const assignment = await prisma.exerciseAssignment.findFirst({
        where: {
            id: assignmentId,
            patientProfileId: patientProfile.id,
            archivedAt: null
        },
        select: {
            id: true,
            patientProfileId: true,
            assignedByDoctorId: true,
            minimumScore: true,
            minimumDurationSeconds: true,
            exercise: {
                select: exerciseSelect
            },
            assignedByDoctor: {
                select: {
                    id: true,
                    userId: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            doctorProfile: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    }
                }
            },
            result: {
                select: {
                    id: true,
                    score: true
                }
            }
        }
    });

    if (!assignment) {
        throw new HttpError(404, "Exercise assignment not found.");
    }

    return { patientProfile, assignment };
};

const buildUserDisplayName = (user: {
    email: string;
    doctorProfile?: { firstName?: string | null; lastName?: string | null } | null;
    patientProfile?: { firstName?: string | null; lastName?: string | null } | null;
}) => {
    const profile = user.doctorProfile ?? user.patientProfile;
    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

    return name || user.email;
};

const parseAiFeedback = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
};

const mapComment = (comment: any) => ({
    ...comment,
    author: {
        id: comment.author.id,
        email: comment.author.email,
        role: comment.author.role,
        displayName: buildUserDisplayName(comment.author)
    }
});

const mapSession = (session: any) => ({
    ...session,
    aiFeedback: parseAiFeedback(session.aiFeedback),
    comments: Array.isArray(session.comments)
        ? session.comments.map(mapComment)
        : []
});

const createNotification = async (input: {
    userId: string;
    type: Prisma.NotificationCreateInput["type"];
    title: string;
    body: string;
    link?: string | null;
    meta?: Prisma.InputJsonValue;
}) => {
    const recipient = await prisma.user.findUnique({ where: { id: input.userId }, select: { careNotificationsEnabled: true } });
    if (!recipient?.careNotificationsEnabled) return;
    await prisma.notification.create({
        data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            body: input.body,
            link: input.link ?? null,
            ...(input.meta !== undefined ? { meta: input.meta } : {})
        }
    });
};

export const recordExerciseSession = async (
    patientUserId: string,
    assignmentId: string,
    exerciseId: string,
    score: number,
    aiFeedback: string[] = [],
    options: {
        durationSeconds?: number;
        clientSessionId?: string;
        evaluatedModelKey?: string;
        selectedSide?: "left" | "right";
        visitId?: string;
        videoUrl?: string;
    } = {}
) => {
    const roundedScore = roundScore(score);
    if (options.clientSessionId) {
        const existing = await prisma.exerciseSession.findUnique({ where: { clientSessionId: options.clientSessionId }, select: sessionSelect });
        if (existing) {
            if (existing.patient.id !== patientUserId || existing.assignment.id !== assignmentId || existing.assignment.exercise.id !== exerciseId || (existing.visitId ?? null) !== (options.visitId ?? null) || (existing.selectedSide ?? null) !== (options.selectedSide ?? null)) {
                throw new HttpError(409, "Session identifier is already in use.");
            }
            return { ...mapSession(existing), duplicate: true };
        }
    }
    const { patientProfile, assignment } = await ensureAssignmentForPatient(
        patientUserId,
        assignmentId
    );

    if (assignment.exercise.id !== exerciseId) {
        throw new HttpError(404, "Exercise assignment not found.");
    }

    if (options.visitId) {
        if (!options.selectedSide || !["shoulder_flexion", "shoulder_abduction"].includes(assignment.exercise.analysisModelKey ?? "")) {
            throw new HttpError(400, "A shared visit is only available for side-selectable shoulder exercises.");
        }
        const siblings = await prisma.exerciseSession.findMany({
            where: { visitId: options.visitId },
            select: { assignmentId: true, patientUserId: true, selectedSide: true, performedAt: true }
        });
        if (siblings.some((sibling) => sibling.assignmentId !== assignmentId || sibling.patientUserId !== patientUserId)) {
            throw new HttpError(409, "This visit belongs to another exercise assignment.");
        }
        if (siblings.some((sibling) => sibling.selectedSide === options.selectedSide)) {
            throw new HttpError(409, "This arm has already been recorded for this visit.");
        }
        if (siblings.some((sibling) => Date.now() - sibling.performedAt.getTime() > 2 * 60 * 60 * 1000)) {
            throw new HttpError(409, "This visit has expired. Start a new exercise visit.");
        }
    }

    const qualificationReasons = [
        assignment.minimumScore !== null && roundedScore < assignment.minimumScore ? `Score is below the ${assignment.minimumScore.toFixed(2)} minimum.` : null,
        assignment.minimumDurationSeconds !== null && (options.durationSeconds ?? 0) < assignment.minimumDurationSeconds ? `Recording is shorter than the ${assignment.minimumDurationSeconds}-second minimum.` : null
    ].filter((reason): reason is string => reason !== null);
    const adherenceQualified = qualificationReasons.length === 0;

    let session;
    try {
        session = await prisma.exerciseSession.create({
            data: {
                assignmentId: assignment.id,
                patientUserId,
                score: roundedScore,
                evaluatedModelKey: options.evaluatedModelKey ?? null,
                selectedSide: options.selectedSide ?? null,
                visitId: options.visitId ?? null,
                videoUrl: options.videoUrl ?? null,
                aiFeedback,
                ...(options.durationSeconds !== undefined ? { durationSeconds: options.durationSeconds } : {}),
                ...(options.clientSessionId !== undefined ? { clientSessionId: options.clientSessionId } : {}),
                adherenceQualified,
                qualificationReason: qualificationReasons.join(" ") || null
            },
            select: sessionSelect
        });
    } catch (error) {
        if (options.clientSessionId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const existing = await findRecordedExerciseSession(
                patientUserId,
                assignmentId,
                exerciseId,
                options.clientSessionId,
                options.selectedSide,
                options.visitId
            );
            if (existing) return { ...existing, duplicate: true };
            if (options.visitId) throw new HttpError(409, "This arm has already been recorded for this visit.");
        }
        throw error;
    }

    await prisma.exerciseResult.upsert({
        where: { assignmentId: assignment.id },
        create: {
            assignmentId: assignment.id,
            score: roundedScore
        },
        update: {
            score: roundedScore
        }
    });

    await createNotification({
        userId: assignment.assignedByDoctor.userId,
        type: "SESSION_RESULT",
        title: "New exercise result",
        body: `${buildUserDisplayName({
            email: patientProfile.user.email,
            patientProfile: {
                firstName: patientProfile.firstName,
                lastName: patientProfile.lastName
            }
        })} completed ${assignment.exercise.name}${options.selectedSide ? ` (${options.selectedSide} arm)` : ""} with a score of ${roundedScore.toFixed(2)}.${adherenceQualified ? options.visitId ? " This arm qualifies; the visit counts once toward adherence." : " The session counted toward adherence." : ` This arm did not qualify: ${qualificationReasons.join(" ")}`}`,
        link: `/doctor/patients/${patientUserId}`,
        meta: {
            assignmentId: assignment.id,
            sessionId: session.id,
            score: roundedScore,
            ...(session.videoUrl ? { videoUrl: session.videoUrl } : {})
        }
    });

    return { ...mapSession(session), duplicate: false };
};

export const findRecordedExerciseSession = async (
    patientUserId: string,
    assignmentId: string,
    exerciseId: string,
    clientSessionId: string,
    selectedSide?: "left" | "right",
    visitId?: string
) => {
    const existing = await prisma.exerciseSession.findUnique({ where: { clientSessionId }, select: sessionSelect });
    if (!existing) return null;
    if (existing.patient.id !== patientUserId || existing.assignment.id !== assignmentId || existing.assignment.exercise.id !== exerciseId) {
        throw new HttpError(409, "Session identifier is already in use.");
    }
    if ((existing.selectedSide ?? null) !== (selectedSide ?? null)) {
        throw new HttpError(409, "This session was recorded for a different arm.");
    }
    if ((existing.visitId ?? null) !== (visitId ?? null)) {
        throw new HttpError(409, "This session belongs to a different visit.");
    }
    return mapSession(existing);
};

export const updateSessionAiFeedback = async (
    patientUserId: string,
    sessionId: string,
    input: ValidatedSessionUpdateInput
) => {
    const existingSession = await prisma.exerciseSession.findFirst({
        where: { id: sessionId, patientUserId },
        select: { id: true }
    });

    if (!existingSession) {
        throw new HttpError(404, "Session not found.");
    }

    const session = await prisma.exerciseSession.update({
        where: { id: existingSession.id },
        data: input.aiFeedback !== undefined ? { aiFeedback: input.aiFeedback } : {},
        select: sessionSelect
    });

    return mapSession(session);
};



export const submitCheckInForSession = async (
    patientUserId: string,
    sessionId: string,
    input: ValidatedCheckInInput
) => {
    const session = await prisma.exerciseSession.findFirst({
        where: {
            id: sessionId,
            patientUserId
        },
        select: {
            id: true,
            assignment: {
                select: {
                    id: true,
                    assignedByDoctor: {
                        select: {
                            userId: true
                        }
                    }
                }
            }
        }
    });

    if (!session) {
        throw new HttpError(404, "Session not found.");
    }

    const patientProfile = await getPatientProfileForUser(patientUserId);

    const updatedSession = await prisma.exerciseSession.update({
        where: { id: sessionId },
        data: {
            painLevel: input.painLevel,
            difficultyLevel: input.difficultyLevel,
            confidenceLevel: input.confidenceLevel,
            ...(input.note !== undefined ? { patientNote: input.note } : {})
        },
        select: sessionSelect
    });

    await createNotification({
        userId: session.assignment.assignedByDoctor.userId,
        type: "SESSION_CHECKIN",
        title: "Patient check-in submitted",
        body: `${buildUserDisplayName({
            email: patientProfile.user.email,
            patientProfile: {
                firstName: patientProfile.firstName,
                lastName: patientProfile.lastName
            }
        })} reported pain ${input.painLevel}/10, difficulty ${input.difficultyLevel}/10, and confidence ${input.confidenceLevel}/10.`,
        link: `/doctor/patients/${patientUserId}`,
        meta: {
            sessionId: updatedSession.id,
            assignmentId: session.assignment.id,
            painLevel: input.painLevel,
            difficultyLevel: input.difficultyLevel,
            confidenceLevel: input.confidenceLevel
        }
    });

    return mapSession(updatedSession);
};

export const addDoctorCommentToSession = async (
    doctorUserId: string,
    sessionId: string,
    input: ValidatedCommentInput
) => {
    const doctorProfileId = await getDoctorProfileIdForUser(doctorUserId);

    const session = await prisma.exerciseSession.findFirst({
        where: {
            id: sessionId,
            assignment: {
                patientProfile: {
                    assignedDoctorId: doctorProfileId
                }
            }
        },
        select: {
            id: true,
            patientUserId: true,
            assignment: {
                select: {
                    id: true,
                    exercise: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    patientProfile: {
                        select: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    patientProfile: {
                                        select: {
                                            firstName: true,
                                            lastName: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    assignedByDoctor: {
                        select: {
                            userId: true
                        }
                    }
                }
            }
        }
    });

    if (!session) {
        throw new HttpError(404, "Session not found.");
    }

    const comment = await prisma.exerciseSessionComment.create({
        data: {
            sessionId: session.id,
            authorUserId: doctorUserId,
            body: input.body,
            isVisibleToPatient: true
        },
        select: sessionCommentSelect
    });

    const doctorName = await prisma.user.findUnique({
        where: { id: doctorUserId },
        select: {
            email: true,
            doctorProfile: {
                select: {
                    firstName: true,
                    lastName: true
                }
            }
        }
    });

    if (!doctorName) {
        throw new HttpError(404, "Doctor not found.");
    }

    const authorDisplayName = buildUserDisplayName(doctorName);
    const patientDisplayName = buildUserDisplayName(
        {
            email: session.assignment.patientProfile.user.email,
            patientProfile: session.assignment.patientProfile.user.patientProfile
        }
    );

    await createNotification({
        userId: session.patientUserId,
        type: "DOCTOR_COMMENT",
        title: `New note from ${authorDisplayName}`,
        body: input.body,
        link: `/patient/exercises`,
        meta: {
            sessionId: session.id,
            commentId: comment.id
        }
    });

    await createNotification({
        userId: session.patientUserId,
        type: "REMINDER",
        title: "Review your doctor feedback",
        body: `Open your care timeline to review the latest guidance from ${authorDisplayName} for ${session.assignment.exercise.name}.`,
        link: `/patient/exercises`,
        meta: {
            sessionId: session.id,
            commentId: comment.id,
            patientName: patientDisplayName
        }
    });

    return mapComment(comment);
};

export const listSessionsForPatient = async (patientUserId: string) => {
    const patientProfile = await getPatientProfileForUser(patientUserId);

    const sessions = await prisma.exerciseSession.findMany({
        where: {
            patientUserId,
            assignment: {
                patientProfileId: patientProfile.id,
                archivedAt: null
            }
        },
        orderBy: {
            performedAt: "desc"
        },
        select: sessionSelect
    });

    return sessions.map(mapSession);
};

export const listSessionsForDoctorPatient = async (
    patientUserId: string,
    doctorUserId: string
) => {
    const { patientProfile } = await ensureDoctorOwnsPatient(
        patientUserId,
        doctorUserId
    );

    const sessions = await prisma.exerciseSession.findMany({
        where: {
            patientUserId,
            assignment: {
                patientProfileId: patientProfile.id,
                archivedAt: null
            }
        },
        orderBy: {
            performedAt: "desc"
        },
        select: sessionSelect
    });

    return sessions.map(mapSession);
};

export const listSessionsForAdmin = async () => {
    const sessions = await prisma.exerciseSession.findMany({
        orderBy: {
            performedAt: "desc"
        },
        select: sessionSelect
    });

    return sessions.map(mapSession);
};

export const listNotificationsForUser = async (userId: string) => {
    return prisma.notification.findMany({
        where: { userId },
        orderBy: {
            createdAt: "desc"
        },
        select: userNotificationSelect
    });
};

export const markNotificationRead = async (
    userId: string,
    notificationId: string
) => {
    const notification = await prisma.notification.findFirst({
        where: {
            id: notificationId,
            userId
        },
        select: {
            id: true
        }
    });

    if (!notification) {
        throw new HttpError(404, "Notification not found.");
    }

    return prisma.notification.update({
        where: { id: notification.id },
        data: {
            isRead: true,
            readAt: new Date()
        },
        select: userNotificationSelect
    });
};

export const markAllNotificationsRead = async (userId: string) => {
    await prisma.notification.updateMany({
        where: {
            userId,
            isRead: false
        },
        data: {
            isRead: true,
            readAt: new Date()
        }
    });

    return listNotificationsForUser(userId);
};

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import {
    ValidatedAssignExerciseInput,
    ValidatedCreateExerciseInput,
    ValidatedUpdateExerciseInput
} from "../utils/exerciseValidation";

const exerciseSelect = {
    id: true,
    name: true,
    description: true,
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

const assignmentSelect = {
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
    }
} satisfies Prisma.ExerciseAssignmentSelect;

const getDoctorProfileIdForUser = async (doctorUserId: string): Promise<string> => {
    const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: doctorUserId },
        select: { id: true }
    });

    if (!doctorProfile) {
        throw new HttpError(403, "Only doctors with a profile can manage exercises.");
    }

    return doctorProfile.id;
};

const getAssignedPatientProfileId = async (
    patientUserId: string,
    doctorUserId: string
): Promise<string> => {
    const doctorProfileId = await getDoctorProfileIdForUser(doctorUserId);

    const patientProfile = await prisma.patientProfile.findFirst({
        where: {
            userId: patientUserId,
            assignedDoctorId: doctorProfileId
        },
        select: { id: true }
    });

    if (!patientProfile) {
        throw new HttpError(404, "Patient not found.");
    }

    return patientProfile.id;
};

const getPatientProfileIdForUser = async (patientUserId: string): Promise<string> => {
    const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: patientUserId },
        select: { id: true }
    });

    if (!patientProfile) {
        throw new HttpError(404, "Patient profile not found.");
    }

    return patientProfile.id;
};

const ensureActiveExercise = async (exerciseId: string): Promise<void> => {
    const exercise = await prisma.exercise.findFirst({
        where: {
            id: exerciseId,
            isActive: true,
            archivedAt: null
        },
        select: { id: true }
    });

    if (!exercise) {
        throw new HttpError(404, "Exercise not found.");
    }
};

const ensureExerciseExists = async (exerciseId: string): Promise<void> => {
    const exercise = await prisma.exercise.findFirst({
        where: { id: exerciseId },
        select: { id: true }
    });

    if (!exercise) {
        throw new HttpError(404, "Exercise not found.");
    }
};

const ensureArchivedExerciseExists = async (exerciseId: string): Promise<void> => {
    const exercise = await prisma.exercise.findFirst({
        where: { id: exerciseId, archivedAt: { not: null } },
        select: { id: true }
    });

    if (!exercise) {
        throw new HttpError(409, "Exercise must be archived before it can be deleted permanently.");
    }
};

const toImageCreateMany = (input: ValidatedCreateExerciseInput | ValidatedUpdateExerciseInput) => {
    return input.images?.map((image) => ({
        imageName: image.imageName,
        filepath: image.filepath
    })) ?? [];
};

export const createExercise = async (input: ValidatedCreateExerciseInput) => {
    return prisma.exercise.create({
        data: {
            name: input.name,
            description: input.description,
            images: {
                create: toImageCreateMany(input)
            }
        },
        select: exerciseSelect
    });
};

export const listExercises = async (includeArchived = false) => {
    return prisma.exercise.findMany({
        ...(includeArchived
            ? {}
            : {
                where: {
                    isActive: true,
                    archivedAt: null
                }
            }),
        select: exerciseSelect,
        orderBy: { name: "asc" }
    });
};

export const updateExercise = async (
    exerciseId: string,
    input: ValidatedUpdateExerciseInput
) => {
    await ensureExerciseExists(exerciseId);

    return prisma.$transaction(async (tx) => {
        if (input.images !== undefined) {
            await tx.exerciseImage.deleteMany({
                where: { exerciseId }
            });
        }

        return tx.exercise.update({
            where: { id: exerciseId },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                ...(input.images !== undefined
                    ? { images: { create: toImageCreateMany(input) } }
                    : {})
            },
            select: exerciseSelect
        });
    });
};

export const archiveExercise = async (exerciseId: string) => {
    await ensureActiveExercise(exerciseId);

    return prisma.exercise.update({
        where: { id: exerciseId },
        data: {
            isActive: false,
            archivedAt: new Date()
        },
        select: exerciseSelect
    });
};

export const restoreExercise = async (exerciseId: string) => {
    await ensureArchivedExerciseExists(exerciseId);

    return prisma.exercise.update({
        where: { id: exerciseId },
        data: {
            isActive: true,
            archivedAt: null
        },
        select: exerciseSelect
    });
};

export const deleteExercisePermanently = async (exerciseId: string) => {
    await ensureArchivedExerciseExists(exerciseId);

    return prisma.exercise.delete({
        where: { id: exerciseId }
    });
};

export const listAvailableExercisesForPatient = async (
    patientUserId: string,
    doctorUserId: string
) => {
    const patientProfileId = await getAssignedPatientProfileId(
        patientUserId,
        doctorUserId
    );

    const activeAssignments = await prisma.exerciseAssignment.findMany({
        where: {
            patientProfileId,
            archivedAt: null
        },
        select: { exerciseId: true }
    });

    return prisma.exercise.findMany({
        where: {
            isActive: true,
            archivedAt: null,
            id: {
                notIn: activeAssignments.map((assignment) => assignment.exerciseId)
            }
        },
        select: exerciseSelect,
        orderBy: { name: "asc" }
    });
};

export const listAssignedExercisesForDoctorPatient = async (
    patientUserId: string,
    doctorUserId: string
) => {
    const patientProfileId = await getAssignedPatientProfileId(
        patientUserId,
        doctorUserId
    );

    return prisma.exerciseAssignment.findMany({
        where: {
            patientProfileId,
            archivedAt: null
        },
        select: assignmentSelect,
        orderBy: { assignedAt: "desc" }
    });
};

export const listAssignedExercisesForPatient = async (patientUserId: string) => {
    const patientProfileId = await getPatientProfileIdForUser(patientUserId);

    return prisma.exerciseAssignment.findMany({
        where: {
            patientProfileId,
            archivedAt: null
        },
        select: assignmentSelect,
        orderBy: { assignedAt: "desc" }
    });
};

export const assignExerciseToPatient = async (
    patientUserId: string,
    doctorUserId: string,
    input: ValidatedAssignExerciseInput
) => {
    await ensureActiveExercise(input.exerciseId);
    const patientProfileId = await getAssignedPatientProfileId(
        patientUserId,
        doctorUserId
    );
    const doctorProfileId = await getDoctorProfileIdForUser(doctorUserId);

    const existingAssignment = await prisma.exerciseAssignment.findUnique({
        where: {
            exerciseId_patientProfileId: {
                exerciseId: input.exerciseId,
                patientProfileId
            }
        },
        select: {
            id: true,
            archivedAt: true
        }
    });

    if (existingAssignment?.archivedAt === null) {
        throw new HttpError(409, "Exercise is already assigned to this patient.");
    }

    if (existingAssignment) {
        return prisma.exerciseAssignment.update({
            where: { id: existingAssignment.id },
            data: {
                archivedAt: null,
                assignedAt: new Date(),
                assignedByDoctorId: doctorProfileId,
                result: {
                    upsert: {
                        create: { score: 0 },
                        update: { score: 0 }
                    }
                }
            },
            select: assignmentSelect
        });
    }

    return prisma.exerciseAssignment.create({
        data: {
            exerciseId: input.exerciseId,
            patientProfileId,
            assignedByDoctorId: doctorProfileId,
            result: {
                create: { score: 0 }
            }
        },
        select: assignmentSelect
    });
};

export const archivePatientExerciseAssignment = async (
    patientUserId: string,
    doctorUserId: string,
    assignmentId: string
) => {
    const patientProfileId = await getAssignedPatientProfileId(
        patientUserId,
        doctorUserId
    );

    const assignment = await prisma.exerciseAssignment.findFirst({
        where: {
            id: assignmentId,
            patientProfileId,
            archivedAt: null
        },
        select: { id: true }
    });

    if (!assignment) {
        throw new HttpError(404, "Assigned exercise not found.");
    }

    return prisma.exerciseAssignment.update({
        where: { id: assignment.id },
        data: { archivedAt: new Date() },
        select: assignmentSelect
    });
};

type AiServiceResponse = {
    success?: boolean;
    message?: string;
    detail?: string;
    evaluationId?: string;
    score?: unknown;
    feedback?: unknown;
};

const DEFAULT_AI_SERVICE_TIMEOUT_MS = 120_000;

const getAiServiceBaseUrl = (): string => {
    const configuredUrl = process.env.AI_SERVICE_URL?.trim();

    if (!configuredUrl) {
        throw new HttpError(503, "Exercise evaluation service is not configured.");
    }

    try {
        return new URL(configuredUrl).toString().replace(/\/$/, "");
    } catch {
        throw new HttpError(503, "Exercise evaluation service is not configured.");
    }
};

const getAiServiceTimeoutMs = (): number => {
    const configuredTimeout = process.env.AI_SERVICE_TIMEOUT_MS?.trim();

    if (!configuredTimeout) {
        return DEFAULT_AI_SERVICE_TIMEOUT_MS;
    }

    const timeoutMs = Number(configuredTimeout);

    if (
        !Number.isInteger(timeoutMs)
        || timeoutMs < 1_000
        || timeoutMs > 600_000
    ) {
        throw new HttpError(503, "Exercise evaluation timeout is not configured correctly.");
    }

    return timeoutMs;
};

const fetchAiService = async (
    url: string,
    requestInit: RequestInit
): Promise<Response> => {
    const abortController = new AbortController();
    const timeout = setTimeout(
        () => abortController.abort(),
        getAiServiceTimeoutMs()
    );

    try {
        return await fetch(url, {
            ...requestInit,
            signal: abortController.signal
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new HttpError(504, "Exercise evaluation timed out. Please try again.");
        }

        throw new HttpError(502, "Exercise evaluation service is unavailable.");
    } finally {
        clearTimeout(timeout);
    }
};

const readAiServiceResponse = async (
    response: Response
): Promise<AiServiceResponse> => {
    try {
        return await response.json() as AiServiceResponse;
    } catch {
        throw new HttpError(502, "Exercise evaluation service returned an invalid response.");
    }
};

const getAiServiceErrorMessage = (
    response: AiServiceResponse,
    fallback: string
): string => response.message ?? response.detail ?? fallback;

export const evaluateExercise = async (
    patientUserId: string,
    exerciseId: string,
    assignmentId: string,
    videoBuffer: Buffer,
    videoContentType: string
) => {
    const assignment = await prisma.exerciseAssignment.findFirst({
        where: {
            id: assignmentId,
            exerciseId,
            archivedAt: null,
            patientProfile: {
                is: { userId: patientUserId }
            },
            exercise: {
                is: {
                    isActive: true,
                    archivedAt: null
                }
            }
        },
        select: {
            id: true,
            exercise: {
                select: { analysisModelKey: true }
            }
        }
    });

    if (!assignment) {
        throw new HttpError(404, "Assigned exercise not found.");
    }

    const modelKey = assignment.exercise.analysisModelKey;

    if (!modelKey) {
        throw new HttpError(409, "Exercise evaluation is not available for this exercise.");
    }

    if (videoBuffer.length === 0) {
        throw new HttpError(400, "Exercise recording is empty.");
    }

    const uint8Array = new Uint8Array(videoBuffer);
    const formData = new FormData();
    formData.append(
        "video",
        new Blob([uint8Array], { type: videoContentType }),
        "exercise.webm"
    );

    const aiServiceBaseUrl = getAiServiceBaseUrl();
    const encodedModelKey = encodeURIComponent(modelKey);
    const evaluationResponse = await fetchAiService(
        `${aiServiceBaseUrl}/evaluate/${encodedModelKey}`,
        {
            method: "POST",
            body: formData
        }
    );
    const evaluationResult = await readAiServiceResponse(evaluationResponse);

    if (!evaluationResponse.ok || evaluationResult.success !== true) {
        throw new HttpError(
            evaluationResponse.status >= 400 && evaluationResponse.status < 500
                ? evaluationResponse.status
                : 502,
            getAiServiceErrorMessage(evaluationResult, "Failed to evaluate exercise.")
        );
    }

    if (
        typeof evaluationResult.score !== "number"
        || !Number.isFinite(evaluationResult.score)
        || evaluationResult.score < 0
        || evaluationResult.score > 100
    ) {
        throw new HttpError(502, "Exercise evaluation service returned an invalid score.");
    }

    const result = await prisma.exerciseResult.upsert({
        where: { assignmentId: assignment.id },
        create: {
            assignmentId: assignment.id,
            score: evaluationResult.score
        },
        update: {
            score: evaluationResult.score
        },
        select: { score: true }
    });

    const feedback = Array.isArray(evaluationResult.feedback)
        ? evaluationResult.feedback.filter((item): item is string => typeof item === "string")
        : [];

    return { score: result.score, feedback };
};

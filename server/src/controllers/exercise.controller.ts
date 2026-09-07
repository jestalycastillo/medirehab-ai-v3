import { Role } from "@prisma/client";
import { Request, Response } from "express";
import {
    archiveExercise,
    archivePatientExerciseAssignment,
    assignExerciseToPatient,
    deleteExercisePermanently,
    createExercise,
    listAssignedExercisesForDoctorPatient,
    listAssignedExercisesForPatient,
    listAvailableExercisesForPatient,
    listExercises,
    restoreExercise,
    updateExercise,
    evaluateExercise
} from "../services/exercise.service";
import { recordExerciseSession } from "../services/care.service";
import { createLiveCoachingMessage } from "../services/live-coaching.service";
import { HttpError } from "../utils/httpError";
import {
    validateAssignExerciseInput,
    validateAssignmentIdParam,
    validateCreateExerciseInput,
    validateExerciseIdParam,
    validateUpdateExerciseInput
} from "../utils/exerciseValidation";
import { validateLiveCoachingInput } from "../utils/liveCoachingValidation";
import { validateUserIdParam } from "../utils/userValidation";

const MAX_EXERCISE_RECORDING_BYTES = 50 * 1024 * 1024;
const SUPPORTED_EXERCISE_RECORDING_TYPES = new Set([
    "application/octet-stream",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo"
]);

const getAuthenticatedUserId = (req: Request): string => {
    if (!req.user?.userId) {
        throw new HttpError(401, "Unauthorized.");
    }

    return req.user.userId;
};

const handleExerciseError = (
    error: unknown,
    res: Response,
    fallbackMessage: string
): void => {
    if (error instanceof HttpError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
        return;
    }

    res.status(500).json({
        success: false,
        message: fallbackMessage
    });
};

export const getExercises = async (req: Request, res: Response): Promise<void> => {
    try {
        const includeArchived = req.user?.role === Role.ADMIN;
        const exercises = await listExercises(includeArchived);

        res.status(200).json({
            success: true,
            exercises
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to load exercises.");
    }
};

export const createLiveCoaching = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const patientUserId = getAuthenticatedUserId(req);
        const exerciseId = validateExerciseIdParam(req.params.exerciseId);
        const assignmentId = validateAssignmentIdParam(req.params.assignmentId);
        const input = validateLiveCoachingInput(req.body);
        const coaching = await createLiveCoachingMessage(
            patientUserId,
            exerciseId,
            assignmentId,
            input.event
        );

        res.status(200).json({ success: true, ...coaching });
    } catch (error) {
        handleExerciseError(error, res, "Unable to create live coaching.");
    }
};

export const createExerciseCatalogItem = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const input = validateCreateExerciseInput(req.body);
        const exercise = await createExercise(input);

        res.status(201).json({
            success: true,
            message: "Exercise created successfully.",
            exercise
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to create exercise.");
    }
};

export const updateExerciseCatalogItem = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const exerciseId = validateExerciseIdParam(req.params.exerciseId);
        const input = validateUpdateExerciseInput(req.body);
        const exercise = await updateExercise(exerciseId, input);

        res.status(200).json({
            success: true,
            message: "Exercise updated successfully.",
            exercise
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to update exercise.");
    }
};

export const archiveExerciseCatalogItem = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const exerciseId = validateExerciseIdParam(req.params.exerciseId);
        const exercise = await archiveExercise(exerciseId);

        res.status(200).json({
            success: true,
            message: "Exercise archived successfully.",
            exercise
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to archive exercise.");
    }
};

export const restoreExerciseCatalogItem = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const exerciseId = validateExerciseIdParam(req.params.exerciseId);
        const exercise = await restoreExercise(exerciseId);

        res.status(200).json({
            success: true,
            message: "Exercise restored successfully.",
            exercise
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to restore exercise.");
    }
};

export const deleteExerciseCatalogItemPermanently = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const exerciseId = validateExerciseIdParam(req.params.exerciseId);
        await deleteExercisePermanently(exerciseId);

        res.status(200).json({
            success: true,
            message: "Exercise permanently deleted successfully."
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to permanently delete exercise.");
    }
};

export const getAvailableExercisesForPatient = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const doctorUserId = getAuthenticatedUserId(req);
        const patientUserId = validateUserIdParam(req.params.patientUserId);
        const exercises = await listAvailableExercisesForPatient(
            patientUserId,
            doctorUserId
        );

        res.status(200).json({
            success: true,
            exercises
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to load available exercises.");
    }
};

export const getAssignedExercisesForPatient = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const doctorUserId = getAuthenticatedUserId(req);
        const patientUserId = validateUserIdParam(req.params.patientUserId);
        const assignments = await listAssignedExercisesForDoctorPatient(
            patientUserId,
            doctorUserId
        );

        res.status(200).json({
            success: true,
            assignments
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to load assigned exercises.");
    }
};

export const getMyAssignedExercises = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const patientUserId = getAuthenticatedUserId(req);
        const assignments = await listAssignedExercisesForPatient(patientUserId);

        res.status(200).json({
            success: true,
            assignments,
            patientUserId
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to load assigned exercises.");
    }
};

export const assignExercise = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const doctorUserId = getAuthenticatedUserId(req);
        const patientUserId = validateUserIdParam(req.params.patientUserId);
        const input = validateAssignExerciseInput(req.body);
        const assignment = await assignExerciseToPatient(
            patientUserId,
            doctorUserId,
            input
        );

        res.status(201).json({
            success: true,
            message: "Exercise assigned successfully.",
            assignment
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to assign exercise.");
    }
};

export const removeAssignedExercise = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const doctorUserId = getAuthenticatedUserId(req);
        const patientUserId = validateUserIdParam(req.params.patientUserId);
        const assignmentId = validateAssignmentIdParam(req.params.assignmentId);
        const assignment = await archivePatientExerciseAssignment(
            patientUserId,
            doctorUserId,
            assignmentId
        );

        res.status(200).json({
            success: true,
            message: "Assigned exercise removed successfully.",
            assignment
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to remove assigned exercise.");
    }
};

export const evaluateExerciseAssignment = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const authenticatedUserId = getAuthenticatedUserId(req);
        const exerciseId = validateExerciseIdParam(req.params.exerciseId);
        const assignmentId = validateAssignmentIdParam(req.params.assignmentId);
        const contentType = (req.headers["content-type"] ?? "")
            .split(";", 1)[0]
            ?.trim()
            .toLowerCase() ?? "";

        if (!SUPPORTED_EXERCISE_RECORDING_TYPES.has(contentType)) {
            throw new HttpError(415, "Unsupported exercise recording format.");
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        for await (const chunk of req) {
            const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += bufferChunk.length;

            if (totalBytes > MAX_EXERCISE_RECORDING_BYTES) {
                throw new HttpError(413, "Exercise recording exceeds the 50 MB limit.");
            }

            chunks.push(bufferChunk);
        }

        const videoBuffer = Buffer.concat(chunks);
        const result = await evaluateExercise(
            authenticatedUserId,
            exerciseId,
            assignmentId,
            videoBuffer,
            contentType
        );
        const session = await recordExerciseSession(
            authenticatedUserId,
            assignmentId,
            exerciseId,
            result.score,
            result.feedback
        );

        res.status(200).json({
            success: true,
            message: "Exercise evaluated successfully.",
            ...result,
            sessionId: session.id
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to process exercise evaluation.");
    }
};

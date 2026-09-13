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
    updatePatientExercisePlan,
    evaluateExercise
} from "../services/exercise.service";
import { findRecordedExerciseSession, recordExerciseSession } from "../services/care.service";
import { completeExerciseActivity } from "../services/presence.service";
import { createLiveCoachingMessage } from "../services/live-coaching.service";
import { HttpError } from "../utils/httpError";
import {
    validateAssignExerciseInput,
    validateAssignmentIdParam,
    validateAssignmentPlanInput,
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
            input.event,
            input.side
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
        throw new HttpError(403, "Exercises and AI analysis models are built-in and cannot be manually created.");
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

export const updateAssignedExercisePlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const doctorUserId = getAuthenticatedUserId(req);
        const patientUserId = validateUserIdParam(req.params.patientUserId);
        const assignmentId = validateAssignmentIdParam(req.params.assignmentId);
        const assignment = await updatePatientExercisePlan(
            patientUserId,
            doctorUserId,
            assignmentId,
            validateAssignmentPlanInput(req.body)
        );
        res.status(200).json({ success: true, message: "Care plan updated successfully.", assignment });
    } catch (error) {
        handleExerciseError(error, res, "Unable to update care plan.");
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
        const durationSeconds = Number(req.headers["x-recording-duration-seconds"]);
        const clientSessionId = String(req.headers["x-client-session-id"] ?? "").trim();
        if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 3_600) {
            throw new HttpError(400, "Recording duration must be between 1 and 3600 seconds.");
        }
        if (!/^[A-Za-z0-9-]{8,100}$/.test(clientSessionId)) {
            throw new HttpError(400, "A valid client session identifier is required.");
        }
        const selectedSideHeader = req.headers["x-selected-side"];
        if (
            selectedSideHeader !== undefined
            && (typeof selectedSideHeader !== "string" || !["left", "right"].includes(selectedSideHeader.toLowerCase()))
        ) {
            throw new HttpError(400, "Selected arm must be left or right.");
        }
        const selectedSide = typeof selectedSideHeader === "string"
            ? selectedSideHeader.toLowerCase() as "left" | "right"
            : undefined;
        const visitHeader = req.headers["x-exercise-visit-id"];
        if (visitHeader !== undefined && (typeof visitHeader !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(visitHeader))) {
            throw new HttpError(400, "A valid exercise visit identifier is required.");
        }
        const visitId = typeof visitHeader === "string" ? visitHeader.toLowerCase() : undefined;
        const existingSession = await findRecordedExerciseSession(authenticatedUserId, assignmentId, exerciseId, clientSessionId, selectedSide, visitId);
        if (existingSession) {
            res.status(200).json({
                success: true,
                message: "Exercise session was already recorded.",
                score: existingSession.score,
                feedback: existingSession.aiFeedback,
                evaluatedModelKey: existingSession.evaluatedModelKey,
                selectedSide: existingSession.selectedSide,
                visitId: existingSession.visitId,
                sessionId: existingSession.id,
                adherenceQualified: existingSession.adherenceQualified,
                qualificationReason: existingSession.qualificationReason,
                duplicate: true
            });
            return;
        }
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
            contentType,
            selectedSide
        );
        const session = await recordExerciseSession(
            authenticatedUserId,
            assignmentId,
            exerciseId,
            result.score,
            result.feedback,
            {
                durationSeconds,
                clientSessionId,
                evaluatedModelKey: result.evaluatedModelKey,
                ...(visitId ? { visitId } : {}),
                ...(result.selectedSide ? { selectedSide: result.selectedSide } : {})
            }
        );
        await completeExerciseActivity(authenticatedUserId, assignmentId);

        res.status(200).json({
            success: true,
            message: "Exercise evaluated successfully.",
            ...result,
            sessionId: session.id,
            visitId: session.visitId,
            adherenceQualified: session.adherenceQualified,
            qualificationReason: session.qualificationReason,
            duplicate: session.duplicate
        });
    } catch (error) {
        handleExerciseError(error, res, "Unable to process exercise evaluation.");
    }
};

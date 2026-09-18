import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "../utils/httpError";
import { completeExerciseActivity, markExercisesViewed, recordPatientHeartbeat, startExerciseActivity, stopExerciseActivity } from "../services/presence.service";
import { requireString } from "../utils/validation";

const getPatientUserId = (req: Request): string => {
    if (!req.user) throw new HttpError(401, "Unauthorized.");
    if (req.user.role !== Role.PATIENT) throw new HttpError(403, "Only patients can update exercise activity.");
    return req.user.userId;
};

const getAuthenticatedUserId = (req: Request): string => {
    if (!req.user) throw new HttpError(401, "Unauthorized.");
    if (req.user.role !== Role.PATIENT && req.user.role !== Role.DOCTOR) throw new HttpError(403, "Presence is unavailable for this account.");
    return req.user.userId;
};

const assignmentId = (req: Request): string => requireString(req.params.assignmentId, "Assignment id");

const handleError = (error: unknown, res: Response, fallback: string) => {
    if (error instanceof HttpError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
    }
    res.status(500).json({ success: false, message: fallback });
};

export const heartbeat = async (req: Request, res: Response): Promise<void> => {
    try {
        await recordPatientHeartbeat(getAuthenticatedUserId(req));
        res.status(200).json({ success: true });
    } catch (error) { handleError(error, res, "Unable to update presence."); }
};

export const viewed = async (req: Request, res: Response): Promise<void> => {
    try {
        const ids = req.body?.assignmentIds;
        if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== "string" || !id.trim())) {
            throw new HttpError(400, "Assignment ids are invalid.");
        }
        await markExercisesViewed(getPatientUserId(req), ids.map((id) => id.trim()));
        res.status(200).json({ success: true });
    } catch (error) { handleError(error, res, "Unable to record exercise view."); }
};

export const start = async (req: Request, res: Response): Promise<void> => {
    try { await startExerciseActivity(getPatientUserId(req), assignmentId(req)); res.status(200).json({ success: true }); }
    catch (error) { handleError(error, res, "Unable to start exercise activity."); }
};

export const stop = async (req: Request, res: Response): Promise<void> => {
    try { await stopExerciseActivity(getPatientUserId(req), assignmentId(req)); res.status(200).json({ success: true }); }
    catch (error) { handleError(error, res, "Unable to stop exercise activity."); }
};

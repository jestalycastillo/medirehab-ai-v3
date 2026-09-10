import type { Request, Response } from "express";
import { HttpError } from "../utils/httpError";
import { requireString } from "../utils/validation";
import { createHelpRequest, listHelpRequestsForDoctor, resolveHelpRequest } from "../services/help.service";

const userId = (req: Request) => {
    if (!req.user) throw new HttpError(401, "Unauthorized.");
    return req.user.userId;
};
const fail = (error: unknown, res: Response) => error instanceof HttpError
    ? res.status(error.statusCode).json({ success: false, message: error.message })
    : res.status(500).json({ success: false, message: "Unable to process help request." });

export const requestHelp = async (req: Request, res: Response): Promise<void> => {
    try {
        const message = requireString(req.body?.message, "Message");
        if (message.length > 1_000) throw new HttpError(400, "Message must be 1,000 characters or fewer.");
        const assignmentId = typeof req.body?.assignmentId === "string" && req.body.assignmentId.trim() ? req.body.assignmentId.trim() : undefined;
        const request = await createHelpRequest(userId(req), message, assignmentId);
        res.status(201).json({ success: true, request });
    } catch (error) { fail(error, res); }
};

export const getPatientHelpRequests = async (req: Request, res: Response): Promise<void> => {
    try {
        const patientUserId = requireString(req.params.patientUserId, "Patient user id");
        const requests = await listHelpRequestsForDoctor(userId(req), patientUserId);
        res.status(200).json({ success: true, requests });
    } catch (error) { fail(error, res); }
};

export const resolvePatientHelpRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        const requestId = requireString(req.params.requestId, "Help request id");
        const request = await resolveHelpRequest(userId(req), requestId);
        res.status(200).json({ success: true, request });
    } catch (error) { fail(error, res); }
};

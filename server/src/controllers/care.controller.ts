import { Request, Response } from "express";
import {
    addDoctorCommentToSession,
    listNotificationsForUser,
    listSessionsForAdmin,
    listSessionsForDoctorPatient,
    listSessionsForPatient,
    markNotificationRead,
    submitCheckInForSession,
    updateSessionAiFeedback
} from "../services/care.service";
import { HttpError } from "../utils/httpError";
import {
    validateCheckInInput,
    validateCommentInput,
    validateNotificationIdParam,
    validateSessionIdParam,
    validateSessionUpdateInput
} from "../utils/careValidation";
import { validateUserIdParam } from "../utils/userValidation";

const getAuthenticatedUser = (req: Request): { userId: string; role: string } => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
    }

    return req.user;
};

const handleCareError = (
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

export const getMySessions = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = getAuthenticatedUser(req);
        const sessions = await listSessionsForPatient(user.userId);

        res.status(200).json({
            success: true,
            sessions
        });
    } catch (error) {
        handleCareError(error, res, "Unable to load care timeline.");
    }
};

export const getDoctorPatientSessions = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = getAuthenticatedUser(req);
        const patientUserId = validateUserIdParam(req.params.patientUserId);
        const sessions = await listSessionsForDoctorPatient(
            patientUserId,
            user.userId
        );

        res.status(200).json({
            success: true,
            sessions
        });
    } catch (error) {
        handleCareError(error, res, "Unable to load patient timeline.");
    }
};

export const getAdminSessions = async (_req: Request, res: Response): Promise<void> => {
    try {
        const sessions = await listSessionsForAdmin();

        res.status(200).json({
            success: true,
            sessions
        });
    } catch (error) {
        handleCareError(error, res, "Unable to load admin sessions.");
    }
};

export const updateSessionFeedback = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = getAuthenticatedUser(req);
        const sessionId = validateSessionIdParam(req.params.sessionId);
        const input = validateSessionUpdateInput(req.body);
        const session = await updateSessionAiFeedback(user.userId, sessionId, input);

        res.status(200).json({
            success: true,
            message: "Session updated successfully.",
            session
        });
    } catch (error) {
        handleCareError(error, res, "Unable to update session.");
    }
};



export const submitCheckIn = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = getAuthenticatedUser(req);
        const sessionId = validateSessionIdParam(req.params.sessionId);
        const input = validateCheckInInput(req.body);
        const session = await submitCheckInForSession(user.userId, sessionId, input);

        res.status(200).json({
            success: true,
            message: "Check-in submitted successfully.",
            session
        });
    } catch (error) {
        handleCareError(error, res, "Unable to submit check-in.");
    }
};

export const addDoctorComment = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = getAuthenticatedUser(req);
        const sessionId = validateSessionIdParam(req.params.sessionId);
        const input = validateCommentInput(req.body);
        const comment = await addDoctorCommentToSession(
            user.userId,
            sessionId,
            input
        );

        res.status(201).json({
            success: true,
            message: "Comment added successfully.",
            comment
        });
    } catch (error) {
        handleCareError(error, res, "Unable to add comment.");
    }
};

export const getMyNotifications = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = getAuthenticatedUser(req);
        const notifications = await listNotificationsForUser(user.userId);

        res.status(200).json({
            success: true,
            notifications
        });
    } catch (error) {
        handleCareError(error, res, "Unable to load notifications.");
    }
};

export const markMyNotificationRead = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = getAuthenticatedUser(req);
        const notificationId = validateNotificationIdParam(req.params.notificationId);
        const notification = await markNotificationRead(
            user.userId,
            notificationId
        );

        res.status(200).json({
            success: true,
            message: "Notification updated successfully.",
            notification
        });
    } catch (error) {
        handleCareError(error, res, "Unable to update notification.");
    }
};

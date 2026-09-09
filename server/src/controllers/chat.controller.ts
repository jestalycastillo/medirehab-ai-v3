import type { Request, Response } from "express";
import { HttpError } from "../utils/httpError";
import { validateChatMessageInput } from "../utils/careValidation";
import { listChatMessages, markChatMessagesRead, sendChatMessage } from "../services/chat.service";

const getUser = (req: Request) => {
    if (!req.user) throw new HttpError(401, "Unauthorized.");
    return req.user;
};

const patientUserIdFromQuery = (req: Request): string | undefined => {
    const value = req.query.patientUserId;
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !value.trim()) {
        throw new HttpError(400, "Patient user id is invalid.");
    }
    return value.trim();
};

const handleError = (error: unknown, res: Response, fallback: string): void => {
    if (error instanceof HttpError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
    }
    res.status(500).json({ success: false, message: fallback });
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = getUser(req);
        const result = await listChatMessages(user.userId, user.role, patientUserIdFromQuery(req));
        res.status(200).json({ success: true, messages: result.messages });
    } catch (error) {
        handleError(error, res, "Unable to load messages.");
    }
};

export const createMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = getUser(req);
        const message = await sendChatMessage(
            user.userId,
            user.role,
            validateChatMessageInput(req.body),
            patientUserIdFromQuery(req)
        );
        res.status(201).json({ success: true, message });
    } catch (error) {
        handleError(error, res, "Unable to send message.");
    }
};

export const markMessagesRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = getUser(req);
        await markChatMessagesRead(user.userId, user.role, patientUserIdFromQuery(req));
        res.status(200).json({ success: true });
    } catch (error) {
        handleError(error, res, "Unable to mark messages as read.");
    }
};

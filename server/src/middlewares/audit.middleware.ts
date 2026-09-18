import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const SKIPPED_PATHS = new Set(["/api/presence/heartbeat", "/api/chat/messages/read"]);

export const auditMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    res.on("finish", () => {
        if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method) || SKIPPED_PATHS.has(req.path) || !req.user?.userId) return;
        const actorUserId = req.user.userId;
        void prisma.auditLog.create({
            data: { actorUserId, method: req.method, path: req.originalUrl.split("?", 1)[0] ?? req.path, statusCode: res.statusCode }
        }).catch(() => undefined);
    });
    next();
};

import type { Request, Response } from "express";
import { listRecentAuditLogs } from "../services/audit.service";

export const getRecentAuditLogs = async (_req: Request, res: Response): Promise<void> => {
    try { res.status(200).json({ success: true, logs: await listRecentAuditLogs() }); }
    catch { res.status(500).json({ success: false, message: "Unable to load audit logs." }); }
};

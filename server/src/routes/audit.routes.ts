import { Router } from "express";
import { Role } from "@prisma/client";
import { getRecentAuditLogs } from "../controllers/audit.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requirePasswordChanged } from "../middlewares/password.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();
router.get("/", authMiddleware, requirePasswordChanged, requireRole(Role.ADMIN), getRecentAuditLogs);
export default router;

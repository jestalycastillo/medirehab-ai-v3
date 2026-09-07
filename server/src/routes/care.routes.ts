import { Router } from "express";
import { Role } from "@prisma/client";
import {
    addDoctorComment,
    getAdminSessions,
    getDoctorPatientSessions,
    getMyNotifications,
    getMySessions,
    markMyNotificationRead,
    submitCheckIn,
    updateSessionFeedback
} from "../controllers/care.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requirePasswordChanged } from "../middlewares/password.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

router.get(
    "/me/sessions",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.PATIENT),
    getMySessions
);

router.get(
    "/patients/:patientUserId/sessions",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.DOCTOR),
    getDoctorPatientSessions
);

router.get(
    "/admin/sessions",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    getAdminSessions
);

router.patch(
    "/sessions/:sessionId/feedback",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.PATIENT),
    updateSessionFeedback
);

router.post(
    "/sessions/:sessionId/check-in",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.PATIENT),
    submitCheckIn
);

router.post(
    "/sessions/:sessionId/comments",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.DOCTOR),
    addDoctorComment
);

router.get(
    "/notifications",
    authMiddleware,
    requirePasswordChanged,
    getMyNotifications
);

router.patch(
    "/notifications/:notificationId/read",
    authMiddleware,
    requirePasswordChanged,
    markMyNotificationRead
);

export default router;

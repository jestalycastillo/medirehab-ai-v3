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
import { getPatientHelpRequests, requestHelp, resolvePatientHelpRequest } from "../controllers/help.controller";

const router = Router();

router.post("/help-requests", authMiddleware, requirePasswordChanged, requireRole(Role.PATIENT), requestHelp);
router.get("/patients/:patientUserId/help-requests", authMiddleware, requirePasswordChanged, requireRole(Role.DOCTOR), getPatientHelpRequests);
router.patch("/help-requests/:requestId/resolve", authMiddleware, requirePasswordChanged, requireRole(Role.DOCTOR), resolvePatientHelpRequest);

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

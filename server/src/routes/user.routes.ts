import { Router } from "express";
import { Role } from "@prisma/client";
import {
    archiveDoctor,
    archivePatient,
    assignDoctorToPatient,
    createDoctor,
    createPatient,
    deleteDoctorPermanently,
    deletePatientPermanently,
    getAdminPatients,
    getDoctor,
    getDoctors,
    getPatient,
    getPatients,
    meProfile,
    getMyConsent,
    getMyNotificationPreferences,
    resetDoctorAccountPassword,
    resetPatientAccountPassword,
    updateDoctor,
    updateDoctorStatus,
    updateMeProfile,
    updateMyPassword,
    updateMyConsent,
    updateMyNotificationPreferences,
    updatePatient,
    updatePatientStatus
} from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requirePasswordChanged } from "../middlewares/password.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

router.get("/me/profile", authMiddleware, meProfile);
router.patch("/me/profile", authMiddleware, requirePasswordChanged, updateMeProfile);
router.patch("/me/password", authMiddleware, updateMyPassword);
router.get("/me/consent", authMiddleware, requirePasswordChanged, getMyConsent);
router.patch("/me/consent", authMiddleware, requirePasswordChanged, updateMyConsent);
router.get("/me/notification-preferences", authMiddleware, requirePasswordChanged, getMyNotificationPreferences);
router.patch("/me/notification-preferences", authMiddleware, requirePasswordChanged, updateMyNotificationPreferences);

router.get(
    "/doctors",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    getDoctors
);
router.get(
    "/doctors/:userId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    getDoctor
);
router.get(
    "/admin/patients",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    getAdminPatients
);
router.get(
    "/patients",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.DOCTOR),
    getPatients
);
router.get(
    "/patients/:userId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.DOCTOR),
    getPatient
);

router.post(
    "/doctors",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    createDoctor
);
router.post(
    "/patients",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    createPatient
);

router.patch(
    "/doctors/:userId/password",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    resetDoctorAccountPassword
);
router.patch(
    "/doctors/:userId/status",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    updateDoctorStatus
);
router.patch(
    "/doctors/:userId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    updateDoctor
);

router.patch(
    "/patients/:userId/password",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN, Role.DOCTOR),
    resetPatientAccountPassword
);
router.patch(
    "/patients/:userId/status",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN, Role.DOCTOR),
    updatePatientStatus
);
router.patch(
    "/patients/:userId/assign-doctor",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    assignDoctorToPatient
);
router.patch(
    "/patients/:userId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN, Role.DOCTOR),
    updatePatient
);

router.delete(
    "/doctors/:userId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    archiveDoctor
);
router.delete(
    "/doctors/:userId/trash",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    deleteDoctorPermanently
);
router.delete(
    "/patients/:userId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN, Role.DOCTOR),
    archivePatient
);
router.delete(
    "/patients/:userId/trash",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    deletePatientPermanently
);

export default router;

import { Router } from "express";
import { Role } from "@prisma/client";
import {
    archiveExerciseCatalogItem,
    assignExercise,
    createExerciseCatalogItem,
    deleteExerciseCatalogItemPermanently,
    getAssignedExercisesForPatient,
    getAvailableExercisesForPatient,
    getExercises,
    getMyAssignedExercises,
    removeAssignedExercise,
    restoreExerciseCatalogItem,
    updateExerciseCatalogItem,
    evaluateExerciseAssignment,
    createLiveCoaching
} from "../controllers/exercise.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requirePasswordChanged } from "../middlewares/password.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

router.get(
    "/",
    authMiddleware,
    requirePasswordChanged,
    getExercises
);

router.get(
    "/me/assigned",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.PATIENT),
    getMyAssignedExercises
);

router.post(
    "/patients/exercises/:exerciseId/assignments/:assignmentId/evaluate",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.PATIENT),
    evaluateExerciseAssignment
);

router.post(
    "/patients/exercises/:exerciseId/assignments/:assignmentId/live-coaching",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.PATIENT),
    createLiveCoaching
);

router.post(
    "/",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    createExerciseCatalogItem
);

router.patch(
    "/:exerciseId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    updateExerciseCatalogItem
);

router.delete(
    "/:exerciseId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    archiveExerciseCatalogItem
);
router.patch(
    "/:exerciseId/restore",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    restoreExerciseCatalogItem
);
router.delete(
    "/:exerciseId/trash",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.ADMIN),
    deleteExerciseCatalogItemPermanently
);

router.get(
    "/patients/:patientUserId/available",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.DOCTOR),
    getAvailableExercisesForPatient
);

router.get(
    "/patients/:patientUserId/assigned",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.DOCTOR),
    getAssignedExercisesForPatient
);

router.post(
    "/patients/:patientUserId/assignments",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.DOCTOR),
    assignExercise
);

router.delete(
    "/patients/:patientUserId/assignments/:assignmentId",
    authMiddleware,
    requirePasswordChanged,
    requireRole(Role.DOCTOR),
    removeAssignedExercise
);

export default router;

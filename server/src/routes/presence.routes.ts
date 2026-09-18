import { Router } from "express";
import { heartbeat, start, stop, viewed } from "../controllers/presence.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requirePasswordChanged } from "../middlewares/password.middleware";

const router = Router();
router.use(authMiddleware, requirePasswordChanged);
router.post("/heartbeat", heartbeat);
router.post("/assignments/viewed", viewed);
router.post("/assignments/:assignmentId/start", start);
router.post("/assignments/:assignmentId/stop", stop);
export default router;

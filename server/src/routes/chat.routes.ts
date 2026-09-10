import { Router } from "express";
import { createMessage, getMessages, markMessagesRead } from "../controllers/chat.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requirePasswordChanged } from "../middlewares/password.middleware";

const router = Router();

router.use(authMiddleware, requirePasswordChanged);
router.get("/messages", getMessages);
router.post("/messages", createMessage);
router.patch("/messages/read", markMessagesRead);

export default router;

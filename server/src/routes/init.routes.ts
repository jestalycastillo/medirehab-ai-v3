import { Request, Response, Router } from "express";
import careRoutes from "./care.routes";
import authRoutes from "./auth.routes";
import exerciseRoutes from "./exercise.routes";
import userRoutes from "./user.routes";
import uploadRoutes from "./upload.routes";
import chatRoutes from "./chat.routes";
import presenceRoutes from "./presence.routes";
import auditRoutes from "./audit.routes";

const router = Router();

router.get("/init", (req:Request, res: Response) => {
    return res.status(200).json({success: true, message: "Express is running."});
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/exercises", exerciseRoutes);
router.use("/care", careRoutes);
router.use("/chat", chatRoutes);
router.use("/presence", presenceRoutes);
router.use("/audit", auditRoutes);
router.use("/upload", uploadRoutes);

export default router;

import  express, { Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import initRoutes from "./routes/init.routes";
import { auditMiddleware } from "./middlewares/audit.middleware";

export const app = express();

app.use(cors({
    origin:process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(auditMiddleware);

app.use("/uploads", express.static(path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads")));
app.use("/api", initRoutes);
app.use("/sample", (req, res: Response) => {
    res.json({ message: "Sample route works!" });
});

export default app;

import { Request, Response } from "express";
import {
    getCurrentUser,
    InvalidCredentialsError,
    loginUser
} from "../services/auth.service";
import { HttpError } from "../utils/httpError";

const AUTH_COOKIE_NAME = "authToken";

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
            return;
        }

        const { token, user } = await loginUser(email, password);

        res.cookie(AUTH_COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            message: "Login successful.",
            mustChangePassword: user.mustChangePassword,
            user
        });
    } catch (error) {
        if (error instanceof InvalidCredentialsError) {
            res.status(401).json({
                success: false,
                message: error.message
            });
            return;
        }

        if (error instanceof HttpError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Unable to login."
        });
    }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    });

    res.status(200).json({
        success: true,
        message: "Logout successful."
    });
};

export const me = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
            return;
        }

        const user = await getCurrentUser(req.user.userId);

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found."
            });
            return;
        }

        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                archivedAt: user.archivedAt,
                mustChangePassword: user.mustChangePassword,
                passwordChangedAt: user.passwordChangedAt,
                lastLoginAt: user.lastLoginAt,
                lastSeenAt: user.lastSeenAt
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load user."
        });
    }
};

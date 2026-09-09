import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import { signAuthToken } from "../utils/jwt";
import { comparePassword } from "../utils/password";

type SafeUser = {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    archivedAt: Date | null;
    mustChangePassword: boolean;
    passwordChangedAt: Date | null;
    lastLoginAt: Date | null;
    lastSeenAt: Date | null;
};

export class InvalidCredentialsError extends Error {
    constructor() {
        super("Invalid email or password.");
        this.name = "InvalidCredentialsError";
    }
}

const toSafeUser = (user: SafeUser): SafeUser => ({
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    archivedAt: user.archivedAt,
    mustChangePassword: user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt,
    lastLoginAt: user.lastLoginAt,
    lastSeenAt: user.lastSeenAt
});

export const loginUser = async (
    email: string,
    password: string
): Promise<{ token: string; user: SafeUser }> => {
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        throw new InvalidCredentialsError();
    }

    if (!user.isActive || user.archivedAt) {
        throw new HttpError(403, "Account is inactive.");
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
        throw new InvalidCredentialsError();
    }

    const now = new Date();
    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now, lastSeenAt: now }
    });

    const token = signAuthToken({
        userId: user.id,
        role: updatedUser.role
    });

    return {
        token,
        user: toSafeUser(updatedUser)
    };
};

export const getCurrentUser = async (userId: string): Promise<SafeUser | null> => {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            archivedAt: true,
            mustChangePassword: true,
            passwordChangedAt: true,
            lastLoginAt: true,
            lastSeenAt: true
        }
    });
};

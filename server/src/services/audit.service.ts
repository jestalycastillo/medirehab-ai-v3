import { prisma } from "../lib/prisma";

export const listRecentAuditLogs = async () => prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
        id: true,
        method: true,
        path: true,
        statusCode: true,
        createdAt: true,
        actor: { select: { id: true, email: true, role: true } }
    }
});

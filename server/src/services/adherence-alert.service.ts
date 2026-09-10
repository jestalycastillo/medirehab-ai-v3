import { prisma } from "../lib/prisma";
import { calculateAssignmentAdherence, getAdherenceTimeZone } from "../utils/adherence";

const DEFAULT_SCAN_INTERVAL_MS = 15 * 60_000;
const ALERT_HOUR = 18;
let scanRunning = false;

const localHour = (date: Date, timeZone: string): number => Number(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
}).format(date));

const daysElapsedInWeek = (periodStart: string, today: string): number => {
    const start = new Date(`${periodStart}T00:00:00Z`).getTime();
    const end = new Date(`${today}T00:00:00Z`).getTime();
    return Math.max(1, Math.min(7, Math.round((end - start) / 86_400_000) + 1));
};

const patientName = (assignment: {
    patientProfile: { user: { email: string; patientProfile: { firstName: string | null; lastName: string | null } | null } };
}) => {
    const profile = assignment.patientProfile.user.patientProfile;
    return [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || assignment.patientProfile.user.email;
};

export const runAdherenceAlertScan = async (now = new Date(), patientUserId?: string): Promise<number> => {
    if (scanRunning) return 0;
    scanRunning = true;
    try {
        const timeZone = getAdherenceTimeZone();
        if (localHour(now, timeZone) < ALERT_HOUR) return 0;

        const assignments = await prisma.exerciseAssignment.findMany({
            where: {
                archivedAt: null,
                patientProfile: { is: { ...(patientUserId ? { userId: patientUserId } : {}), user: { is: { isActive: true, archivedAt: null } } } },
                assignedByDoctor: { is: { user: { is: { isActive: true, archivedAt: null } } } }
            },
            select: {
                id: true,
                assignedAt: true,
                targetSessionsPerWeek: true,
                targetSessionsPerDay: true,
                scheduledDays: true,
                exercise: { select: { name: true } },
                sessions: { select: { performedAt: true, adherenceQualified: true }, orderBy: { performedAt: "desc" }, take: 500 },
                patientProfile: {
                    select: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                careNotificationsEnabled: true,
                                patientProfile: { select: { firstName: true, lastName: true } }
                            }
                        }
                    }
                },
                assignedByDoctor: {
                    select: { user: { select: { id: true, careNotificationsEnabled: true } } }
                }
            }
        });

        let created = 0;
        for (const assignment of assignments) {
            const adherence = calculateAssignmentAdherence(assignment, now, timeZone);
            if (adherence.cadence === "DAILY" && !adherence.today) continue;
            const period = adherence.today ?? adherence.currentWeek;
            const isBehind = adherence.today
                ? period.remaining > 0
                : period.completed < Math.ceil(period.target * daysElapsedInWeek(period.periodStart, adherence.last30Days.periodEnd) / 7);
            if (!isBehind) continue;

            const periodKey = adherence.today ? period.periodStart : adherence.currentWeek.periodStart;
            const cadenceLabel = adherence.today ? "today" : "this week";
            const name = patientName(assignment);
            const recipients = [
                assignment.patientProfile.user.careNotificationsEnabled ? {
                    userId: assignment.patientProfile.user.id,
                    link: "/patient/exercises",
                    title: `${adherence.today ? "Daily" : "Weekly"} exercise goal needs attention`,
                    body: `${period.remaining} session${period.remaining === 1 ? "" : "s"} remaining ${cadenceLabel} for ${assignment.exercise.name}.`,
                    recipientRole: "PATIENT"
                } : null,
                assignment.assignedByDoctor.user.careNotificationsEnabled ? {
                    userId: assignment.assignedByDoctor.user.id,
                    link: `/doctor/patients/${assignment.patientProfile.user.id}`,
                    title: `${name} is behind their exercise goal`,
                    body: `${period.remaining} session${period.remaining === 1 ? "" : "s"} remaining ${cadenceLabel} for ${assignment.exercise.name}.`,
                    recipientRole: "DOCTOR"
                } : null
            ].filter((recipient): recipient is NonNullable<typeof recipient> => recipient !== null);

            for (const recipient of recipients) {
                const meta = { adherenceAlertKey: `${assignment.id}:${adherence.cadence}:${periodKey}:${recipient.recipientRole}`, assignmentId: assignment.id, periodKey, cadence: adherence.cadence };
                const existing = await prisma.notification.findFirst({
                    where: { userId: recipient.userId, type: "REMINDER", meta: { equals: meta } },
                    select: { id: true }
                });
                if (existing) continue;
                await prisma.notification.create({
                    data: { userId: recipient.userId, type: "REMINDER", title: recipient.title, body: recipient.body, link: recipient.link, meta }
                });
                created += 1;
            }
        }
        return created;
    } finally {
        scanRunning = false;
    }
};

const scanIntervalMs = (): number => {
    const value = Number(process.env.ADHERENCE_ALERT_INTERVAL_MS);
    return Number.isInteger(value) && value >= 60_000 ? value : DEFAULT_SCAN_INTERVAL_MS;
};

export const startAdherenceAlertWorker = (): (() => void) => {
    const run = () => void runAdherenceAlertScan().catch((error) => console.error("Adherence alert scan failed:", error));
    const initial = setTimeout(run, 10_000);
    const interval = setInterval(run, scanIntervalMs());
    initial.unref();
    interval.unref();
    return () => {
        clearTimeout(initial);
        clearInterval(interval);
    };
};

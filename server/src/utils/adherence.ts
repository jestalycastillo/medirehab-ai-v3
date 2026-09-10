export type AdherenceStatus = "MET" | "IN_PROGRESS" | "MISSED";

export type AdherencePeriod = {
    periodStart: string;
    periodEnd: string;
    completed: number;
    rawCompleted: number;
    target: number;
    remaining: number;
    daysWithActivity: number;
    status: AdherenceStatus;
};

export type AssignmentAdherence = {
    cadence: "DAILY" | "WEEKLY";
    timeZone: string;
    today: AdherencePeriod | null;
    currentWeek: AdherencePeriod;
    weeklyHistory: AdherencePeriod[];
    last30Days: AdherencePeriod & { percentage: number };
};

type AdherenceInput = {
    assignedAt: Date;
    targetSessionsPerWeek: number;
    targetSessionsPerDay: number | null;
    scheduledDays?: number[];
    sessions: { performedAt: Date; adherenceQualified?: boolean }[];
};

const DAY_MS = 86_400_000;
const DEFAULT_TIME_ZONE = "Asia/Manila";

export const getAdherenceTimeZone = (): string => {
    const configured = process.env.ADHERENCE_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;
    try {
        new Intl.DateTimeFormat("en", { timeZone: configured }).format(new Date());
        return configured;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
};

const dateKey = (date: Date, timeZone: string): string => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return `${value("year")}-${value("month")}-${value("day")}`;
};

const fromKey = (key: string): Date => {
    const parts = key.split("-").map(Number);
    return new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
};

const addDays = (key: string, days: number): string => new Date(fromKey(key).getTime() + days * DAY_MS).toISOString().slice(0, 10);

const mondayOf = (key: string): string => {
    const weekday = fromKey(key).getUTCDay();
    return addDays(key, -(weekday === 0 ? 6 : weekday - 1));
};

const daysBetweenInclusive = (start: string, end: string): number => Math.max(0, Math.round((fromKey(end).getTime() - fromKey(start).getTime()) / DAY_MS) + 1);

const countByDate = (sessions: { performedAt: Date; adherenceQualified?: boolean }[], timeZone: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
        if (session.adherenceQualified === false) continue;
        const key = dateKey(session.performedAt, timeZone);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
};

const buildPeriod = ({ start, end, today, assigned, weeklyTarget, dailyTarget, scheduledDays, counts }: {
    start: string;
    end: string;
    today: string;
    assigned: string;
    weeklyTarget: number;
    dailyTarget: number | null;
    scheduledDays: number[];
    counts: Map<string, number>;
}): AdherencePeriod => {
    const activeStart = start < assigned ? assigned : start;
    const isScheduled = (key: string) => scheduledDays.length === 0 || scheduledDays.includes(fromKey(key).getUTCDay() || 7);
    let activeDays = 0;
    let rawCompleted = 0;
    let completed = 0;
    let daysWithActivity = 0;

    for (let key = activeStart; key <= end; key = addDays(key, 1)) {
        const dailyCompleted = counts.get(key) ?? 0;
        rawCompleted += dailyCompleted;
        if (!dailyTarget || isScheduled(key)) completed += dailyTarget ? Math.min(dailyCompleted, dailyTarget) : dailyCompleted;
        if (!dailyTarget || isScheduled(key)) activeDays += 1;
        if (dailyCompleted > 0) daysWithActivity += 1;
    }

    const target = dailyTarget ? dailyTarget * activeDays : Math.max(1, Math.ceil(weeklyTarget * (activeDays / 7)));
    const remaining = Math.max(0, target - completed);
    const status: AdherenceStatus = completed >= target ? "MET" : end < today ? "MISSED" : "IN_PROGRESS";
    return { periodStart: activeStart, periodEnd: end, completed, rawCompleted, target, remaining, daysWithActivity, status };
};

export const calculateAssignmentAdherence = (input: AdherenceInput, now = new Date(), timeZone = getAdherenceTimeZone()): AssignmentAdherence => {
    const todayKey = dateKey(now, timeZone);
    const assignedKey = dateKey(input.assignedAt, timeZone);
    const currentWeekStart = mondayOf(todayKey);
    const counts = countByDate(input.sessions, timeZone);
    const dailyTarget = input.targetSessionsPerDay;
    const scheduledDays = input.scheduledDays ?? [];

    const currentWeek = buildPeriod({ start: currentWeekStart, end: addDays(currentWeekStart, 6), today: todayKey, assigned: assignedKey, weeklyTarget: input.targetSessionsPerWeek, dailyTarget, scheduledDays, counts });
    const weeklyHistory: AdherencePeriod[] = [];
    for (let offset = 0; offset < 8; offset += 1) {
        const start = addDays(currentWeekStart, -7 * offset);
        const end = addDays(start, 6);
        if (end < assignedKey) break;
        weeklyHistory.push(buildPeriod({ start, end, today: todayKey, assigned: assignedKey, weeklyTarget: input.targetSessionsPerWeek, dailyTarget, scheduledDays, counts }));
    }

    const thirtyDaysAgo = addDays(todayKey, -29);
    const last30Start = thirtyDaysAgo < assignedKey ? assignedKey : thirtyDaysAgo;
    const last30Base = dailyTarget
        ? buildPeriod({ start: last30Start, end: todayKey, today: todayKey, assigned: assignedKey, weeklyTarget: input.targetSessionsPerWeek, dailyTarget, scheduledDays, counts })
        : (() => {
            let completed = 0;
            let daysWithActivity = 0;
            for (let key = last30Start; key <= todayKey; key = addDays(key, 1)) {
                const value = counts.get(key) ?? 0;
                completed += value;
                if (value > 0) daysWithActivity += 1;
            }
            const activeDays = daysBetweenInclusive(last30Start, todayKey);
            const target = Math.max(1, Math.ceil(input.targetSessionsPerWeek * activeDays / 7));
            return { periodStart: last30Start, periodEnd: todayKey, completed, rawCompleted: completed, target, remaining: Math.max(0, target - completed), daysWithActivity, status: (completed >= target ? "MET" : "IN_PROGRESS") as AdherenceStatus };
        })();

    const todayIsScheduled = scheduledDays.length === 0 || scheduledDays.includes(fromKey(todayKey).getUTCDay() || 7);
    const today = dailyTarget && todayIsScheduled ? buildPeriod({ start: todayKey, end: todayKey, today: todayKey, assigned: assignedKey, weeklyTarget: input.targetSessionsPerWeek, dailyTarget, scheduledDays, counts }) : null;
    return {
        cadence: dailyTarget ? "DAILY" : "WEEKLY",
        timeZone,
        today,
        currentWeek,
        weeklyHistory,
        last30Days: { ...last30Base, percentage: Math.min(100, Math.round((last30Base.completed / last30Base.target) * 100)) }
    };
};

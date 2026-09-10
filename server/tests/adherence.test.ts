import assert from "node:assert/strict";
import { calculateAssignmentAdherence } from "../src/utils/adherence";

const atManila = (value: string) => new Date(`${value}+08:00`);
const assignedAt = atManila("2026-08-31T08:00:00");
const now = atManila("2026-09-10T18:00:00");

const weekly = calculateAssignmentAdherence({
    assignedAt,
    targetSessionsPerWeek: 4,
    targetSessionsPerDay: null,
    sessions: [
        { performedAt: atManila("2026-09-07T09:00:00") },
        { performedAt: atManila("2026-09-08T09:00:00") },
        { performedAt: atManila("2026-09-01T09:00:00") }
    ]
}, now, "Asia/Manila");

assert.equal(weekly.cadence, "WEEKLY");
assert.deepEqual(
    { completed: weekly.currentWeek.completed, target: weekly.currentWeek.target, remaining: weekly.currentWeek.remaining, status: weekly.currentWeek.status },
    { completed: 2, target: 4, remaining: 2, status: "IN_PROGRESS" }
);
assert.deepEqual(
    { completed: weekly.weeklyHistory[1]?.completed, remaining: weekly.weeklyHistory[1]?.remaining, status: weekly.weeklyHistory[1]?.status },
    { completed: 1, remaining: 3, status: "MISSED" }
);

const daily = calculateAssignmentAdherence({
    assignedAt,
    targetSessionsPerWeek: 3,
    targetSessionsPerDay: 1,
    sessions: [
        { performedAt: atManila("2026-09-07T09:00:00") },
        { performedAt: atManila("2026-09-10T09:00:00") },
        { performedAt: atManila("2026-09-10T15:00:00") }
    ]
}, now, "Asia/Manila");

assert.equal(daily.cadence, "DAILY");
assert.deepEqual(
    { completed: daily.today?.completed, rawCompleted: daily.today?.rawCompleted, remaining: daily.today?.remaining, status: daily.today?.status },
    { completed: 1, rawCompleted: 2, remaining: 0, status: "MET" }
);
assert.equal(daily.currentWeek.completed, 2, "Extra same-day sessions must not replace another day's daily quota");
assert.equal(daily.currentWeek.rawCompleted, 3);
assert.equal(daily.currentWeek.target, 7);

const scheduled = calculateAssignmentAdherence({
    assignedAt,
    targetSessionsPerWeek: 3,
    targetSessionsPerDay: 1,
    scheduledDays: [1, 4],
    sessions: [
        { performedAt: atManila("2026-09-07T09:00:00"), adherenceQualified: true },
        { performedAt: atManila("2026-09-08T09:00:00"), adherenceQualified: false },
        { performedAt: atManila("2026-09-10T09:00:00"), adherenceQualified: true }
    ]
}, now, "Asia/Manila");
assert.equal(scheduled.currentWeek.target, 2);
assert.equal(scheduled.currentWeek.completed, 2);
assert.equal(scheduled.today?.status, "MET");

console.log("Adherence calculations passed: calendar weeks, daily caps, remaining counts, and historical missed status.");

"use client";

import type { AdherencePeriod, AssignmentAdherence } from "@/lib/api";

const statusLabel = (status: AdherencePeriod["status"]) => status === "MET" ? "Met" : status === "MISSED" ? "Missed" : "In progress";
const statusClass = (status: AdherencePeriod["status"]) => status === "MET" ? "badge-green" : status === "MISSED" ? "badge-red" : "badge-amber";

function formatPeriod(start: string, end: string) {
  const format = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return start === end ? format(start) : `${format(start)}–${format(end)}`;
}

function PeriodLine({ period, label }: { period: AdherencePeriod; label: string }) {
  return (
    <div className="adherence-history-row">
      <span>{label}</span>
      <strong>{period.completed}/{period.target}</strong>
      <span className={`badge ${statusClass(period.status)}`}>{statusLabel(period.status)}</span>
    </div>
  );
}

export function AdherenceSummary({ adherence, showHistory = false }: { adherence?: AssignmentAdherence; showHistory?: boolean }) {
  if (!adherence) return null;
  const primary = adherence.today ?? adherence.currentWeek;
  const label = adherence.today ? "Today" : "This week";
  const percentage = primary.target ? Math.min(100, (primary.completed / primary.target) * 100) : 0;

  return (
    <div className="adherence-summary">
      <div className="adherence-heading">
        <div>
          <strong>{label}: {primary.completed}/{primary.target}</strong>
          <div className="adherence-remaining">{primary.remaining > 0 ? `${primary.remaining} remaining` : "Target complete"}</div>
        </div>
        <span className={`badge ${statusClass(primary.status)}`}>{statusLabel(primary.status)}</span>
      </div>
      <div className="adherence-progress" aria-label={`${primary.completed} of ${primary.target} sessions completed`}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      {adherence.today && (
        <div className="adherence-week-line">
          Monday–Sunday: {adherence.currentWeek.completed}/{adherence.currentWeek.target} · {adherence.currentWeek.remaining} remaining
        </div>
      )}
      {primary.rawCompleted > primary.completed && (
        <div className="adherence-week-line">{primary.rawCompleted - primary.completed} extra session{primary.rawCompleted - primary.completed === 1 ? "" : "s"} recorded without replacing another day.</div>
      )}
      {showHistory && adherence.weeklyHistory.length > 1 && (
        <details className="adherence-history">
          <summary>Weekly history</summary>
          <div>
            {adherence.weeklyHistory.map((period, index) => (
              <PeriodLine key={period.periodStart} period={period} label={index === 0 ? `Current · ${formatPeriod(period.periodStart, period.periodEnd)}` : formatPeriod(period.periodStart, period.periodEnd)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

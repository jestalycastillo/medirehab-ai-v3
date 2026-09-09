"use client";

import type { CareSession } from "@/lib/api";
import { formatScore } from "@/lib/score";

export function ScoreSummary({ sessions }: { sessions: CareSession[] }) {
  const scored = sessions.filter((session) => typeof session.score === "number");
  if (scored.length === 0) return null;

  const latest = scored[0].score ?? 0;
  const oldest = scored[scored.length - 1].score ?? 0;
  const best = Math.max(...scored.map((session) => session.score ?? 0));
  const change = latest - oldest;

  return <section className="card" style={{ padding: "24px" }}>
    <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 16px" }}>Score Progress</h2>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "18px" }}>
      <div><div style={{ color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>Latest</div><strong style={{ fontSize: "22px" }}>{formatScore(latest)}</strong></div>
      <div><div style={{ color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>Best</div><strong style={{ fontSize: "22px" }}>{formatScore(best)}</strong></div>
      <div><div style={{ color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>Change</div><strong style={{ fontSize: "22px", color: change >= 0 ? "#166534" : "#991B1B" }}>{change >= 0 ? "+" : ""}{formatScore(change)}</strong></div>
    </div>
    <div style={{ display: "flex", gap: "6px", height: "110px", alignItems: "flex-end" }} aria-label="Recent score trend">
      {scored.slice(0, 10).reverse().map((session) => <div key={session.id} title={`${session.assignment.exercise.name}: ${formatScore(session.score)}`} style={{ flex: 1, minWidth: "8px", height: `${Math.max(4, session.score ?? 0)}%`, backgroundColor: "var(--color-primary)", borderRadius: "5px 5px 0 0" }} />)}
    </div>
  </section>;
}

"use client";

import { useMemo, useState } from "react";
import { type CareSession } from "@/lib/api";
import { formatScore } from "@/lib/score";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayName(author?: CareSession["comments"][number]["author"]) {
  if (!author) return "Unknown";
  return author.displayName || author.email;
}

function StatChip({ label, value }: { label: string; value?: number | null }) {
  return (
    <span className="badge badge-blue" style={{ fontSize: "12px" }}>
      {label} {value ?? "-"}
    </span>
  );
}

export function CareTimeline({
  sessions,
  role,
  onCommentSubmit,
  isBusy = false,
}: {
  sessions: CareSession[];
  role: "patient" | "doctor";
  onCommentSubmit?: (sessionId: string, body: string) => Promise<void> | void;
  isBusy?: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const visibleSessions = useMemo(() => sessions, [sessions]);

  if (visibleSessions.length === 0) {
    return (
      <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--color-text-muted)" }}>
        No care sessions recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {visibleSessions.map((session) => {
        const comments = role === "patient"
          ? session.comments.filter((comment) => comment.isVisibleToPatient)
          : session.comments;

        return (
          <article key={session.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "18px", display: "flex", flexDirection: "column", gap: "14px", backgroundColor: "var(--color-surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px 0" }}>
                  {session.assignment.exercise.name}{session.selectedSide ? ` · ${session.selectedSide === "left" ? "Left" : "Right"} arm` : ""}
                </h3>
                <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "13px" }}>
                  Performed {formatDate(session.performedAt)}
                </p>
              </div>
              <span className="badge badge-blue">Score {formatScore(session.score ?? session.assignment.result?.score)}</span>
            </div>

            <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "14px" }}>
              {session.assignment.exercise.description}
            </p>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span className={`badge ${session.adherenceQualified === false ? "badge-amber" : "badge-green"}`}>{session.adherenceQualified === false ? "Not counted" : "Counted"}</span>
              {session.durationSeconds && <StatChip label="Duration" value={session.durationSeconds} />}
              <StatChip label="Pain" value={session.painLevel} />
              <StatChip label="Difficulty" value={session.difficultyLevel} />
              <StatChip label="Confidence" value={session.confidenceLevel} />
            </div>
            {session.qualificationReason && <div style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", background: "#FEF3C7", color: "#92400E", fontSize: "13px" }}>{session.qualificationReason}</div>}

            {session.patientNote && (
              <div style={{ padding: "12px 14px", backgroundColor: "var(--color-primary-light)", borderRadius: "var(--radius-md)", color: "var(--color-text-primary)" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary-dark)", marginBottom: "6px" }}>
                  Patient note
                </div>
                <div style={{ fontSize: "14px" }}>{session.patientNote}</div>
              </div>
            )}

            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "8px" }}>
                AI Feedback
              </div>
              {session.aiFeedback.length === 0 ? (
                <div style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>No feedback saved yet.</div>
              ) : (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {session.aiFeedback.map((feedback) => (
                    <span key={`${session.id}-${feedback}`} className="badge badge-blue" style={{ backgroundColor: "#DBEAFE" }}>
                      {feedback}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "8px" }}>
                Comments
              </div>
              {comments.length === 0 ? (
                <div style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>No comments yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {comments.map((comment) => (
                    <div key={comment.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 14px", backgroundColor: comment.isVisibleToPatient ? "var(--color-surface)" : "#F8FAFC" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
                        <div style={{ fontWeight: 700, fontSize: "13px" }}>
                          {displayName(comment.author)}
                        </div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                          {formatDate(comment.createdAt)}
                        </div>
                      </div>
                      <div style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>{comment.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {role === "doctor" && onCommentSubmit && (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const draft = drafts[session.id]?.trim();
                  if (!draft) return;
                  await onCommentSubmit(session.id, draft);
                  setDrafts((current) => ({ ...current, [session.id]: "" }));
                }}
                style={{ display: "flex", flexDirection: "column", gap: "10px" }}
              >
                <textarea
                  className="input"
                  placeholder="Leave a note for this patient"
                  value={drafts[session.id] || ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [session.id]: event.target.value }))}
                  style={{ minHeight: "92px", resize: "vertical", paddingTop: "10px" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn btn-primary" type="submit" disabled={isBusy}>
                    {isBusy ? "Saving..." : "Add Comment"}
                  </button>
                </div>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}

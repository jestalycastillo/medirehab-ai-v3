"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type CareSession, resolveMediaUrl } from "@/lib/api";
import { formatScore } from "@/lib/score";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Video } from "lucide-react";

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

function SessionVideoPlayer({ videoUrl, sessionName }: { videoUrl: string; sessionName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedUrl = resolveMediaUrl(videoUrl);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  if (!resolvedUrl) return null;

  return (
    <div
      style={{
        border: "1.5px solid var(--color-primary, #0f766e)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        backgroundColor: isOpen ? "#f0fdfa" : "#f8fafc",
        boxShadow: "0 1px 3px rgba(15, 118, 110, 0.08)",
        transition: "all 0.2s ease",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 16px",
          background: isOpen
            ? "linear-gradient(135deg, #ccfbf1 0%, #e6fffa 100%)"
            : "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)",
          border: "none",
          cursor: "pointer",
          fontSize: "13.5px",
          fontWeight: 700,
          color: "var(--color-primary-dark, #0b4a47)",
          transition: "background 0.2s ease",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              backgroundColor: "var(--color-primary, #0f766e)",
              color: "#ffffff",
              boxShadow: "0 2px 4px rgba(15, 118, 110, 0.2)",
            }}
          >
            <Video size={15} />
          </span>
          <span>{isOpen ? "Hide Recorded Exercise Video" : "Watch Recorded Exercise Video"}</span>
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            backgroundColor: "rgba(15, 118, 110, 0.1)",
            color: "var(--color-primary, #0f766e)",
          }}
        >
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {isOpen && (
        <div
          ref={containerRef}
          style={{
            padding: isFullscreen ? "24px" : "12px 14px",
            borderTop: "1.5px solid var(--color-primary, #0f766e)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            backgroundColor: "#0f172a",
            height: isFullscreen ? "100vh" : "auto",
            justifyContent: isFullscreen ? "center" : "flex-start",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: isFullscreen ? "900px" : "560px",
              margin: "0 auto",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              backgroundColor: "#000",
            }}
          >
            <video
              src={resolvedUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="session-mirrored-video"
              style={{
                width: "100%",
                maxHeight: isFullscreen ? "calc(100vh - 120px)" : "360px",
                display: "block",
                objectFit: "contain",
                borderRadius: "var(--radius-md)",
                transform: "scaleX(-1)",
              }}
            />
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Maximize Video"}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                backgroundColor: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "6px",
                color: "#f8fafc",
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                zIndex: 5,
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? "Exit" : "Maximize"}
            </button>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              color: "#94a3b8",
              maxWidth: isFullscreen ? "900px" : "560px",
              width: "100%",
              margin: "0 auto",
            }}
          >
            <span>Recording: {sessionName}</span>
            <button
              type="button"
              onClick={toggleFullscreen}
              style={{
                background: "none",
                border: "none",
                color: "#60a5fa",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                padding: 0,
              }}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {isFullscreen ? "Exit Fullscreen" : "Maximize"}
            </button>
          </div>
        </div>
      )}
    </div>
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
    <div className="care-timeline" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
              <span
                className="badge badge-blue"
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: "var(--radius-md)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {session.score !== null ? `Score ${formatScore(session.score)}` : "Not scored"}
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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

            {session.videoUrl && (
              <SessionVideoPlayer videoUrl={session.videoUrl} sessionName={session.assignment.exercise.name} />
            )}

            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "8px" }}>
                AI Feedback
              </div>
              {session.aiFeedback.length === 0 ? (
                <div style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>No feedback saved yet.</div>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}
                >
                  {session.aiFeedback.map((feedback, index) => (
                    <li
                      key={`${session.id}-${index}-${feedback}`}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "var(--color-primary, #0f766e)",
                          marginTop: "7px",
                          flexShrink: 0,
                        }}
                      />
                      <span>{feedback}</span>
                    </li>
                  ))}
                </ul>
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

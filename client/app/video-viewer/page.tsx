"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resolveMediaUrl } from "@/lib/api";
import { ArrowLeft, FlipHorizontal, Maximize2, Minimize2, Video } from "lucide-react";

function VideoViewerContent() {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url") || "";
  const title = searchParams.get("title") || "Exercise Session Recording";
  const [isFlipped, setIsFlipped] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const resolvedUrl = resolveMediaUrl(rawUrl);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
    }
  };

  if (!resolvedUrl) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#090d16", color: "#94a3b8" }}>
        <div style={{ textAlign: "center", padding: "24px" }}>
          <Video size={48} style={{ margin: "0 auto 16px", color: "#64748b" }} />
          <h2 style={{ color: "#f8fafc", fontSize: "18px", marginBottom: "8px" }}>No Video URL Provided</h2>
          <p style={{ fontSize: "14px" }}>Please check the link and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        backgroundColor: "#090d16",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
      }}
    >
      {/* Top Navigation Bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          backgroundColor: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={() => window.close()}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              color: "#f8fafc",
              cursor: "pointer",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} /> Close
          </button>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#f8fafc" }}>{title}</h1>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Exercise Video Playback</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setIsFlipped((prev) => !prev)}
            title={isFlipped ? "Unflip video (view original camera sensor)" : "Flip video (mirror perspective)"}
            style={{
              background: isFlipped ? "rgba(37, 99, 235, 0.2)" : "rgba(255, 255, 255, 0.08)",
              border: isFlipped ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.15)",
              color: isFlipped ? "#60a5fa" : "#f8fafc",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FlipHorizontal size={16} />
            {isFlipped ? "Mirrored (Flipped)" : "Original"}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f8fafc",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? "Exit Fullscreen" : "Maximize"}
          </button>
        </div>
      </header>

      {/* Main Video Area */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "1000px",
            maxHeight: "calc(100vh - 150px)",
            backgroundColor: "#000",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <video
            ref={videoRef}
            src={resolvedUrl}
            controls
            autoPlay
            playsInline
            className={isFlipped ? "session-mirrored-video" : ""}
            style={{
              width: "100%",
              height: "100%",
              maxHeight: "calc(100vh - 160px)",
              objectFit: "contain",
              transform: isFlipped ? "scaleX(-1)" : "none",
            }}
          />
        </div>
      </main>

      {/* Footer info */}
      <footer
        style={{
          padding: "12px 24px",
          textAlign: "center",
          fontSize: "12px",
          color: "#64748b",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        MediRehab AI · Patient Video Review Player
      </footer>
    </div>
  );
}

export default function VideoViewerPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#090d16", color: "#94a3b8" }}>
          Loading video player...
        </div>
      }
    >
      <VideoViewerContent />
    </Suspense>
  );
}

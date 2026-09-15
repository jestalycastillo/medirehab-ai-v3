"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Maximize2, Minimize2, EyeOff, RotateCcw, Film, Bot } from "lucide-react";
import { getExerciseDemoVideoUrl } from "@/lib/pose/exercise-model-config";
import { AnimatedExerciseGuide } from "./animated-exercise-guide";

interface FollowAlongVideoProps {
    exerciseName: string;
    selectedSide?: "left" | "right" | null;
    analysisModelKey?: string | null;
    isRecording?: boolean;
    onClose?: () => void;
}

export function FollowAlongVideo({
    exerciseName,
    selectedSide,
    analysisModelKey,
    isRecording = false,
}: FollowAlongVideoProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [guideMode, setGuideMode] = useState<"animated" | "video">("animated");
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMirrored, setIsMirrored] = useState(false);
    const [playbackRate, setPlaybackRate] = useState<number>(1.0);
    const [isVisible, setIsVisible] = useState(true);

    const videoSrc = getExerciseDemoVideoUrl(exerciseName, selectedSide, analysisModelKey);

    // Auto play video when recording starts if in video mode
    useEffect(() => {
        if (isRecording && guideMode === "video" && videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
            setIsPlaying(true);
        }
    }, [isRecording, guideMode]);

    // Handle playback rate change
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    const togglePlay = () => {
        if (guideMode === "video") {
            if (!videoRef.current) return;
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                videoRef.current.play().catch(() => {});
                setIsPlaying(true);
            }
        } else {
            setIsPlaying((prev) => !prev);
        }
    };

    const restartVideo = () => {
        if (guideMode === "video" && videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
        }
        setIsPlaying(true);
    };

    const cyclePlaybackRate = () => {
        const rates = [0.75, 1.0, 1.25];
        const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
        setPlaybackRate(rates[nextIdx]);
    };

    if (!isVisible) {
        return (
            <button
                type="button"
                className="follow-along-reopen-btn"
                onClick={() => setIsVisible(true)}
                title="Show Exercise Follow-Along Guide"
                aria-label="Show Follow Along Exercise Guide"
            >
                <Bot size={15} />
                <span>Show Exercise Guide</span>
            </button>
        );
    }

    const sideLabel = selectedSide ? (selectedSide === "left" ? "Left Arm" : "Right Arm") : null;
    const displayName = sideLabel ? `${sideLabel} ${exerciseName}` : exerciseName;

    return (
        <div
            className={`follow-along-card animate-scale-in ${isMinimized ? "follow-along-minimized" : ""}`}
            role="region"
            aria-label="Animated exercise demonstration guide to follow along"
        >
            {/* Header / Title Bar */}
            <div className="follow-along-header">
                <div className="follow-along-title-group">
                    <span className="follow-along-pulse-dot" aria-hidden="true" />
                    <strong className="follow-along-title">
                        {isMinimized ? "Guide" : displayName}
                    </strong>
                </div>

                <div className="follow-along-actions">
                    {/* Mode Toggle (Animated Avatar vs Video) */}
                    {!isMinimized && (
                        <div className="follow-along-mode-switch">
                            <button
                                type="button"
                                onClick={() => setGuideMode("animated")}
                                className={`follow-along-mode-btn ${guideMode === "animated" ? "follow-along-mode-btn-active" : ""}`}
                                title="Animated Avatar Guide"
                            >
                                Avatar
                            </button>
                            <button
                                type="button"
                                onClick={() => setGuideMode("video")}
                                className={`follow-along-mode-btn ${guideMode === "video" ? "follow-along-mode-btn-active" : ""}`}
                                title="Instructor Video"
                            >
                                Video
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={cyclePlaybackRate}
                        className="follow-along-mini-btn"
                        title={`Speed: ${playbackRate}x`}
                        aria-label={`Change speed, currently ${playbackRate}x`}
                    >
                        {playbackRate}x
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsMirrored((prev) => !prev)}
                        className={`follow-along-mini-btn ${isMirrored ? "follow-along-btn-active" : ""}`}
                        title={isMirrored ? "Mirrored" : "Normal"}
                        aria-label="Toggle mirror reflection"
                    >
                        Flip
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsMinimized((prev) => !prev)}
                        className="follow-along-mini-btn"
                        title={isMinimized ? "Expand guide" : "Minimize guide"}
                        aria-label={isMinimized ? "Expand guide" : "Minimize guide"}
                    >
                        {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsVisible(false)}
                        className="follow-along-mini-btn"
                        title="Hide guide"
                        aria-label="Hide exercise guide"
                    >
                        <EyeOff size={12} />
                    </button>
                </div>
            </div>

            {/* Guide Display (Animated Avatar or Video Player) */}
            {!isMinimized && (
                <div className="follow-along-video-wrapper">
                    {guideMode === "animated" ? (
                        <AnimatedExerciseGuide
                            exerciseName={exerciseName}
                            selectedSide={selectedSide}
                            analysisModelKey={analysisModelKey}
                            isRecording={isRecording}
                            speed={playbackRate}
                        />
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                key={videoSrc}
                                src={videoSrc}
                                autoPlay
                                loop
                                muted
                                playsInline
                                preload="auto"
                                className="follow-along-video-element"
                                style={{ transform: isMirrored ? "scaleX(-1)" : "none" }}
                            />

                            <div className="follow-along-controls-bar">
                                <button
                                    type="button"
                                    onClick={togglePlay}
                                    className="follow-along-control-btn"
                                    aria-label={isPlaying ? "Pause video" : "Play video"}
                                >
                                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                                </button>

                                <button
                                    type="button"
                                    onClick={restartVideo}
                                    className="follow-along-control-btn"
                                    title="Restart demo video"
                                    aria-label="Restart demo video"
                                >
                                    <RotateCcw size={13} />
                                </button>

                                <span className="follow-along-badge">Video Demo</span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

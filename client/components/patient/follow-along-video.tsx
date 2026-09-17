"use client";

import React, { useState } from "react";
import { EyeOff, Bot } from "lucide-react";
import { AnimatedExerciseGuide } from "./animated-exercise-guide";

interface FollowAlongVideoProps {
    exerciseName: string;
    selectedSide?: "left" | "right" | null;
    analysisModelKey?: string | null;
    isRecording?: boolean;
    isCountingDown?: boolean;
    onClose?: () => void;
}

export function FollowAlongVideo({
    exerciseName,
    selectedSide,
    analysisModelKey,
    isRecording = false,
    isCountingDown = false,
}: FollowAlongVideoProps) {
    const [playbackRate, setPlaybackRate] = useState<number>(1.0);
    const [isVisible, setIsVisible] = useState(true);

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
                title="Show Exercise Avatar Guide"
                aria-label="Show Exercise Avatar Guide"
            >
                <Bot size={15} style={{ color: "#2dd4bf" }} />
                <span>Show Guide</span>
            </button>
        );
    }

    return (
        <div
            className="follow-along-card animate-scale-in"
            role="region"
            aria-label="Animated exercise demonstration avatar guide to follow along"
        >
            {/* Header Bar */}
            <div className="follow-along-header">
                <div
                    className="follow-along-actions"
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Bot size={14} style={{ color: "#0f766e" }} />
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                            Exercise Guide
                        </span>
                    </div>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
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
                            onClick={() => setIsVisible(false)}
                            className="follow-along-mini-btn"
                            title="Hide guide"
                            aria-label="Hide exercise guide"
                        >
                            <EyeOff size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Avatar Guide Display */}
            <div className="follow-along-video-wrapper" style={{ backgroundColor: "#ffffff", background: "#ffffff" }}>
                <AnimatedExerciseGuide
                    exerciseName={exerciseName}
                    selectedSide={selectedSide}
                    analysisModelKey={analysisModelKey}
                    isRecording={isRecording}
                    isCountingDown={isCountingDown}
                    speed={playbackRate}
                />
            </div>
        </div>
    );
}

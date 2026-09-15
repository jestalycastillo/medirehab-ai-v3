"use client";

import React, { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Activity } from "lucide-react";

interface AnimatedExerciseGuideProps {
    exerciseName: string;
    selectedSide?: "left" | "right" | null;
    analysisModelKey?: string | null;
    isRecording?: boolean;
    speed?: number; // 0.75, 1.0, 1.25
}

type MovementType = "side_arms_raise" | "left_flexion" | "right_flexion" | "left_abduction" | "right_abduction";

function resolveMovementType(
    exerciseName?: string,
    selectedSide?: "left" | "right" | null,
    modelKey?: string | null,
): MovementType {
    const norm = (exerciseName || "").toLowerCase();
    const key = (modelKey || "").toLowerCase();

    if (norm.includes("flexion") || key.includes("flexion")) {
        if (selectedSide === "right" || key.includes("right")) {
            return "right_flexion";
        }
        return "left_flexion";
    }

    if (norm.includes("abduction") || key.includes("abduction")) {
        if (selectedSide === "right" || key.includes("right")) {
            return "right_abduction";
        }
        return "left_abduction";
    }

    return "side_arms_raise";
}

export function AnimatedExerciseGuide({
    exerciseName,
    selectedSide,
    analysisModelKey,
    isRecording = false,
    speed = 1.0,
}: AnimatedExerciseGuideProps) {
    const [isPaused, setIsPaused] = useState(false);
    const [cyclePhase, setCyclePhase] = useState<"Raise Up" | "Hold Peak" | "Lower Down" | "Rest">("Raise Up");
    const [currentAngle, setCurrentAngle] = useState(0);

    const movement = resolveMovementType(exerciseName, selectedSide, analysisModelKey);
    const animationDuration = 4.0 / speed; // 4s full cycle adjusted by speed

    // Synchronize phase telemetry counter
    useEffect(() => {
        if (isPaused) return;

        let frameId: number;
        const startTime = performance.now();

        const updateTelemetry = () => {
            const now = performance.now();
            const elapsed = ((now - startTime) / 1000) % animationDuration;
            const progress = elapsed / animationDuration; // 0 to 1

            let maxAngle = 90;
            if (movement.includes("flexion")) maxAngle = 150;
            if (movement.includes("abduction")) maxAngle = 120;

            if (progress < 0.4) {
                // Raising phase (0% - 40%)
                setCyclePhase("Raise Up");
                const p = progress / 0.4;
                // Ease out curve
                const eased = Math.sin((p * Math.PI) / 2);
                setCurrentAngle(Math.round(eased * maxAngle));
            } else if (progress < 0.5) {
                // Peak hold phase (40% - 50%)
                setCyclePhase("Hold Peak");
                setCurrentAngle(maxAngle);
            } else if (progress < 0.9) {
                // Lowering phase (50% - 90%)
                setCyclePhase("Lower Down");
                const p = (progress - 0.5) / 0.4;
                const eased = Math.cos((p * Math.PI) / 2);
                setCurrentAngle(Math.round(eased * maxAngle));
            } else {
                // Rest pause (90% - 100%)
                setCyclePhase("Rest");
                setCurrentAngle(0);
            }

            frameId = requestAnimationFrame(updateTelemetry);
        };

        frameId = requestAnimationFrame(updateTelemetry);
        return () => cancelAnimationFrame(frameId);
    }, [animationDuration, isPaused, movement]);

    const isLeftArmActive =
        movement === "side_arms_raise" || movement === "left_flexion" || movement === "left_abduction";
    const isRightArmActive =
        movement === "side_arms_raise" || movement === "right_flexion" || movement === "right_abduction";

    const leftArmAnimationClass =
        !isPaused && isLeftArmActive
            ? movement === "left_flexion"
                ? "anim-left-flexion"
                : movement === "left_abduction"
                ? "anim-left-abduction"
                : "anim-left-side-raise"
            : "";

    const rightArmAnimationClass =
        !isPaused && isRightArmActive
            ? movement === "right_flexion"
                ? "anim-right-flexion"
                : movement === "right_abduction"
                ? "anim-right-abduction"
                : "anim-right-side-raise"
            : "";

    return (
        <div className="animated-exercise-container">
            {/* SVG Anatomical Avatar */}
            <svg
                viewBox="0 0 200 240"
                className="animated-exercise-svg"
                role="img"
                aria-label={`Animated exercise demonstration for ${exerciseName}`}
                style={{
                    animationDuration: `${animationDuration}s`,
                }}
            >
                <defs>
                    <linearGradient id="avatar-glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#00FF9D" stopOpacity="0.4" />
                    </linearGradient>

                    <linearGradient id="body-gradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0f2b38" />
                        <stop offset="100%" stopColor="#071821" />
                    </linearGradient>

                    <linearGradient id="torso-cage-glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(0, 240, 255, 0.25)" />
                        <stop offset="100%" stopColor="rgba(0, 255, 157, 0.05)" />
                    </linearGradient>

                    <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Background Trajectory Motion Arc */}
                {isLeftArmActive && (
                    <path
                        d={
                            movement === "left_flexion"
                                ? "M 48 160 A 70 85 0 0 1 58 20"
                                : "M 48 160 A 85 85 0 0 1 12 76"
                        }
                        fill="none"
                        stroke="rgba(0, 240, 255, 0.22)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        className="trajectory-arc"
                    />
                )}

                {isRightArmActive && (
                    <path
                        d={
                            movement === "right_flexion"
                                ? "M 152 160 A 70 85 0 0 0 142 20"
                                : "M 152 160 A 85 85 0 0 0 188 76"
                        }
                        fill="none"
                        stroke="rgba(0, 240, 255, 0.22)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        className="trajectory-arc"
                    />
                )}

                {/* Pelvis & Legs */}
                <g stroke="#1e3a47" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    {/* Hips / Pelvis Bar */}
                    <path d="M 80 148 L 120 148" stroke="#38bdf8" strokeWidth="2.5" />
                    {/* Left Leg */}
                    <path d="M 82 148 L 82 190 L 80 230" />
                    {/* Right Leg */}
                    <path d="M 118 148 L 118 190 L 120 230" />
                </g>

                {/* Torso & Spine Cage */}
                <path
                    d="M 72 76 L 128 76 L 120 148 L 80 148 Z"
                    fill="url(#torso-cage-glow)"
                    stroke="rgba(0, 240, 255, 0.4)"
                    strokeWidth="1.5"
                />

                {/* Spine Center Axis */}
                <line x1="100" y1="56" x2="100" y2="148" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.5" strokeDasharray="3 3" />

                {/* Head & Neck */}
                <g className="avatar-head">
                    <line x1="100" y1="56" x2="100" y2="68" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                    {/* Head Pod */}
                    <circle cx="100" cy="36" r="18" fill="url(#body-gradient)" stroke="#00F0FF" strokeWidth="2" filter="url(#neon-glow)" />
                    {/* Biometric Visor / Eyes */}
                    <path d="M 91 35 Q 100 32 109 35" stroke="#00FF9D" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    {/* Nose Target Marker */}
                    <circle cx="100" cy="38" r="2" fill="#FFFFFF" />
                </g>

                {/* Chest Central Reactor Core */}
                <g className="avatar-chest-core">
                    <polygon
                        points="100,74 108,84 100,94 92,84"
                        fill="rgba(0, 240, 255, 0.35)"
                        stroke="#00F0FF"
                        strokeWidth="1.8"
                        filter="url(#neon-glow)"
                    />
                    <circle cx="100" cy="84" r="3" fill="#FFFFFF" />
                </g>

                {/* Left Arm Articulation Group (Rotates around left shoulder: 72, 76) */}
                <g
                    id="avatar-left-arm"
                    className={`arm-group ${leftArmAnimationClass}`}
                    style={{
                        transformOrigin: "72px 76px",
                        animationDuration: `${animationDuration}s`,
                    }}
                >
                    {/* Upper Arm Bone */}
                    <line x1="72" y1="76" x2="52" y2="118" stroke={isLeftArmActive ? "#00F0FF" : "#38bdf8"} strokeWidth="4" strokeLinecap="round" />
                    <line x1="72" y1="76" x2="52" y2="118" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />

                    {/* Elbow Joint */}
                    <circle cx="52" cy="118" r="4.5" fill="rgba(0, 255, 157, 0.4)" stroke={isLeftArmActive ? "#00FF9D" : "#38bdf8"} strokeWidth="1.8" />
                    <circle cx="52" cy="118" r="1.8" fill="#FFFFFF" />

                    {/* Forearm Bone */}
                    <line x1="52" y1="118" x2="48" y2="160" stroke={isLeftArmActive ? "#00F0FF" : "#38bdf8"} strokeWidth="3.2" strokeLinecap="round" />
                    <line x1="52" y1="118" x2="48" y2="160" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />

                    {/* Wrist & Hand Node */}
                    <circle cx="48" cy="160" r="3.5" fill="#00F0FF" stroke="#FFFFFF" strokeWidth="1" />
                </g>

                {/* Right Arm Articulation Group (Rotates around right shoulder: 128, 76) */}
                <g
                    id="avatar-right-arm"
                    className={`arm-group ${rightArmAnimationClass}`}
                    style={{
                        transformOrigin: "128px 76px",
                        animationDuration: `${animationDuration}s`,
                    }}
                >
                    {/* Upper Arm Bone */}
                    <line x1="128" y1="76" x2="148" y2="118" stroke={isRightArmActive ? "#00F0FF" : "#38bdf8"} strokeWidth="4" strokeLinecap="round" />
                    <line x1="128" y1="76" x2="148" y2="118" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />

                    {/* Elbow Joint */}
                    <circle cx="148" cy="118" r="4.5" fill="rgba(0, 255, 157, 0.4)" stroke={isRightArmActive ? "#00FF9D" : "#38bdf8"} strokeWidth="1.8" />
                    <circle cx="148" cy="118" r="1.8" fill="#FFFFFF" />

                    {/* Forearm Bone */}
                    <line x1="148" y1="118" x2="152" y2="160" stroke={isRightArmActive ? "#00F0FF" : "#38bdf8"} strokeWidth="3.2" strokeLinecap="round" />
                    <line x1="148" y1="118" x2="152" y2="160" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />

                    {/* Wrist & Hand Node */}
                    <circle cx="152" cy="160" r="3.5" fill="#00F0FF" stroke="#FFFFFF" strokeWidth="1" />
                </g>

                {/* Fixed Shoulder Joints (Drawn over arms) */}
                <circle cx="72" cy="76" r="5.5" fill="rgba(0, 240, 255, 0.4)" stroke={isLeftArmActive ? "#00F0FF" : "#38bdf8"} strokeWidth="2" />
                <circle cx="72" cy="76" r="2" fill="#FFFFFF" />

                <circle cx="128" cy="76" r="5.5" fill="rgba(0, 240, 255, 0.4)" stroke={isRightArmActive ? "#00F0FF" : "#38bdf8"} strokeWidth="2" />
                <circle cx="128" cy="76" r="2" fill="#FFFFFF" />
            </svg>

            {/* Bottom Movement Telemetry Bar */}
            <div className="animated-exercise-footer">
                <div className="exercise-phase-badge">
                    <Activity size={12} className="text-cyan-400" />
                    <span>{cyclePhase}</span>
                </div>
                <div className="exercise-angle-badge">
                    <span>{currentAngle}°</span>
                </div>
            </div>
        </div>
    );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";

interface AnimatedExerciseGuideProps {
    exerciseName: string;
    selectedSide?: "left" | "right" | null;
    analysisModelKey?: string | null;
    isRecording?: boolean;
    speed?: number; // 0.75, 1.0, 1.25
}

type MovementType = "side_arms_raise" | "left_flexion" | "right_flexion" | "left_abduction" | "right_abduction";

interface ArmKinematics {
    shoulder: { x: number; y: number };
    elbow: { x: number; y: number };
    wrist: { x: number; y: number };
}

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
    speed = 1.0,
}: AnimatedExerciseGuideProps) {
    const movement = resolveMovementType(exerciseName, selectedSide, analysisModelKey);
    const animationDuration = 4.0 / Math.max(0.5, speed); // full cycle in seconds

    const [currentAngle, setCurrentAngle] = useState(0);
    const [cyclePhase, setCyclePhase] = useState<"Raising Up" | "Hold Peak" | "Lowering" | "Rest">("Raising Up");

    // Kinematic joint coordinates (updated at 60fps)
    const [leftArm, setLeftArm] = useState<ArmKinematics>({
        shoulder: { x: 72, y: 76 },
        elbow: { x: 72, y: 120 },
        wrist: { x: 72, y: 164 },
    });

    const [rightArm, setRightArm] = useState<ArmKinematics>({
        shoulder: { x: 128, y: 76 },
        elbow: { x: 128, y: 120 },
        wrist: { x: 128, y: 164 },
    });

    useEffect(() => {
        let frameId: number;
        const startTime = performance.now();

        const SHOULDER_L = { x: 72, y: 76 };
        const SHOULDER_R = { x: 128, y: 76 };
        const UPPER_ARM_LEN = 44;
        const FOREARM_LEN = 44;
        const TOTAL_LEN = UPPER_ARM_LEN + FOREARM_LEN;

        let maxAngle = 90;
        if (movement.includes("abduction")) maxAngle = 145;
        if (movement.includes("flexion")) maxAngle = 160;

        const isLeftActive =
            movement === "side_arms_raise" || movement === "left_flexion" || movement === "left_abduction";
        const isRightActive =
            movement === "side_arms_raise" || movement === "right_flexion" || movement === "right_abduction";
        const isFlexion = movement.includes("flexion");

        const updateKinematics = () => {
            const now = performance.now();
            const elapsed = ((now - startTime) / 1000) % animationDuration;
            const progress = elapsed / animationDuration; // 0.0 to 1.0

            let angle = 0;
            let phase: "Raising Up" | "Hold Peak" | "Lowering" | "Rest" = "Rest";

            if (progress < 0.40) {
                // Phase 1: Concentric Raise (0% to 40%) - smooth ease in/out
                phase = "Raising Up";
                const p = progress / 0.40;
                const smoothP = 0.5 - 0.5 * Math.cos(p * Math.PI);
                angle = Math.round(smoothP * maxAngle);
            } else if (progress < 0.52) {
                // Phase 2: Peak Hold (40% to 52%)
                phase = "Hold Peak";
                angle = maxAngle;
            } else if (progress < 0.92) {
                // Phase 3: Eccentric Lowering (52% to 92%) - controlled return
                phase = "Lowering";
                const p = (progress - 0.52) / 0.40;
                const smoothP = 0.5 + 0.5 * Math.cos(p * Math.PI);
                angle = Math.round(smoothP * maxAngle);
            } else {
                // Phase 4: Rest pause (92% to 100%)
                phase = "Rest";
                angle = 0;
            }

            setCurrentAngle(angle);
            setCyclePhase(phase);

            const rad = (angle * Math.PI) / 180;

            // --- Left Arm Kinematics ---
            if (isLeftActive) {
                let ux: number;
                let uy: number;

                if (isFlexion) {
                    // Forward sagittal raise: raises upward with slight depth inward vector
                    ux = -0.32 * Math.sin(rad);
                    uy = Math.cos(rad);
                } else {
                    // Coronal lateral raise (Abduction / Side Arms Raise):
                    // In screen coords (+y is down, +x is right):
                    // Left arm raises outward to the LEFT (-x, -y as angle goes from 0° down to 180° up)
                    ux = -Math.sin(rad);
                    uy = Math.cos(rad);
                }

                setLeftArm({
                    shoulder: SHOULDER_L,
                    elbow: {
                        x: Math.round((SHOULDER_L.x + UPPER_ARM_LEN * ux) * 10) / 10,
                        y: Math.round((SHOULDER_L.y + UPPER_ARM_LEN * uy) * 10) / 10,
                    },
                    wrist: {
                        x: Math.round((SHOULDER_L.x + TOTAL_LEN * ux) * 10) / 10,
                        y: Math.round((SHOULDER_L.y + TOTAL_LEN * uy) * 10) / 10,
                    },
                });
            } else {
                // Resting down at side
                setLeftArm({
                    shoulder: SHOULDER_L,
                    elbow: { x: SHOULDER_L.x, y: SHOULDER_L.y + UPPER_ARM_LEN },
                    wrist: { x: SHOULDER_L.x, y: SHOULDER_L.y + TOTAL_LEN },
                });
            }

            // --- Right Arm Kinematics ---
            if (isRightActive) {
                let ux: number;
                let uy: number;

                if (isFlexion) {
                    ux = 0.32 * Math.sin(rad);
                    uy = Math.cos(rad);
                } else {
                    // Right arm raises outward to the RIGHT (+x, -y as angle goes from 0° down to 180° up)
                    ux = Math.sin(rad);
                    uy = Math.cos(rad);
                }

                setRightArm({
                    shoulder: SHOULDER_R,
                    elbow: {
                        x: Math.round((SHOULDER_R.x + UPPER_ARM_LEN * ux) * 10) / 10,
                        y: Math.round((SHOULDER_R.y + UPPER_ARM_LEN * uy) * 10) / 10,
                    },
                    wrist: {
                        x: Math.round((SHOULDER_R.x + TOTAL_LEN * ux) * 10) / 10,
                        y: Math.round((SHOULDER_R.y + TOTAL_LEN * uy) * 10) / 10,
                    },
                });
            } else {
                // Resting down at side
                setRightArm({
                    shoulder: SHOULDER_R,
                    elbow: { x: SHOULDER_R.x, y: SHOULDER_R.y + UPPER_ARM_LEN },
                    wrist: { x: SHOULDER_R.x, y: SHOULDER_R.y + TOTAL_LEN },
                });
            }

            frameId = requestAnimationFrame(updateKinematics);
        };

        frameId = requestAnimationFrame(updateKinematics);
        return () => cancelAnimationFrame(frameId);
    }, [animationDuration, movement]);

    const isLeftActive =
        movement === "side_arms_raise" || movement === "left_flexion" || movement === "left_abduction";
    const isRightActive =
        movement === "side_arms_raise" || movement === "right_flexion" || movement === "right_abduction";

    return (
        <div className="animated-exercise-container">
            {/* SVG Anatomical Avatar with Exact Kinematic Positions */}
            <svg
                viewBox="0 0 200 240"
                className="animated-exercise-svg"
                role="img"
                aria-label={`Animated exercise demonstration for ${exerciseName}`}
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

                {/* Left Arm Motion Trajectory Arc Guide */}
                {isLeftActive && (
                    <path
                        d={`M 72 164 A 88 88 0 0 0 ${leftArm.wrist.x} ${leftArm.wrist.y}`}
                        fill="none"
                        stroke="rgba(0, 240, 255, 0.28)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                    />
                )}

                {/* Right Arm Motion Trajectory Arc Guide */}
                {isRightActive && (
                    <path
                        d={`M 128 164 A 88 88 0 0 1 ${rightArm.wrist.x} ${rightArm.wrist.y}`}
                        fill="none"
                        stroke="rgba(0, 240, 255, 0.28)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                    />
                )}

                {/* Pelvis & Lower Body Frame */}
                <g stroke="#1e3a47" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    <path d="M 80 148 L 120 148" stroke="#38bdf8" strokeWidth="2.5" />
                    <path d="M 82 148 L 82 190 L 80 230" />
                    <path d="M 118 148 L 118 190 L 120 230" />
                </g>

                {/* Torso Cage */}
                <path
                    d="M 72 76 L 128 76 L 120 148 L 80 148 Z"
                    fill="url(#torso-cage-glow)"
                    stroke="rgba(0, 240, 255, 0.4)"
                    strokeWidth="1.5"
                />

                {/* Spine Axis */}
                <line
                    x1="100"
                    y1="56"
                    x2="100"
                    y2="148"
                    stroke="rgba(0, 240, 255, 0.6)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                />

                {/* Head & Neck */}
                <g className="avatar-head">
                    <line x1="100" y1="56" x2="100" y2="68" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                    <circle
                        cx="100"
                        cy="36"
                        r="18"
                        fill="url(#body-gradient)"
                        stroke="#00F0FF"
                        strokeWidth="2"
                        filter="url(#neon-glow)"
                    />
                    <path d="M 91 35 Q 100 32 109 35" stroke="#00FF9D" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <circle cx="100" cy="38" r="2" fill="#FFFFFF" />
                </g>

                {/* Chest Central Core */}
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

                {/* --- Left Arm Kinetic Chain: Shoulder -> Elbow -> Wrist --- */}
                <g id="avatar-left-arm">
                    {/* Upper Arm Bone (Shoulder -> Elbow) */}
                    <line
                        x1={leftArm.shoulder.x}
                        y1={leftArm.shoulder.y}
                        x2={leftArm.elbow.x}
                        y2={leftArm.elbow.y}
                        stroke={isLeftActive ? "#00F0FF" : "#38bdf8"}
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <line
                        x1={leftArm.shoulder.x}
                        y1={leftArm.shoulder.y}
                        x2={leftArm.elbow.x}
                        y2={leftArm.elbow.y}
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                    />

                    {/* Forearm Bone (Elbow -> Wrist) */}
                    <line
                        x1={leftArm.elbow.x}
                        y1={leftArm.elbow.y}
                        x2={leftArm.wrist.x}
                        y2={leftArm.wrist.y}
                        stroke={isLeftActive ? "#00F0FF" : "#38bdf8"}
                        strokeWidth="3.2"
                        strokeLinecap="round"
                    />
                    <line
                        x1={leftArm.elbow.x}
                        y1={leftArm.elbow.y}
                        x2={leftArm.wrist.x}
                        y2={leftArm.wrist.y}
                        stroke="#FFFFFF"
                        strokeWidth="1"
                        strokeLinecap="round"
                    />

                    {/* Elbow Joint Node (strictly between shoulder and wrist) */}
                    <circle
                        cx={leftArm.elbow.x}
                        cy={leftArm.elbow.y}
                        r="4.5"
                        fill="rgba(0, 255, 157, 0.4)"
                        stroke={isLeftActive ? "#00FF9D" : "#38bdf8"}
                        strokeWidth="1.8"
                    />
                    <circle cx={leftArm.elbow.x} cy={leftArm.elbow.y} r="1.8" fill="#FFFFFF" />

                    {/* Wrist End-Effector */}
                    <circle
                        cx={leftArm.wrist.x}
                        cy={leftArm.wrist.y}
                        r="3.5"
                        fill="#00F0FF"
                        stroke="#FFFFFF"
                        strokeWidth="1"
                    />
                </g>

                {/* --- Right Arm Kinetic Chain: Shoulder -> Elbow -> Wrist --- */}
                <g id="avatar-right-arm">
                    {/* Upper Arm Bone (Shoulder -> Elbow) */}
                    <line
                        x1={rightArm.shoulder.x}
                        y1={rightArm.shoulder.y}
                        x2={rightArm.elbow.x}
                        y2={rightArm.elbow.y}
                        stroke={isRightActive ? "#00F0FF" : "#38bdf8"}
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <line
                        x1={rightArm.shoulder.x}
                        y1={rightArm.shoulder.y}
                        x2={rightArm.elbow.x}
                        y2={rightArm.elbow.y}
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                    />

                    {/* Forearm Bone (Elbow -> Wrist) */}
                    <line
                        x1={rightArm.elbow.x}
                        y1={rightArm.elbow.y}
                        x2={rightArm.wrist.x}
                        y2={rightArm.wrist.y}
                        stroke={isRightActive ? "#00F0FF" : "#38bdf8"}
                        strokeWidth="3.2"
                        strokeLinecap="round"
                    />
                    <line
                        x1={rightArm.elbow.x}
                        y1={rightArm.elbow.y}
                        x2={rightArm.wrist.x}
                        y2={rightArm.wrist.y}
                        stroke="#FFFFFF"
                        strokeWidth="1"
                        strokeLinecap="round"
                    />

                    {/* Elbow Joint Node (strictly between shoulder and wrist) */}
                    <circle
                        cx={rightArm.elbow.x}
                        cy={rightArm.elbow.y}
                        r="4.5"
                        fill="rgba(0, 255, 157, 0.4)"
                        stroke={isRightActive ? "#00FF9D" : "#38bdf8"}
                        strokeWidth="1.8"
                    />
                    <circle cx={rightArm.elbow.x} cy={rightArm.elbow.y} r="1.8" fill="#FFFFFF" />

                    {/* Wrist End-Effector */}
                    <circle
                        cx={rightArm.wrist.x}
                        cy={rightArm.wrist.y}
                        r="3.5"
                        fill="#00F0FF"
                        stroke="#FFFFFF"
                        strokeWidth="1"
                    />
                </g>

                {/* Shoulder Articulation Pods (Anchored on torso) */}
                <circle
                    cx={leftArm.shoulder.x}
                    cy={leftArm.shoulder.y}
                    r="5.5"
                    fill="rgba(0, 240, 255, 0.4)"
                    stroke={isLeftActive ? "#00F0FF" : "#38bdf8"}
                    strokeWidth="2"
                />
                <circle cx={leftArm.shoulder.x} cy={leftArm.shoulder.y} r="2" fill="#FFFFFF" />

                <circle
                    cx={rightArm.shoulder.x}
                    cy={rightArm.shoulder.y}
                    r="5.5"
                    fill="rgba(0, 240, 255, 0.4)"
                    stroke={isRightActive ? "#00F0FF" : "#38bdf8"}
                    strokeWidth="2"
                />
                <circle cx={rightArm.shoulder.x} cy={rightArm.shoulder.y} r="2" fill="#FFFFFF" />
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

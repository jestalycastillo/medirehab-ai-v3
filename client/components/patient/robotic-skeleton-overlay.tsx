"use client";

import React, { useEffect, useRef } from "react";
import type { PoseLandmarkKey, PoseLandmarkMap, PosePoint } from "@/lib/pose/pose-landmarker.types";

interface RoboticSkeletonOverlayProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    landmarks: PoseLandmarkMap | null;
    selectedSide?: "left" | "right" | null;
    exerciseName?: string;
    enabled?: boolean;
    hasReliablePose?: boolean;
}

interface Point2D {
    x: number;
    y: number;
    vis: number;
}

// Bone connections defining the robotic mechanical frame
const MECHANICAL_BONES: Array<[PoseLandmarkKey, PoseLandmarkKey, "primary" | "secondary" | "spine"]> = [
    // Upper body / head
    ["chest", "nose", "spine"],
    ["leftShoulder", "rightShoulder", "secondary"],
    ["chest", "leftShoulder", "secondary"],
    ["chest", "rightShoulder", "secondary"],

    // Left arm
    ["leftShoulder", "leftElbow", "primary"],
    ["leftElbow", "leftWrist", "primary"],

    // Right arm
    ["rightShoulder", "rightElbow", "primary"],
    ["rightElbow", "rightWrist", "primary"],

    // Torso / pelvis
    ["chest", "leftHip", "spine"],
    ["chest", "rightHip", "spine"],
    ["leftHip", "rightHip", "secondary"],

    // Legs (if visible)
    ["leftHip", "leftKnee", "secondary"],
    ["leftKnee", "leftAnkle", "secondary"],
    ["rightHip", "rightKnee", "secondary"],
    ["rightKnee", "rightAnkle", "secondary"],
];

function calculateAngleDeg(a: Point2D, b: Point2D, c: Point2D): number {
    const ab = { x: a.x - b.x, y: a.y - b.y };
    const cb = { x: c.x - b.x, y: c.y - b.y };
    const dot = ab.x * cb.x + ab.y * cb.y;
    const magAB = Math.hypot(ab.x, ab.y);
    const magCB = Math.hypot(cb.x, cb.y);
    if (magAB === 0 || magCB === 0) return 0;
    const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
    return Math.round((Math.acos(cosAngle) * 180) / Math.PI);
}

export function RoboticSkeletonOverlay({
    videoRef,
    landmarks,
    selectedSide,
    exerciseName = "",
    enabled = true,
    hasReliablePose = true,
}: RoboticSkeletonOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const smoothedLandmarksRef = useRef<Partial<Record<PoseLandmarkKey, Point2D>>>({});
    const pulseOffsetRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);

    useEffect(() => {
        if (!enabled) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext("2d");
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
            return;
        }

        const render = () => {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (!canvas || !video) {
                animationFrameRef.current = requestAnimationFrame(render);
                return;
            }

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                animationFrameRef.current = requestAnimationFrame(render);
                return;
            }

            const rect = video.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = Math.round(rect.width);
            const displayHeight = Math.round(rect.height);

            if (displayWidth <= 0 || displayHeight <= 0) {
                animationFrameRef.current = requestAnimationFrame(render);
                return;
            }

            if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
                canvas.width = displayWidth * dpr;
                canvas.height = displayHeight * dpr;
            }

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, displayWidth, displayHeight);

            // Calculate exact object-fit: contain sub-rectangle for the video
            const videoWidth = video.videoWidth || displayWidth;
            const videoHeight = video.videoHeight || displayHeight;
            const videoAspect = videoWidth / videoHeight;
            const containerAspect = displayWidth / displayHeight;

            let renderWidth = displayWidth;
            let renderHeight = displayHeight;
            let offsetX = 0;
            let offsetY = 0;

            if (containerAspect > videoAspect) {
                renderWidth = displayHeight * videoAspect;
                offsetX = (displayWidth - renderWidth) / 2;
            } else {
                renderHeight = displayWidth / videoAspect;
                offsetY = (displayHeight - renderHeight) / 2;
            }

            // Smoothly interpolate landmark positions (lerping for 60fps fluid tracking)
            const currentPoints: Partial<Record<PoseLandmarkKey, Point2D>> = {};
            const keys: PoseLandmarkKey[] = [
                "nose",
                "chest",
                "leftShoulder",
                "rightShoulder",
                "leftElbow",
                "rightElbow",
                "leftWrist",
                "rightWrist",
                "leftHip",
                "rightHip",
                "leftKnee",
                "rightKnee",
                "leftAnkle",
                "rightAnkle",
            ];

            const LERP_FACTOR = 0.42;

            for (const key of keys) {
                const pt: PosePoint | undefined = landmarks?.[key];
                const prev = smoothedLandmarksRef.current[key];
                if (pt && (pt.visibility === undefined || pt.visibility >= 0.4)) {
                    const targetX = offsetX + pt.x * renderWidth;
                    const targetY = offsetY + pt.y * renderHeight;
                    const targetVis = pt.visibility ?? 1.0;

                    if (prev) {
                        currentPoints[key] = {
                            x: prev.x + (targetX - prev.x) * LERP_FACTOR,
                            y: prev.y + (targetY - prev.y) * LERP_FACTOR,
                            vis: prev.vis + (targetVis - prev.vis) * LERP_FACTOR,
                        };
                    } else {
                        currentPoints[key] = { x: targetX, y: targetY, vis: targetVis };
                    }
                } else if (prev && prev.vis > 0.05) {
                    // Smoothly fade out lost points
                    currentPoints[key] = {
                        x: prev.x,
                        y: prev.y,
                        vis: prev.vis * 0.75,
                    };
                }
            }

            smoothedLandmarksRef.current = currentPoints;

            // Increment pulse animation offset
            pulseOffsetRef.current = (pulseOffsetRef.current + 0.02) % 1;
            const pulse = pulseOffsetRef.current;

            // Draw Torso Cyber-Hologram Polygon if chest and shoulders are available
            const chest = currentPoints.chest;
            const ls = currentPoints.leftShoulder;
            const rs = currentPoints.rightShoulder;
            const lh = currentPoints.leftHip;
            const rh = currentPoints.rightHip;

            if (chest && ls && rs && chest.vis > 0.5 && ls.vis > 0.5 && rs.vis > 0.5) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(ls.x, ls.y);
                ctx.lineTo(rs.x, rs.y);
                if (rh && rh.vis > 0.4 && lh && lh.vis > 0.4) {
                    ctx.lineTo(rh.x, rh.y);
                    ctx.lineTo(lh.x, lh.y);
                } else {
                    ctx.lineTo(chest.x + (rs.x - ls.x) * 0.15, chest.y + 40);
                    ctx.lineTo(chest.x - (rs.x - ls.x) * 0.15, chest.y + 40);
                }
                ctx.closePath();
                const torsoGrad = ctx.createLinearGradient(
                    chest.x,
                    (ls.y + rs.y) / 2,
                    chest.x,
                    chest.y + 60,
                );
                torsoGrad.addColorStop(0, "rgba(0, 240, 255, 0.09)");
                torsoGrad.addColorStop(1, "rgba(0, 255, 157, 0.02)");
                ctx.fillStyle = torsoGrad;
                ctx.fill();
                ctx.restore();
            }

            // Draw Systematic Mechanical Bones / Rail Linkages
            for (const [keyA, keyB, boneType] of MECHANICAL_BONES) {
                const ptA = currentPoints[keyA];
                const ptB = currentPoints[keyB];
                if (!ptA || !ptB || ptA.vis < 0.45 || ptB.vis < 0.45) continue;

                const isLeftArm = (keyA.includes("left") && keyB.includes("left")) || (keyA === "chest" && keyB === "leftShoulder");
                const isRightArm = (keyA.includes("right") && keyB.includes("right")) || (keyA === "chest" && keyB === "rightShoulder");
                const isActiveArm =
                    (selectedSide === "left" && isLeftArm) ||
                    (selectedSide === "right" && isRightArm) ||
                    (!selectedSide && (isLeftArm || isRightArm));

                const boneVis = Math.min(ptA.vis, ptB.vis);

                // Determine systematic colors
                let glowColor = isActiveArm ? "rgba(0, 240, 255, 0.45)" : "rgba(56, 189, 248, 0.25)";
                let primaryColor = isActiveArm ? "#00F0FF" : "#38BDF8";
                let coreColor = "#FFFFFF";

                if (!hasReliablePose) {
                    glowColor = "rgba(234, 179, 8, 0.35)";
                    primaryColor = "#FACC15";
                }

                ctx.save();
                ctx.globalAlpha = boneVis;

                // 1. Outer Cybernetic Glow Rail
                ctx.beginPath();
                ctx.moveTo(ptA.x, ptA.y);
                ctx.lineTo(ptB.x, ptB.y);
                ctx.strokeStyle = glowColor;
                ctx.lineWidth = isActiveArm ? 6 : 4;
                ctx.lineCap = "round";
                ctx.shadowColor = primaryColor;
                ctx.shadowBlur = isActiveArm ? 12 : 6;
                ctx.stroke();

                // 2. Precision Structural Strut Line
                ctx.beginPath();
                ctx.moveTo(ptA.x, ptA.y);
                ctx.lineTo(ptB.x, ptB.y);
                ctx.strokeStyle = primaryColor;
                ctx.lineWidth = isActiveArm ? 2.5 : 1.8;
                ctx.lineCap = "round";
                ctx.stroke();

                // 3. Ultra-Bright Plasma Core
                ctx.beginPath();
                ctx.moveTo(ptA.x, ptA.y);
                ctx.lineTo(ptB.x, ptB.y);
                ctx.strokeStyle = coreColor;
                ctx.lineWidth = 0.9;
                ctx.lineCap = "round";
                ctx.stroke();

                // 4. Perpendicular Mechanical Hash / Rail Ticks (at 33% & 66%)
                const dx = ptB.x - ptA.x;
                const dy = ptB.y - ptA.y;
                const len = Math.hypot(dx, dy);
                if (len > 30) {
                    const normX = -dy / len;
                    const normY = dx / len;
                    const tickSize = isActiveArm ? 4.5 : 3.0;

                    for (const fraction of [0.33, 0.66]) {
                        const midX = ptA.x + dx * fraction;
                        const midY = ptA.y + dy * fraction;

                        ctx.beginPath();
                        ctx.moveTo(midX - normX * tickSize, midY - normY * tickSize);
                        ctx.lineTo(midX + normX * tickSize, midY + normY * tickSize);
                        ctx.strokeStyle = primaryColor;
                        ctx.lineWidth = 1.6;
                        ctx.stroke();
                    }

                    // 5. Kinetic Energy Pulse Packet on Active Arm
                    if (isActiveArm && boneType === "primary") {
                        const pulseFrac = (pulse + (keyA.includes("Elbow") ? 0.4 : 0.0)) % 1;
                        const pX = ptA.x + dx * pulseFrac;
                        const pY = ptA.y + dy * pulseFrac;

                        ctx.beginPath();
                        ctx.arc(pX, pY, 2.5, 0, Math.PI * 2);
                        ctx.fillStyle = "#FFFFFF";
                        ctx.shadowColor = "#00FF9D";
                        ctx.shadowBlur = 10;
                        ctx.fill();
                    }
                }

                ctx.restore();
            }

            // Draw Systematic Robotic Joint Nodes
            for (const key of keys) {
                const pt = currentPoints[key];
                if (!pt || pt.vis < 0.45) continue;

                const isLeft = key.includes("left");
                const isRight = key.includes("right");
                const isActive =
                    (selectedSide === "left" && isLeft) ||
                    (selectedSide === "right" && isRight) ||
                    (!selectedSide && (isLeft || isRight));

                ctx.save();
                ctx.globalAlpha = Math.min(1.0, pt.vis * 1.2);

                if (key === "chest") {
                    // Central Hexagonal Cyber-Core Reactor
                    drawChestReactorNode(ctx, pt.x, pt.y, pulse);
                } else if (key === "nose") {
                    // Biometric Head Orientation Reticle
                    drawHeadReticleNode(ctx, pt.x, pt.y);
                } else if (key.includes("Shoulder")) {
                    // Primary Articulation Shoulder Pod
                    drawShoulderPodNode(ctx, pt.x, pt.y, isActive, pulse);
                } else if (key.includes("Elbow")) {
                    // Rotary Elbow Joint with Live Angle Readout
                    const shoulderPt = isLeft ? currentPoints.leftShoulder : currentPoints.rightShoulder;
                    const wristPt = isLeft ? currentPoints.leftWrist : currentPoints.rightWrist;
                    let angleDeg = 0;
                    if (shoulderPt && wristPt && shoulderPt.vis > 0.4 && wristPt.vis > 0.4) {
                        angleDeg = calculateAngleDeg(shoulderPt, pt, wristPt);
                    }
                    drawElbowJointNode(ctx, pt.x, pt.y, isActive, angleDeg, isLeft);
                } else if (key.includes("Wrist")) {
                    // Wrist End-Effector Node
                    drawWristNode(ctx, pt.x, pt.y, isActive);
                } else {
                    // Lower body kinetic node
                    drawGenericKineticNode(ctx, pt.x, pt.y);
                }

                ctx.restore();
            }

            ctx.restore();
            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [enabled, exerciseName, hasReliablePose, landmarks, selectedSide, videoRef]);

    if (!enabled) return null;

    return (
        <canvas
            ref={canvasRef}
            className="robotic-skeleton-canvas"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                transform: "scaleX(-1)", // Exactly mirrors video element
                zIndex: 8,
            }}
        />
    );
}

// -----------------------------------------------------------------------------
// Robotic Node Rendering Helpers (Systematic High-Tech HUD Style)
// -----------------------------------------------------------------------------

function drawChestReactorNode(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number) {
    const size = 11;

    ctx.save();
    ctx.translate(x, y);

    // Outer cyber-bracket ticks
    ctx.strokeStyle = "rgba(0, 240, 255, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size + 5, -0.4, 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size + 5, Math.PI - 0.4, Math.PI + 0.4);
    ctx.stroke();

    // Hexagonal Diamond Core
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const hx = Math.cos(angle) * size;
        const hy = Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 240, 255, 0.22)";
    ctx.fill();
    ctx.strokeStyle = "#00F0FF";
    ctx.lineWidth = 2.0;
    ctx.shadowColor = "#00F0FF";
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Central Core Pulse Dot
    const coreRad = 3.5 + Math.sin(pulse * Math.PI * 2) * 1.0;
    ctx.beginPath();
    ctx.arc(0, 0, coreRad, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#00FF9D";
    ctx.shadowBlur = 12;
    ctx.fill();

    // Telemetry label
    ctx.save();
    ctx.scale(-1, 1); // un-mirror text so it reads left-to-right
    ctx.font = "bold 8px ui-monospace, 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(0, 240, 255, 0.85)";
    ctx.fillText("CORE", -12, size + 14);
    ctx.restore();

    ctx.restore();
}

function drawHeadReticleNode(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const r = 9;

    ctx.save();
    ctx.translate(x, y);

    // Target Ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 240, 255, 0.65)";
    ctx.lineWidth = 1.4;
    ctx.shadowColor = "#00F0FF";
    ctx.shadowBlur = 6;
    ctx.stroke();

    // 4 Cardinal Precision Crosshairs
    ctx.strokeStyle = "#00F0FF";
    ctx.lineWidth = 1.5;
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(cos * (r - 3), sin * (r - 3));
        ctx.lineTo(cos * (r + 4), sin * (r + 4));
        ctx.stroke();
    }

    // Center focal point
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.restore();
}

function drawShoulderPodNode(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isActive: boolean,
    pulse: number,
) {
    const r = isActive ? 8.5 : 6.5;
    const color = isActive ? "#00F0FF" : "#38BDF8";

    ctx.save();
    ctx.translate(x, y);

    // Outer Orbital Tick Brackets
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = color;
    ctx.shadowBlur = isActive ? 8 : 4;

    const rot = pulse * Math.PI;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3.5, rot, rot + 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r + 3.5, rot + Math.PI, rot + Math.PI + 0.9);
    ctx.stroke();

    // Inner Solid Bearing Ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? "rgba(0, 240, 255, 0.28)" : "rgba(56, 189, 248, 0.15)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Center Core Node
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.restore();
}

function drawElbowJointNode(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isActive: boolean,
    angleDeg: number,
    isLeft: boolean,
) {
    const r = isActive ? 7.5 : 5.5;
    const color = isActive ? "#00FF9D" : "#38BDF8";

    ctx.save();
    ctx.translate(x, y);

    // Precision Rotary Joint Ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? "rgba(0, 255, 157, 0.25)" : "rgba(56, 189, 248, 0.15)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = isActive ? 8 : 4;
    ctx.stroke();

    // Center Core
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // Live Angle Telemetry Readout (displayed next to active elbow)
    if (isActive && angleDeg > 0) {
        ctx.save();
        ctx.scale(-1, 1); // Un-mirror text

        const text = `${angleDeg}°`;
        const textX = isLeft ? 14 : -38;
        const textY = -12;

        // HUD badge background
        ctx.fillStyle = "rgba(3, 15, 14, 0.85)";
        ctx.strokeStyle = "rgba(0, 255, 157, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(textX - 4, textY - 11, 36, 16, 4);
        ctx.fill();
        ctx.stroke();

        // HUD text
        ctx.font = "bold 10px ui-monospace, 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00FF9D";
        ctx.fillText(text, textX, textY);
        ctx.restore();
    }

    ctx.restore();
}

function drawWristNode(ctx: CanvasRenderingContext2D, x: number, y: number, isActive: boolean) {
    const size = isActive ? 5.5 : 4.5;
    const color = isActive ? "#00F0FF" : "#38BDF8";

    ctx.save();
    ctx.translate(x, y);

    // Diamond end-effector
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
    ctx.fillStyle = isActive ? "rgba(0, 240, 255, 0.3)" : "rgba(56, 189, 248, 0.2)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.restore();
}

function drawGenericKineticNode(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56, 189, 248, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.restore();
}

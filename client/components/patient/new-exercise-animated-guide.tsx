"use client";

import { useEffect, useMemo, useState } from "react";

type Side = "left" | "right";

interface Props {
    exerciseName: string;
    selectedSide?: Side | null;
    analysisModelKey?: string | null;
    isCountingDown?: boolean;
    speed?: number;
}

interface Point {
    x: number;
    y: number;
}

interface Arm {
    shoulder: Point;
    elbow: Point;
    wrist: Point;
}

const SHOULDER = {
    left: { x: 72, y: 76 },
    right: { x: 128, y: 76 },
};
const UPPER_ARM = 44;
const FOREARM = 44;

function restArm(side: Side): Arm {
    const shoulder = SHOULDER[side];
    return {
        shoulder,
        elbow: { x: shoulder.x, y: shoulder.y + UPPER_ARM },
        wrist: { x: shoulder.x, y: shoulder.y + UPPER_ARM + FOREARM },
    };
}

function straightArm(side: Side, radians: number): Arm {
    const shoulder = SHOULDER[side];
    const x = Math.cos(radians);
    const y = Math.sin(radians);
    return {
        shoulder,
        elbow: { x: shoulder.x + UPPER_ARM * x, y: shoulder.y + UPPER_ARM * y },
        wrist: { x: shoulder.x + (UPPER_ARM + FOREARM) * x, y: shoulder.y + (UPPER_ARM + FOREARM) * y },
    };
}

function rotationArm(side: Side, forearmRadians: number): Arm {
    const outward = side === "left" ? -1 : 1;
    const shoulder = SHOULDER[side];
    const elbow = { x: shoulder.x + outward * UPPER_ARM, y: shoulder.y };
    return {
        shoulder,
        elbow,
        wrist: { x: elbow.x + FOREARM * Math.cos(forearmRadians), y: elbow.y + FOREARM * Math.sin(forearmRadians) },
    };
}

function interpolate(from: Arm, to: Arm, amount: number): Arm {
    const point = (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount });
    return { shoulder: from.shoulder, elbow: point(from.elbow, to.elbow), wrist: point(from.wrist, to.wrist) };
}

function movementKey(exerciseName: string, modelKey?: string | null): string {
    return (modelKey || exerciseName).trim().toLowerCase().replaceAll(/[-\s]+/g, "_");
}

export function NewExerciseAnimatedGuide({
    exerciseName,
    selectedSide = "left",
    analysisModelKey,
    isCountingDown = false,
    speed = 1,
}: Props) {
    const key = useMemo(() => movementKey(exerciseName, analysisModelKey), [exerciseName, analysisModelKey]);
    const selected = selectedSide ?? "left";
    const [leftArm, setLeftArm] = useState<Arm>(() => restArm("left"));
    const [rightArm, setRightArm] = useState<Arm>(() => restArm("right"));
    const [phase, setPhase] = useState("Get ready");

    useEffect(() => {
        if (isCountingDown) {
            const frame = requestAnimationFrame(() => {
                setLeftArm(restArm("left"));
                setRightArm(restArm("right"));
                setPhase("Get ready");
            });
            return () => cancelAnimationFrame(frame);
        }

        const duration = 4 / Math.max(0.5, speed);
        const start = performance.now();
        let frameId = 0;

        const render = () => {
            const progress = (((performance.now() - start) / 1000) % duration) / duration;
            const wave = 0.5 - 0.5 * Math.cos(progress * Math.PI * 2);
            let left = restArm("left");
            let right = restArm("right");

            if (key === "arm_circumduction") {
                const arm = straightArm(selected, Math.PI / 2 + progress * Math.PI * 2);
                if (selected === "left") left = arm;
                else right = arm;
                setPhase("Circular motion");
            } else if (key === "cross_body_shoulder_stretch") {
                const active = selected === "left" ? "left" : "right";
                const support = active === "left" ? "right" : "left";
                const direction = active === "left" ? 1 : -1;
                const activeTarget: Arm = {
                    shoulder: SHOULDER[active],
                    elbow: { x: 100, y: 78 },
                    wrist: { x: 100 + direction * 31, y: 78 },
                };
                const supportTarget: Arm = {
                    shoulder: SHOULDER[support],
                    elbow: { x: 100 - direction * 24, y: 102 },
                    wrist: { x: 100 - direction * 8, y: 86 },
                };
                if (active === "left") {
                    left = interpolate(restArm("left"), activeTarget, wave);
                    right = interpolate(restArm("right"), supportTarget, wave);
                } else {
                    right = interpolate(restArm("right"), activeTarget, wave);
                    left = interpolate(restArm("left"), supportTarget, wave);
                }
                setPhase(wave > 0.92 ? "Hold stretch" : "Move across chest");
            } else {
                const active: Side = key === "external_rotation" ? "right" : "left";
                const rotation = Math.PI / 2 - Math.PI * wave;
                const arm = rotationArm(active, rotation);
                if (active === "left") left = arm;
                else right = arm;
                setPhase(wave > 0.92 ? "Hold rotation" : "Rotate forearm");
            }

            setLeftArm(left);
            setRightArm(right);
            frameId = requestAnimationFrame(render);
        };

        frameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(frameId);
    }, [isCountingDown, key, selected, speed]);

    const activeLeft = (key === "arm_circumduction" || key === "cross_body_shoulder_stretch")
        ? selected === "left"
        : key === "internal_rotation";
    const activeRight = (key === "arm_circumduction" || key === "cross_body_shoulder_stretch")
        ? selected === "right"
        : key === "external_rotation";

    const drawArm = (arm: Arm, active: boolean, id: string) => (
        <g id={id}>
            <line x1={arm.shoulder.x} y1={arm.shoulder.y} x2={arm.elbow.x} y2={arm.elbow.y}
                stroke="#111827" strokeWidth={active ? "4.5" : "3.5"} strokeLinecap="round" />
            <line x1={arm.elbow.x} y1={arm.elbow.y} x2={arm.wrist.x} y2={arm.wrist.y}
                stroke="#111827" strokeWidth={active ? "4" : "3"} strokeLinecap="round" />
            <circle cx={arm.elbow.x} cy={arm.elbow.y} r="4.5" fill="#ffffff" stroke="#111827" strokeWidth="2.5" />
            <circle cx={arm.elbow.x} cy={arm.elbow.y} r="1.8" fill="#111827" />
            <circle cx={arm.wrist.x} cy={arm.wrist.y} r="4" fill="#111827" />
        </g>
    );

    return (
        <div className="animated-exercise-container" style={{ background: "#ffffff", border: "none" }}>
            <svg viewBox="0 0 200 240" className="animated-exercise-svg" role="img"
                aria-label={`Animated exercise demonstration for ${exerciseName}`}
                style={{ background: "#ffffff", display: "block" }}>
                <g stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    <path d="M 80 148 L 120 148" strokeWidth="3.5" />
                    <path d="M 82 148 L 82 190 L 80 230" />
                    <path d="M 118 148 L 118 190 L 120 230" />
                </g>
                <path d="M 72 76 L 128 76 L 120 148 L 80 148 Z" fill="#f8fafc" stroke="#111827" strokeWidth="2" />
                <line x1="100" y1="56" x2="100" y2="148" stroke="#111827" strokeWidth="2" strokeDasharray="3 3" />
                <line x1="100" y1="56" x2="100" y2="68" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
                <circle cx="100" cy="36" r="18" fill="#ffffff" stroke="#111827" strokeWidth="3" />
                <path d="M 92 35 Q 100 33 108 35" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <circle cx="100" cy="38" r="2" fill="#111827" />
                <polygon points="100,74 108,84 100,94 92,84" fill="#e2e8f0" stroke="#111827" strokeWidth="2" />
                {drawArm(leftArm, activeLeft, "avatar-left-arm")}
                {drawArm(rightArm, activeRight, "avatar-right-arm")}
                {(["left", "right"] as const).map((side) => (
                    <g key={side}>
                        <circle cx={SHOULDER[side].x} cy={SHOULDER[side].y} r="5.5" fill="#e2e8f0" stroke="#111827" strokeWidth="2.5" />
                        <circle cx={SHOULDER[side].x} cy={SHOULDER[side].y} r="2" fill="#111827" />
                    </g>
                ))}
            </svg>
            <div className="animated-exercise-footer"><div className="exercise-phase-badge"><span>{phase}</span></div></div>
        </div>
    );
}

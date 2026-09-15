"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface HumanInstructorGuideProps {
    exerciseName: string;
    selectedSide?: "left" | "right" | null;
    analysisModelKey?: string | null;
    isRecording?: boolean;
    speed?: number; // 0.75, 1.0, 1.25
    isPlaying?: boolean;
}

type MovementType = "left_flexion" | "right_flexion" | "left_abduction" | "right_abduction";

function resolveMovementType(
    exerciseName?: string,
    selectedSide?: "left" | "right" | null,
    modelKey?: string | null,
): MovementType {
    const norm = (exerciseName || "").toLowerCase();
    const key = (modelKey || "").toLowerCase();

    if (norm.includes("abduction") || key.includes("abduction")) {
        if (selectedSide === "right" || key.includes("right")) {
            return "right_abduction";
        }
        return "left_abduction";
    }

    if (selectedSide === "right" || key.includes("right")) {
        return "right_flexion";
    }
    return "left_flexion";
}

export function HumanInstructorGuide({
    exerciseName,
    selectedSide,
    analysisModelKey,
    speed = 1.0,
    isPlaying = true,
}: HumanInstructorGuideProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const movement = resolveMovementType(exerciseName, selectedSide, analysisModelKey);
    const animationDuration = 4.4 / Math.max(0.5, speed); // full cycle in seconds

    const [currentAngle, setCurrentAngle] = useState(0);
    const [cyclePhase, setCyclePhase] = useState<string>("Raising Arm");
    const [phaseName, setPhaseName] = useState<"Raise" | "Hold" | "Lower" | "Rest">("Raise");

    const timeRef = useRef(0);
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;

    const movementRef = useRef(movement);
    movementRef.current = movement;

    const durationRef = useRef(animationDuration);
    durationRef.current = animationDuration;

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const width = container.clientWidth || 260;
        const height = container.clientHeight || 195;

        // 1. Three.js Scene, Camera, Renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f3ee);
        scene.fog = new THREE.FogExp2(0xf5f3ee, 0.035);

        const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 30);
        // Positioned at a polished 3/4 perspective angle for clear anatomical visualization
        camera.position.set(1.25, 1.25, 2.7);
        camera.lookAt(0, 0.96, -0.05);

        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Tone mapping for realistic skin & fabric contrast
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;

        // 2. Lighting Setup (Natural Warm Studio & Living Room Daylight)
        const hemisphereLight = new THREE.HemisphereLight(0xfffdfa, 0xdbeafe, 0.95);
        scene.add(hemisphereLight);

        // Warm Sunlight from Window
        const sunLight = new THREE.DirectionalLight(0xfff5ea, 1.35);
        sunLight.position.set(-3.2, 4.8, 3.2);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 12;
        sunLight.shadow.camera.left = -3;
        sunLight.shadow.camera.right = 3;
        sunLight.shadow.camera.top = 3;
        sunLight.shadow.camera.bottom = -1;
        sunLight.shadow.bias = -0.0008;
        scene.add(sunLight);

        // Soft Living Room Lamp Accent Light
        const lampLight = new THREE.PointLight(0xfef08a, 1.1, 5.0, 1.2);
        lampLight.position.set(-1.45, 1.55, -1.1);
        scene.add(lampLight);

        // Soft Cyan/Sky Rim Light for Crisp Silhouette
        const rimLight = new THREE.DirectionalLight(0xa5f3fc, 0.65);
        rimLight.position.set(2.8, 2.6, -2.4);
        scene.add(rimLight);

        // Front Soft Fill Light
        const fillLight = new THREE.DirectionalLight(0xffedd5, 0.4);
        fillLight.position.set(0.5, 1.0, 2.5);
        scene.add(fillLight);

        // 3. Living Room Architecture & Furniture
        const livingRoomGroup = new THREE.Group();
        scene.add(livingRoomGroup);

        // --- Hardwood Floor ---
        const floorGeo = new THREE.PlaneGeometry(9, 9);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xc89d6e, // Warm natural oak
            roughness: 0.55,
            metalness: 0.05,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        livingRoomGroup.add(floor);

        // Subtle floor wood plank seams
        for (let i = -4.0; i <= 4.0; i += 0.45) {
            const seamGeo = new THREE.PlaneGeometry(0.012, 9);
            const seamMat = new THREE.MeshBasicMaterial({ color: 0xaa7e52, transparent: true, opacity: 0.25 });
            const seam = new THREE.Mesh(seamGeo, seamMat);
            seam.rotation.x = -Math.PI / 2;
            seam.position.set(i, 0.001, 0);
            livingRoomGroup.add(seam);
        }

        // --- Elegant Living Room Area Rug ---
        const rugGeo = new THREE.PlaneGeometry(2.5, 2.1);
        const rugMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0, // Soft woven slate cream
            roughness: 0.95,
            metalness: 0.0,
        });
        const rug = new THREE.Mesh(rugGeo, rugMat);
        rug.rotation.x = -Math.PI / 2;
        rug.position.set(0, 0.003, 0.1);
        rug.receiveShadow = true;
        livingRoomGroup.add(rug);

        const rugBorderGeo = new THREE.PlaneGeometry(2.58, 2.18);
        const rugBorderMat = new THREE.MeshBasicMaterial({ color: 0x0f766e, transparent: true, opacity: 0.22 });
        const rugBorder = new THREE.Mesh(rugBorderGeo, rugBorderMat);
        rugBorder.rotation.x = -Math.PI / 2;
        rugBorder.position.set(0, 0.002, 0.1);
        livingRoomGroup.add(rugBorder);

        // --- Back Wall with Molding ---
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xeae4db, roughness: 0.85 });
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), wallMat);
        backWall.position.set(0, 2, -1.8);
        backWall.receiveShadow = true;
        livingRoomGroup.add(backWall);

        const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const baseboard = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.04), baseboardMat);
        baseboard.position.set(0, 0.06, -1.78);
        livingRoomGroup.add(baseboard);

        // --- Modern Background Sofa ---
        const sofaGroup = new THREE.Group();
        sofaGroup.position.set(0.70, 0, -1.35);
        livingRoomGroup.add(sofaGroup);

        const sofaMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
        const sofaCushionMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });

        const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.24, 0.65), sofaMat);
        sofaBase.position.set(0, 0.22, 0);
        sofaBase.castShadow = true;
        sofaBase.receiveShadow = true;
        sofaGroup.add(sofaBase);

        const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.54, 0.18), sofaMat);
        sofaBack.position.set(0, 0.54, -0.24);
        sofaBack.castShadow = true;
        sofaGroup.add(sofaBack);

        const leftArmrest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.65), sofaMat);
        leftArmrest.position.set(-0.82, 0.38, 0);
        leftArmrest.castShadow = true;
        sofaGroup.add(leftArmrest);

        const rightArmrest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.65), sofaMat);
        rightArmrest.position.set(0.82, 0.38, 0);
        rightArmrest.castShadow = true;
        sofaGroup.add(rightArmrest);

        const cushion1 = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.10, 0.48), sofaCushionMat);
        cushion1.position.set(-0.38, 0.37, 0.04);
        sofaGroup.add(cushion1);

        const cushion2 = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.10, 0.48), sofaCushionMat);
        cushion2.position.set(0.38, 0.37, 0.04);
        sofaGroup.add(cushion2);

        // Sofa Legs
        const legGeo = new THREE.CylinderGeometry(0.024, 0.016, 0.12, 8);
        [
            [-0.74, -0.24],
            [0.74, -0.24],
            [-0.74, 0.24],
            [0.74, 0.24],
        ].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(legGeo, woodMat);
            leg.position.set(lx, 0.06, lz);
            leg.castShadow = true;
            sofaGroup.add(leg);
        });

        // --- Side Table & Potted Plant ---
        const plantGroup = new THREE.Group();
        plantGroup.position.set(-1.42, 0, -1.1);
        livingRoomGroup.add(plantGroup);

        const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), woodMat);
        tableTop.position.set(0, 0.42, 0);
        tableTop.castShadow = true;
        plantGroup.add(tableTop);

        const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), woodMat);
        tableLeg.position.set(0, 0.21, 0);
        plantGroup.add(tableLeg);

        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.07, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
        pot.position.set(0, 0.50, 0);
        pot.castShadow = true;
        plantGroup.add(pot);

        const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
        const leafGeo = new THREE.SphereGeometry(0.07, 8, 8);
        leafGeo.scale(1.4, 0.3, 0.8);
        for (let a = 0; a < 5; a++) {
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            const angle = (a * Math.PI * 2) / 5;
            leaf.position.set(Math.cos(angle) * 0.08, 0.58 + (a % 2) * 0.04, Math.sin(angle) * 0.08);
            leaf.rotation.set(0.3, angle, 0.4);
            leaf.castShadow = true;
            plantGroup.add(leaf);
        }

        // --- Floor Lamp & Wall Art ---
        const lampGroup = new THREE.Group();
        lampGroup.position.set(-1.45, 0, -1.5);
        livingRoomGroup.add(lampGroup);

        const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 16), woodMat);
        lampBase.position.set(0, 0.01, 0);
        lampGroup.add(lampBase);

        const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 8), woodMat);
        lampPole.position.set(0, 0.75, 0);
        lampGroup.add(lampPole);

        const shadeMat = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfde047,
            emissiveIntensity: 0.5,
            roughness: 0.3,
        });
        const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.22, 16, 1, true), shadeMat);
        lampShade.position.set(0, 1.45, 0);
        lampGroup.add(lampShade);

        // Wall Art
        const frameOuter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.03), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }));
        frameOuter.position.set(0.42, 1.75, -1.78);
        livingRoomGroup.add(frameOuter);

        const artCanvas = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.57), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 }));
        artCanvas.position.set(0.42, 1.75, -1.76);
        livingRoomGroup.add(artCanvas);

        const artCircle = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: 0x0f766e }));
        artCircle.position.set(0.37, 1.75, -1.755);
        livingRoomGroup.add(artCircle);

        const artArc = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.20, 24, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xd97706 }));
        artArc.position.set(0.50, 1.70, -1.755);
        livingRoomGroup.add(artArc);

        // 4. Realistic Human Materials & Textures
        const skinMat = new THREE.MeshStandardMaterial({
            color: 0xf0b88e, // Natural warm Caucasian/Asian/Mediterranean skin tone
            roughness: 0.45,
            metalness: 0.02,
        });

        const shirtMat = new THREE.MeshStandardMaterial({
            color: 0x0f766e, // Deep emerald teal activewear
            roughness: 0.55,
            metalness: 0.05,
        });

        const shirtTrimMat = new THREE.MeshStandardMaterial({
            color: 0x115e59,
            roughness: 0.6,
        });

        const pantsMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b, // Dark charcoal workout joggers
            roughness: 0.65,
            metalness: 0.05,
        });

        const hairMat = new THREE.MeshStandardMaterial({
            color: 0x271912, // Dark textured hair
            roughness: 0.75,
        });

        const shoeMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.4,
            metalness: 0.1,
        });

        const shoeSoleMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
        });

        // 5. Build High-Quality Anatomical 3D Human Avatar
        const humanGroup = new THREE.Group();
        humanGroup.position.set(-0.06, 0, 0.12);
        humanGroup.rotation.y = THREE.MathUtils.degToRad(-24); // 24° dynamic 3/4 stance
        scene.add(humanGroup);

        // --- Pelvis & Hips ---
        const pelvisGeo = new THREE.CylinderGeometry(0.18, 0.165, 0.17, 24);
        const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
        pelvis.position.set(0, 0.96, 0);
        pelvis.castShadow = true;
        humanGroup.add(pelvis);

        // --- Torso & Chest Group ---
        const torsoGroup = new THREE.Group();
        torsoGroup.position.set(0, 0.96, 0);
        humanGroup.add(torsoGroup);

        // Abdomen / Lower Torso
        const lowerTorsoGeo = new THREE.CylinderGeometry(0.19, 0.18, 0.16, 24);
        const lowerTorso = new THREE.Mesh(lowerTorsoGeo, shirtMat);
        lowerTorso.position.set(0, 0.09, 0);
        lowerTorso.castShadow = true;
        torsoGroup.add(lowerTorso);

        // Upper Chest & Pectorals
        const chestGeo = new THREE.CylinderGeometry(0.235, 0.19, 0.24, 24);
        const chest = new THREE.Mesh(chestGeo, shirtMat);
        chest.position.set(0, 0.28, 0);
        chest.castShadow = true;
        torsoGroup.add(chest);

        // Collar Trim
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 12, 24), shirtTrimMat);
        collar.rotation.x = Math.PI / 2;
        collar.position.set(0, 0.40, 0);
        torsoGroup.add(collar);

        // --- Neck & Anatomical Head ---
        const neckGeo = new THREE.CylinderGeometry(0.075, 0.088, 0.13, 20);
        const neck = new THREE.Mesh(neckGeo, skinMat);
        neck.position.set(0, 0.45, 0);
        torsoGroup.add(neck);

        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.57, 0);
        torsoGroup.add(headGroup);

        // Cranium / Face (Smooth organic head shape)
        const headGeo = new THREE.SphereGeometry(0.118, 24, 24);
        headGeo.scale(0.92, 1.15, 0.98);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.castShadow = true;
        headGroup.add(head);

        // Nose bridge & tip
        const noseGeo = new THREE.ConeGeometry(0.022, 0.045, 12);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, skinMat);
        nose.position.set(0, 0.01, 0.12);
        headGroup.add(nose);

        // Ears
        const earGeo = new THREE.SphereGeometry(0.028, 12, 12);
        earGeo.scale(0.4, 1.0, 0.6);
        const leftEar = new THREE.Mesh(earGeo, skinMat);
        leftEar.position.set(-0.11, 0.01, -0.01);
        headGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, skinMat);
        rightEar.position.set(0.11, 0.01, -0.01);
        headGroup.add(rightEar);

        // Sculpted Modern Hair
        const hairGeo = new THREE.SphereGeometry(0.124, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.58);
        hairGeo.scale(0.94, 1.16, 0.99);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, 0.015, -0.01);
        headGroup.add(hair);

        // Hair Quiff / Bangs Volume
        const hairFrontGeo = new THREE.SphereGeometry(0.065, 16, 12);
        hairFrontGeo.scale(1.5, 0.6, 0.8);
        const hairFront = new THREE.Mesh(hairFrontGeo, hairMat);
        hairFront.position.set(0, 0.09, 0.065);
        hairFront.rotation.x = -0.3;
        headGroup.add(hairFront);

        // Helper function to create realistic articulated human hands with fingers
        const createRealisticHand = (isLeft: boolean) => {
            const handGroup = new THREE.Group();

            // Palm / Metacarpal body
            const palmGeo = new THREE.BoxGeometry(0.042, 0.075, 0.026);
            palmGeo.translate(0, -0.038, 0);
            const palm = new THREE.Mesh(palmGeo, skinMat);
            palm.castShadow = true;
            handGroup.add(palm);

            // Thumb (positioned naturally at opposing angle)
            const thumbGroup = new THREE.Group();
            const thumbSide = isLeft ? -0.024 : 0.024;
            thumbGroup.position.set(thumbSide, -0.02, 0.008);
            thumbGroup.rotation.z = isLeft ? -0.5 : 0.5;
            thumbGroup.rotation.y = isLeft ? 0.4 : -0.4;
            handGroup.add(thumbGroup);

            const thumbGeo = new THREE.CylinderGeometry(0.008, 0.007, 0.035, 10);
            thumbGeo.translate(0, -0.017, 0);
            const thumb = new THREE.Mesh(thumbGeo, skinMat);
            thumb.castShadow = true;
            thumbGroup.add(thumb);

            // Four Fingers (Index, Middle, Ring, Pinky) with natural relaxed curl
            const fingerLengths = [0.038, 0.042, 0.039, 0.032];
            const fingerOffsets = [-0.015, -0.005, 0.005, 0.015];

            for (let f = 0; f < 4; f++) {
                const fingerGroup = new THREE.Group();
                fingerGroup.position.set(fingerOffsets[f], -0.075, 0);
                fingerGroup.rotation.x = 0.22; // gentle natural relaxed curl
                handGroup.add(fingerGroup);

                const fingerGeo = new THREE.CylinderGeometry(0.0065, 0.0055, fingerLengths[f], 10);
                fingerGeo.translate(0, -fingerLengths[f] / 2, 0);
                const finger = new THREE.Mesh(fingerGeo, skinMat);
                finger.castShadow = true;
                fingerGroup.add(finger);
            }

            return handGroup;
        };

        // --- Left Arm Articulated Chain ---
        const leftShoulderPivot = new THREE.Group();
        leftShoulderPivot.position.set(-0.255, 0.36, 0);
        torsoGroup.add(leftShoulderPivot);

        // Smooth Deltoid Cap (Sleeve contour)
        const leftDeltoid = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 16), shirtMat);
        leftShoulderPivot.add(leftDeltoid);

        // Bicep / Upper Arm
        const upperArmGeo = new THREE.CylinderGeometry(0.058, 0.048, 0.27, 16);
        upperArmGeo.translate(0, -0.135, 0);
        const leftUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
        leftUpperArm.castShadow = true;
        leftShoulderPivot.add(leftUpperArm);

        // Left Elbow Pivot
        const leftElbowPivot = new THREE.Group();
        leftElbowPivot.position.set(0, -0.27, 0);
        leftShoulderPivot.add(leftElbowPivot);

        const leftElbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 14), skinMat);
        leftElbowPivot.add(leftElbowJoint);

        // Forearm
        const forearmGeo = new THREE.CylinderGeometry(0.048, 0.040, 0.27, 16);
        forearmGeo.translate(0, -0.135, 0);
        const leftForearm = new THREE.Mesh(forearmGeo, skinMat);
        leftForearm.castShadow = true;
        leftElbowPivot.add(leftForearm);

        // Articulated Left Hand with fingers
        const leftHandPivot = new THREE.Group();
        leftHandPivot.position.set(0, -0.27, 0);
        leftElbowPivot.add(leftHandPivot);
        leftHandPivot.add(createRealisticHand(true));

        // --- Right Arm Articulated Chain ---
        const rightShoulderPivot = new THREE.Group();
        rightShoulderPivot.position.set(0.255, 0.36, 0);
        torsoGroup.add(rightShoulderPivot);

        const rightDeltoid = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 16), shirtMat);
        rightShoulderPivot.add(rightDeltoid);

        const rightUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
        rightUpperArm.castShadow = true;
        rightShoulderPivot.add(rightUpperArm);

        const rightElbowPivot = new THREE.Group();
        rightElbowPivot.position.set(0, -0.27, 0);
        rightShoulderPivot.add(rightElbowPivot);

        const rightElbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 14), skinMat);
        rightElbowPivot.add(rightElbowJoint);

        const rightForearm = new THREE.Mesh(forearmGeo, skinMat);
        rightForearm.castShadow = true;
        rightElbowPivot.add(rightForearm);

        // Articulated Right Hand with fingers
        const rightHandPivot = new THREE.Group();
        rightHandPivot.position.set(0, -0.27, 0);
        rightElbowPivot.add(rightHandPivot);
        rightHandPivot.add(createRealisticHand(false));

        // --- Legs & Athletic Running Sneakers ---
        const thighGeo = new THREE.CylinderGeometry(0.086, 0.066, 0.40, 18);
        thighGeo.translate(0, -0.20, 0);

        const shinGeo = new THREE.CylinderGeometry(0.062, 0.046, 0.43, 18);
        shinGeo.translate(0, -0.215, 0);

        // Left Leg
        const leftThigh = new THREE.Mesh(thighGeo, pantsMat);
        leftThigh.position.set(-0.105, 0.90, 0);
        leftThigh.castShadow = true;
        humanGroup.add(leftThigh);

        const leftKnee = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), pantsMat);
        leftKnee.position.set(-0.105, 0.50, 0);
        humanGroup.add(leftKnee);

        const leftShin = new THREE.Mesh(shinGeo, pantsMat);
        leftShin.position.set(-0.105, 0.50, 0);
        leftShin.castShadow = true;
        humanGroup.add(leftShin);

        const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.065, 0.22), shoeMat);
        leftShoe.position.set(-0.105, 0.040, 0.035);
        leftShoe.castShadow = true;
        humanGroup.add(leftShoe);

        const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.020, 0.23), shoeSoleMat);
        leftSole.position.set(-0.105, 0.010, 0.035);
        humanGroup.add(leftSole);

        // Right Leg
        const rightThigh = new THREE.Mesh(thighGeo, pantsMat);
        rightThigh.position.set(0.105, 0.90, 0);
        rightThigh.castShadow = true;
        humanGroup.add(rightThigh);

        const rightKnee = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), pantsMat);
        rightKnee.position.set(0.105, 0.50, 0);
        humanGroup.add(rightKnee);

        const rightShin = new THREE.Mesh(shinGeo, pantsMat);
        rightShin.position.set(0.105, 0.50, 0);
        rightShin.castShadow = true;
        humanGroup.add(rightShin);

        const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.065, 0.22), shoeMat);
        rightShoe.position.set(0.105, 0.040, 0.035);
        rightShoe.castShadow = true;
        humanGroup.add(rightShoe);

        const rightSole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.020, 0.23), shoeSoleMat);
        rightSole.position.set(0.105, 0.010, 0.035);
        humanGroup.add(rightSole);

        // 6. Smooth Biomechanical Exercise Animation Loop
        let frameId: number;
        let lastTime = performance.now();

        const animate = (currentTime: number) => {
            const delta = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            if (isPlayingRef.current) {
                timeRef.current = (timeRef.current + delta) % durationRef.current;
            }

            const currentMovement = movementRef.current;
            const progress = timeRef.current / durationRef.current;

            let maxAngle = 90;
            if (currentMovement.includes("abduction")) maxAngle = 145;
            if (currentMovement.includes("flexion")) maxAngle = 160;

            let angle = 0;
            let label = "Raising Arm";
            let phase: "Raise" | "Hold" | "Lower" | "Rest" = "Raise";

            // Continuous smoothstep acceleration & deceleration
            if (progress < 0.40) {
                // Phase 1: Concentric Raise (0% to 40%) - smooth easing
                phase = "Raise";
                label = "Concentric: Smooth Raise";
                const p = progress / 0.40;
                const smoothP = 0.5 - 0.5 * Math.cos(p * Math.PI);
                angle = smoothP * maxAngle;
            } else if (progress < 0.52) {
                // Phase 2: Peak Hold (40% to 52%)
                phase = "Hold";
                label = "Peak Hold: Pause & Breathe";
                angle = maxAngle;
            } else if (progress < 0.92) {
                // Phase 3: Eccentric Lowering (52% to 92%) - controlled natural descent
                phase = "Lower";
                label = "Eccentric: Controlled Lower";
                const p = (progress - 0.52) / 0.40;
                const smoothP = 0.5 + 0.5 * Math.cos(p * Math.PI);
                angle = smoothP * maxAngle;
            } else {
                // Phase 4: Rest pause (92% to 100%)
                phase = "Rest";
                label = "Neutral Stance";
                angle = 0;
            }

            setCurrentAngle(angle);
            setCyclePhase(label);
            setPhaseName(phase);

            const rad = THREE.MathUtils.degToRad(angle);

            // Reset pivots to neutral natural anatomical resting state
            leftShoulderPivot.rotation.set(0, 0, 0);
            leftShoulderPivot.position.set(-0.255, 0.36, 0);
            leftElbowPivot.rotation.set(0.08, 0, 0); // slight natural elbow flexion in resting state
            leftHandPivot.rotation.set(0, 0, 0);

            rightShoulderPivot.rotation.set(0, 0, 0);
            rightShoulderPivot.position.set(0.255, 0.36, 0);
            rightElbowPivot.rotation.set(0.08, 0, 0);
            rightHandPivot.rotation.set(0, 0, 0);

            // Subtle natural breathing motion in chest & posture
            const breath = 1 + 0.010 * Math.sin(timeRef.current * 2.2);
            torsoGroup.scale.set(breath, breath, breath);

            // Subtle posture stabilization (very slight core tilt to counterbalance the arm)
            const isLeft = currentMovement === "left_flexion" || currentMovement === "left_abduction";
            const isRight = currentMovement === "right_flexion" || currentMovement === "right_abduction";
            const isFlex = currentMovement.includes("flexion");

            if (isLeft) {
                if (isFlex) {
                    // Left Shoulder Flexion: forward raise in sagittal plane with scapular elevation
                    leftShoulderPivot.rotation.x = rad;
                    leftShoulderPivot.rotation.z = -rad * 0.05;
                    leftShoulderPivot.position.y = 0.36 + (rad / 2.8) * 0.032;
                    // Natural wrist extension alignment as arm rises
                    leftHandPivot.rotation.x = rad * 0.08;
                    // Subtle elbow extension
                    leftElbowPivot.rotation.x = 0.04;
                } else {
                    // Left Shoulder Abduction: lateral raise in coronal plane
                    leftShoulderPivot.rotation.z = rad;
                    leftShoulderPivot.rotation.x = -rad * 0.10;
                    leftShoulderPivot.position.y = 0.36 + (rad / 2.6) * 0.038;
                    leftHandPivot.rotation.z = -rad * 0.06;
                    leftElbowPivot.rotation.x = 0.04;
                }
            }

            if (isRight) {
                if (isFlex) {
                    // Right Shoulder Flexion: forward raise
                    rightShoulderPivot.rotation.x = rad;
                    rightShoulderPivot.rotation.z = rad * 0.05;
                    rightShoulderPivot.position.y = 0.36 + (rad / 2.8) * 0.032;
                    rightHandPivot.rotation.x = rad * 0.08;
                    rightElbowPivot.rotation.x = 0.04;
                } else {
                    // Right Shoulder Abduction: lateral raise
                    rightShoulderPivot.rotation.z = -rad;
                    rightShoulderPivot.rotation.x = -rad * 0.10;
                    rightShoulderPivot.position.y = 0.36 + (rad / 2.6) * 0.038;
                    rightHandPivot.rotation.z = rad * 0.06;
                    rightElbowPivot.rotation.x = 0.04;
                }
            }

            // Subtle cinematic camera presence
            const camSway = Math.sin(timeRef.current * 0.35) * 0.03;
            camera.position.x = 1.25 + camSway;
            camera.lookAt(0, 0.96, -0.05);

            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);

        // Resize handling
        const handleResize = () => {
            if (!container) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w && h) {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            }
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        return () => {
            cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            renderer.dispose();
            scene.clear();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="human-instructor-container"
            style={{
                position: "relative",
                width: "100%",
                aspectRatio: "4 / 3",
                backgroundColor: "#f5f3ee",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />

            {/* Bottom 3D Movement Telemetry & Phase Badge */}
            <div
                style={{
                    position: "absolute",
                    bottom: "8px",
                    left: "8px",
                    right: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    backgroundColor: "rgba(15, 23, 42, 0.82)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "8px",
                    color: "#ffffff",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    zIndex: 10,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                        style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            backgroundColor: phaseName === "Hold" ? "#2dd4bf" : phaseName === "Raise" ? "#10b981" : "#94a3b8",
                            display: "inline-block",
                        }}
                    />
                    <span>{cyclePhase}</span>
                </div>
                <span style={{ color: "#2dd4bf", fontSize: "10px", fontWeight: 800 }}>
                    {Math.round(currentAngle)}° · 3D AI
                </span>
            </div>
        </div>
    );
}

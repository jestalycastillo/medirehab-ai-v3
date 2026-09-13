"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSideArmsRaiseGuidance, supportsExerciseLiveGuidance } from "@/hooks/use-side-arms-raise-guidance";
import { ExerciseKeyPointFigure } from "./exercise-key-point-figure";
import { formatScore } from "@/lib/score";

interface CameraRecorderProps {
    exerciseName?: string;
    exerciseId: string;
    assignmentId?: string;
    targetDurationSeconds?: number | null;
    minimumDurationSeconds?: number | null;
    onSave?: (blob: Blob) => void;
}

type TimerOption = {
    label: string;
    seconds: number | null;
};

const TIMER_OPTIONS: TimerOption[] = [
    { label: "No Timer", seconds: null },
    { label: "20s", seconds: 20 },
    { label: "30s", seconds: 30 },
    { label: "1 min", seconds: 60 },
];

const LIVE_COACHING_COOLDOWN_MS = 7_000;
const GUIDANCE_MESSAGES_TO_SKIP = new Set([
    "Preparing live guidance...",
    "Preparing live guidance…",
]);

export function CameraRecorder({ exerciseName = "Exercise", exerciseId, assignmentId, targetDurationSeconds, minimumDurationSeconds, onSave}: CameraRecorderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evaluationScore, setEvaluationScore] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [qualificationReason, setQualificationReason] = useState<string | null>(null);
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [checkIn, setCheckIn] = useState({
        painLevel: 0,
        difficultyLevel: 0,
        confidenceLevel: 10,
        note: "",
    });
    const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
    const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
    const [liveCoachingMessage, setLiveCoachingMessage] = useState<string | null>(null);
    const [selectedSide, setSelectedSide] = useState<"left" | "right">("left");
    const [selectedTimerSeconds, setSelectedTimerSeconds] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const isSideSelectable =
        exerciseName.toLowerCase().includes("flexion") ||
        exerciseName.toLowerCase().includes("abduction");

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const blobRef = useRef<Blob | null>(null);
    const recordingStartedAtRef = useRef(0);
    const recordingDurationSecondsRef = useRef(0);
    const clientSessionIdRef = useRef("");
    const liveGuidanceFeedbackRef = useRef<string[]>([]);
    const isRecordingRef = useRef(false);
    const lastLiveCoachingAtRef = useRef(0);
    const liveCoachingRequestIdRef = useRef(0);
    const lastSpokenMessageRef = useRef("");
    const lastSpokenAtRef = useRef(0);
    const liveGuidanceEnabled =
        isOpen &&
        Boolean(stream) &&
        !recordedUrl &&
        supportsExerciseLiveGuidance(exerciseName);
    const liveGuidance = useSideArmsRaiseGuidance(
        liveGuidanceEnabled,
        videoRef,
        exerciseName,
        selectedSide,
    );

    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
        if (
            !isRecording ||
            liveGuidance.status !== "ready" ||
            !liveGuidance.message ||
            GUIDANCE_MESSAGES_TO_SKIP.has(liveGuidance.message)
        ) {
            return;
        }

        if (!liveGuidanceFeedbackRef.current.includes(liveGuidance.message)) {
            liveGuidanceFeedbackRef.current = [
                ...liveGuidanceFeedbackRef.current,
                liveGuidance.message,
            ];
        }

        // Speak live movement guidance when instruction changes
        const now = Date.now();
        if (
            liveGuidance.message !== lastSpokenMessageRef.current &&
            now - lastSpokenAtRef.current > 1_800
        ) {
            lastSpokenMessageRef.current = liveGuidance.message;
            lastSpokenAtRef.current = now;
            speakLiveCoaching(liveGuidance.message);
        }
    }, [isRecording, liveGuidance.message, liveGuidance.status]);

    useEffect(() => {
        if (!isRecording || liveGuidance.status !== "ready") {
            return;
        }

        const event = liveGuidance.justCompletedRepetition
            ? "repetition_completed"
            : liveGuidance.resolvedIssues.length > 0
              ? "issue_resolved"
              : null;
        const now = Date.now();

        if (!event || now - lastLiveCoachingAtRef.current < LIVE_COACHING_COOLDOWN_MS) {
            return;
        }

        lastLiveCoachingAtRef.current = now;
        const requestId = liveCoachingRequestIdRef.current + 1;
        liveCoachingRequestIdRef.current = requestId;

        if (assignmentId) {
            api.requestLiveCoaching(exerciseId, assignmentId, event, isSideSelectable ? selectedSide : undefined)
                .then((response) => {
                    if (
                        liveCoachingRequestIdRef.current !== requestId
                        || !isRecordingRef.current
                    ) {
                        return;
                    }

                    setLiveCoachingMessage(response.message);
                    if (!liveGuidanceFeedbackRef.current.includes(response.message)) {
                        liveGuidanceFeedbackRef.current = [
                            ...liveGuidanceFeedbackRef.current,
                            response.message,
                        ];
                    }
                    lastSpokenMessageRef.current = response.message;
                    lastSpokenAtRef.current = Date.now();
                    speakLiveCoaching(response.message);
                })
                .catch(() => {
                    const fallbackMsg = event === "repetition_completed"
                        ? (isSideSelectable ? `Great control on that repetition on your ${selectedSide} arm.` : "Great control on that repetition.")
                        : "Nice adjustment. Keep moving with steady control.";
                    setLiveCoachingMessage(fallbackMsg);
                    lastSpokenMessageRef.current = fallbackMsg;
                    lastSpokenAtRef.current = Date.now();
                    speakLiveCoaching(fallbackMsg);
                });
        } else {
            const fallbackMsg = event === "repetition_completed"
                ? (isSideSelectable ? `Great control on that repetition on your ${selectedSide} arm.` : "Great control on that repetition.")
                : "Nice adjustment. Keep moving with steady control.";
            setLiveCoachingMessage(fallbackMsg);
            lastSpokenMessageRef.current = fallbackMsg;
            lastSpokenAtRef.current = Date.now();
            speakLiveCoaching(fallbackMsg);
        }
    }, [
        assignmentId,
        exerciseId,
        isRecording,
        isSideSelectable,
        selectedSide,
        liveGuidance.justCompletedRepetition,
        liveGuidance.resolvedIssues,
        liveGuidance.status,
    ]);

    // Clean up streams on unmount or close
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
            }
            if (elapsedIntervalRef.current) {
                clearInterval(elapsedIntervalRef.current);
            }
        };
    }, []);

    const startCamera = async () => {
        setError(null);
        setRecordedUrl(null);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 10 },
                },
                audio: false
            });
            streamRef.current = mediaStream;
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err: unknown) {
            console.error("Error accessing camera:", err);
            setError(
                "Could not access your front camera. Please check your camera permissions and ensure no other application is using it."
            );
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setStream(null);
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const handleOpen = async () => {
        try {
            const { consent } = await api.getMyConsent();
            if (!consent.privacyConsentAt || !consent.recordingConsentAt) {
                setIsOpen(true);
                setError("Camera consent is required. Enable it in your Profile before recording.");
                return;
            }
            setIsOpen(true);
            await startCamera();
        } catch {
            setIsOpen(true);
            setError("Unable to verify camera consent. Please try again.");
        }
    };

    const handleClose = () => {
        stopCamera();
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
        }
        if (elapsedIntervalRef.current) {
            clearInterval(elapsedIntervalRef.current);
            elapsedIntervalRef.current = null;
        }
        setElapsedSeconds(0);
        setCountdown(null);
        setIsRecording(false);
        setIsOpen(false);
        setError(null);
        setRecordedUrl(null);
        setIsEvaluating(false);
        setEvaluationScore(null);
        setSessionId(null);
        setQualificationReason(null);
        setIsCheckInOpen(false);
        setCheckIn({
            painLevel: 0,
            difficultyLevel: 0,
            confidenceLevel: 10,
            note: "",
        });
        setIsSubmittingCheckIn(false);
        setCheckInMessage(null);
        setLiveCoachingMessage(null);
        liveCoachingRequestIdRef.current += 1;
        lastLiveCoachingAtRef.current = 0;
        stopLiveCoachingPlayback();
        liveGuidanceFeedbackRef.current = [];
        blobRef.current = null;
    };

    const initiateCountdown = () => {
        if (!stream) return;
        setCountdown(5);

        countdownIntervalRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    clearInterval(countdownIntervalRef.current!);
                    startRecording();
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startRecording = () => {
        const activeStream = streamRef.current || stream;
        if (!activeStream) return;
        chunksRef.current = [];
        liveGuidanceFeedbackRef.current = [];
        setLiveCoachingMessage(null);
        liveCoachingRequestIdRef.current += 1;
        lastLiveCoachingAtRef.current = 0;

        try {
            const preferredMimeType = getPreferredMimeType();
            let recorder: MediaRecorder;
            try {
                recorder = preferredMimeType ? new MediaRecorder(activeStream, { mimeType: preferredMimeType }) : new MediaRecorder(activeStream);
            } catch {
                // Fallback for browsers
                recorder = new MediaRecorder(activeStream);
            }

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onerror = (e) => {
                console.error("MediaRecorder error:", e);
            };

            recorder.onstop = () => {
                try {
                    if (assignmentId) {
                        void api.stopExerciseActivity(assignmentId).catch(() => undefined);
                    }
                    if (recordingTimeoutRef.current) {
                        clearTimeout(recordingTimeoutRef.current);
                        recordingTimeoutRef.current = null;
                    }
                    if (elapsedIntervalRef.current) {
                        clearInterval(elapsedIntervalRef.current);
                        elapsedIntervalRef.current = null;
                    }
                    setIsRecording(false);
                    const mimeType = recorder.mimeType || "video/webm";
                    recordingDurationSecondsRef.current = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
                    const blob = new Blob(chunksRef.current, { type: mimeType });
                    blobRef.current = blob;
                    const url = URL.createObjectURL(blob);
                    setRecordedUrl(url);
                    stopCamera();
                    if (onSave) {
                        onSave(blob);
                    }
                } catch (err) {
                    console.error("Error finalizing recording:", err);
                    setError("Failed to finalize video recording.");
                }
            };

            mediaRecorderRef.current = recorder;
            recordingStartedAtRef.current = Date.now();
            setElapsedSeconds(0);
            if (elapsedIntervalRef.current) {
                clearInterval(elapsedIntervalRef.current);
            }
            elapsedIntervalRef.current = setInterval(() => {
                setElapsedSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
            }, 250);

            clientSessionIdRef.current = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            recorder.start(1000); // 1000ms timeslice to flush chunks periodically
            setIsRecording(true);
            if (assignmentId) {
                void api.startExerciseActivity(assignmentId).catch(() => undefined);
            }

            if (selectedTimerSeconds !== null && selectedTimerSeconds > 0) {
                recordingTimeoutRef.current = setTimeout(() => {
                    if (recorder.state === "recording") {
                        liveCoachingRequestIdRef.current += 1;
                        recorder.stop();
                    }
                }, selectedTimerSeconds * 1000);
            } else {
                recordingTimeoutRef.current = null;
            }
        } catch (err) {
            console.error("Failed to start recording:", err);
            setError("Failed to initialize video recording.");
        }
    };

    const stopRecording = () => {
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
        }
        if (elapsedIntervalRef.current) {
            clearInterval(elapsedIntervalRef.current);
            elapsedIntervalRef.current = null;
        }
        liveCoachingRequestIdRef.current += 1;
        stopLiveCoachingPlayback();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try {
                mediaRecorderRef.current.stop();
            } catch (err) {
                console.error("Error stopping media recorder:", err);
            }
        }
    };

    const handleEvaluate = async () => {
        if (!blobRef.current) return;
        if (!assignmentId) {
            setError("No assignment ID provided to evaluate.");
            return;
        }
        setIsEvaluating(true);
        setError(null);
        try {
            const res = await api.evaluateExercise(
                exerciseId,
                assignmentId,
                blobRef.current,
                recordingDurationSecondsRef.current,
                clientSessionIdRef.current,
                isSideSelectable ? selectedSide : undefined
            );
            if (res.success) {
                setEvaluationScore(res.score);
                setSessionId(res.sessionId);
                setQualificationReason(res.adherenceQualified ? null : res.qualificationReason || "This session did not meet the prescribed qualification rules.");
                const sessionFeedback = [
                    ...(res.feedback ?? []),
                    ...liveGuidanceFeedbackRef.current,
                ].filter((message, index, messages) => messages.indexOf(message) === index);

                if (sessionFeedback.length > 0) {
                    try {
                        await api.updateSessionFeedback(
                            res.sessionId,
                            sessionFeedback,
                        );
                    } catch (feedbackError: unknown) {
                        console.warn(
                            "Failed to save live guidance feedback:",
                            getErrorMessage(feedbackError, "Unknown error"),
                        );
                    }
                }
                setIsOpen(false);
                setIsCheckInOpen(true);
            } else {
                setError(res.message || "Failed to evaluate exercise.");
            }
        } catch (err: unknown) {
            const message = getErrorMessage(err, "An error occurred during evaluation.");
            console.warn("Evaluation request failed:", message);
            setError(message);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleSubmitCheckIn = async () => {
        if (!sessionId) {
            setError("No session was created for this exercise.");
            return;
        }

        setIsSubmittingCheckIn(true);
        setError(null);

        try {
            await api.submitCheckIn(sessionId, checkIn);
            setCheckInMessage("Check-in saved for your doctor.");
        } catch (err: unknown) {
            const message = getErrorMessage(err, "Unable to submit your check-in.");
            console.warn("Check-in request failed:", message);
            setError(message);
        } finally {
            setIsSubmittingCheckIn(false);
        }
    };

    const handleCloseCheckIn = () => {
        setIsCheckInOpen(false);
        setEvaluationScore(null);
        setSessionId(null);
        setQualificationReason(null);
        setCheckInMessage(null);
        setCheckIn({
            painLevel: 0,
            difficultyLevel: 0,
            confidenceLevel: 10,
            note: "",
        });
        liveGuidanceFeedbackRef.current = [];
    };

    const updateCheckInField = (
        field: "painLevel" | "difficultyLevel" | "confidenceLevel",
        value: number
    ) => {
        setCheckIn((current) => ({
            ...current,
            [field]: value,
        }));
    };

    return (
        <>
            <button className="btn btn-primary" onClick={handleOpen} style={{ height: "38px", padding: "0 14px" }}>
                Start Exercise
            </button>

            {isOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.75)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "20px",
                    }}
                    onClick={handleClose}
                >
                    <div
                        className="card animate-slide-up"
                        style={{
                            width: "100%",
                            maxWidth: "960px",
                            height: "min(720px, calc(100dvh - 40px))",
                            maxHeight: "calc(100dvh - 40px)",
                            backgroundColor: "var(--color-surface)",
                            overflow: "hidden",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                            boxShadow: "var(--shadow-elevated)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            style={{
                                padding: "14px 20px",
                                borderBottom: "1px solid var(--color-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                                flexWrap: "wrap",
                            }}
                        >
                            <div>
                                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                                    Record: {exerciseName}
                                </h3>
                                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "2px 0 0 0" }}>
                                    Align yourself in the frame before starting
                                </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                {isSideSelectable && (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            backgroundColor: "rgba(15, 23, 42, 0.06)",
                                            padding: "3px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--color-border)",
                                            gap: "2px",
                                        }}
                                    >
                                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", padding: "0 6px" }}>
                                            Arm:
                                        </span>
                                        <button
                                            type="button"
                                            disabled={isRecording || isEvaluating || countdown !== null}
                                            onClick={() => setSelectedSide("left")}
                                            style={{
                                                padding: "5px 12px",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                borderRadius: "6px",
                                                border: "none",
                                                cursor: isRecording || countdown !== null ? "not-allowed" : "pointer",
                                                backgroundColor: selectedSide === "left" ? "var(--color-primary, #0D9488)" : "transparent",
                                                color: selectedSide === "left" ? "#FFF" : "var(--color-text-secondary, #475569)",
                                                transition: "all 0.15s ease",
                                                boxShadow: selectedSide === "left" ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                                            }}
                                        >
                                            Left Arm
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isRecording || isEvaluating || countdown !== null}
                                            onClick={() => setSelectedSide("right")}
                                            style={{
                                                padding: "5px 12px",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                borderRadius: "6px",
                                                border: "none",
                                                cursor: isRecording || countdown !== null ? "not-allowed" : "pointer",
                                                backgroundColor: selectedSide === "right" ? "var(--color-primary, #0D9488)" : "transparent",
                                                color: selectedSide === "right" ? "#FFF" : "var(--color-text-secondary, #475569)",
                                                transition: "all 0.15s ease",
                                                boxShadow: selectedSide === "right" ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                                            }}
                                        >
                                            Right Arm
                                        </button>
                                    </div>
                                )}

                                {/* Timer Mode Selector */}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        backgroundColor: "rgba(15, 23, 42, 0.06)",
                                        padding: "3px",
                                        borderRadius: "8px",
                                        border: "1px solid var(--color-border)",
                                        gap: "2px",
                                    }}
                                >
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", padding: "0 6px" }}>
                                        Timer:
                                    </span>
                                    {TIMER_OPTIONS.map((opt) => {
                                        const isSelected = selectedTimerSeconds === opt.seconds;
                                        return (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                disabled={isRecording || isEvaluating || countdown !== null}
                                                onClick={() => setSelectedTimerSeconds(opt.seconds)}
                                                style={{
                                                    padding: "5px 10px",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                    borderRadius: "6px",
                                                    border: "none",
                                                    cursor: isRecording || countdown !== null ? "not-allowed" : "pointer",
                                                    backgroundColor: isSelected ? "var(--color-primary, #0D9488)" : "transparent",
                                                    color: isSelected ? "#FFF" : "var(--color-text-secondary, #475569)",
                                                    transition: "all 0.15s ease",
                                                    boxShadow: isSelected ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={handleClose}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        color: "var(--color-text-muted)",
                                        padding: "4px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: "50%",
                                    }}
                                    className="btn-secondary"
                                    aria-label="Close dialog"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Video Feed Workspace */}
                        <div
                            style={{
                                position: "relative",
                                backgroundColor: "#000",
                                width: "100%",
                                flex: "1 1 0",
                                minHeight: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {error ? (
                                <div style={{ color: "#EF4444", padding: "24px", textAlign: "center", fontSize: "14px" }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: "0 auto 12px auto", display: "block" }}>
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                        <line x1="12" y1="9" x2="12" y2="13"></line>
                                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                    </svg>
                                    {error}
                                </div>
                            ) : evaluationScore !== null ? (
                                /* Evaluation Success Screen */
                                <div style={{ color: "#FFF", padding: "40px 24px", textAlign: "center" }}>
                                    <div style={{
                                        width: "80px",
                                        height: "80px",
                                        borderRadius: "50%",
                                        backgroundColor: "rgba(22, 163, 74, 0.2)",
                                        border: "3px solid #16A34A",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto 20px auto",
                                        color: "#16A34A"
                                    }}>
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                    <h4 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px 0" }}>Evaluation Complete!</h4>
                                    <p style={{ color: "rgba(255,255,255,0.7)", margin: "0 0 16px 0", fontSize: "14px" }}>
                                        Your exercise performance has been evaluated.
                                    </p>
                                    <div style={{ fontSize: "48px", fontWeight: 800, color: "#16A34A", margin: "16px 0" }}>
                                        {formatScore(evaluationScore)} <span style={{ fontSize: "20px", fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>/ 100</span>
                                    </div>
                                </div>
                            ) : recordedUrl ? (
                                /* Post-Recording Preview */
                                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                                    <video
                                        src={recordedUrl}
                                        controls
                                        style={{ width: "100%", height: "100%", objectFit: "contain", transform: "scaleX(-1)" }}
                                    />
                                    {isEvaluating && (
                                        <div style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundColor: "rgba(15, 23, 42, 0.8)",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "16px",
                                            zIndex: 30
                                        }}>
                                            <div className="spinner spinner-white" style={{ width: "40px", height: "40px" }} />
                                            <div style={{ color: "#FFF", fontSize: "16px", fontWeight: 600 }}>Analyzing exercise performance...</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Live Camera Feed */
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            transform: "scaleX(-1)", // Mirror the front camera output
                                        }}
                                    />

                                    {liveGuidanceEnabled && (
                                        <>
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "16px",
                                                    right: "16px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "7px",
                                                    padding: "6px 10px",
                                                    borderRadius: "9999px",
                                                    backgroundColor: "rgba(15, 23, 42, 0.72)",
                                                    color: "#FFF",
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    zIndex: 10,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: "8px",
                                                        height: "8px",
                                                        borderRadius: "50%",
                                                        backgroundColor:
                                                            liveGuidance.status === "ready"
                                                                ? "#2DD4BF"
                                                                : liveGuidance.status === "error"
                                                                  ? "#F59E0B"
                                                                  : "#94A3B8",
                                                    }}
                                                />
                                                Live guidance
                                            </div>
                                            <ExerciseKeyPointFigure points={liveGuidance.keyPoints} />
                                            {liveCoachingMessage && (
                                                <div
                                                    aria-live="polite"
                                                    style={{
                                                        position: "absolute",
                                                        left: "50%",
                                                        bottom: "92px",
                                                        transform: "translateX(-50%)",
                                                        width: "min(90%, 540px)",
                                                        padding: "9px 13px",
                                                        borderRadius: "10px",
                                                        backgroundColor: "rgba(13, 148, 136, 0.92)",
                                                        color: "#FFF",
                                                        textAlign: "center",
                                                        fontSize: "13px",
                                                        fontWeight: 600,
                                                        lineHeight: 1.4,
                                                        zIndex: 10,
                                                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.22)",
                                                    }}
                                                >
                                                    {liveCoachingMessage}
                                                </div>
                                            )}
                                            <div
                                                aria-live="polite"
                                                style={{
                                                    position: "absolute",
                                                    left: "50%",
                                                    bottom: "18px",
                                                    transform: "translateX(-50%)",
                                                    width: "min(90%, 620px)",
                                                    padding: "10px 14px",
                                                    borderRadius: "12px",
                                                    backgroundColor: liveGuidance.justCompletedRepetition
                                                        ? "rgba(13, 148, 136, 0.9)"
                                                        : "rgba(15, 23, 42, 0.78)",
                                                    color: "#FFF",
                                                    textAlign: "center",
                                                    fontSize: "14px",
                                                    fontWeight: 600,
                                                    lineHeight: 1.4,
                                                    zIndex: 10,
                                                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.22)",
                                                }}
                                            >
                                                <div>{liveGuidance.message}</div>
                                                {liveGuidance.status === "ready" && (
                                                    <div
                                                        style={{
                                                            marginTop: "3px",
                                                            color: "rgba(255, 255, 255, 0.72)",
                                                            fontSize: "11px",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Detected repetitions: {liveGuidance.repetitions}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* Recording Status Overlay */}
                                    {isRecording && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "16px",
                                                left: "16px",
                                                backgroundColor: "rgba(0, 0, 0, 0.6)",
                                                padding: "6px 12px",
                                                borderRadius: "9999px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                color: "#FFF",
                                                zIndex: 10,
                                            }}
                                        >
                                            <span
                                                className="animate-pulse-subtle"
                                                style={{
                                                    width: "8px",
                                                    height: "8px",
                                                    borderRadius: "50%",
                                                    backgroundColor: "#EF4444",
                                                    display: "inline-block",
                                                }}
                                            />
                                            {selectedTimerSeconds !== null ? (
                                                <span>REC · {formatTime(elapsedSeconds)} / {formatTime(selectedTimerSeconds)}</span>
                                            ) : (
                                                <span>REC · {formatTime(elapsedSeconds)}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Arm selection indicator on video feed */}
                                    {isSideSelectable && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: isRecording ? "52px" : "16px",
                                                left: "16px",
                                                backgroundColor: "rgba(15, 23, 42, 0.75)",
                                                backdropFilter: "blur(4px)",
                                                padding: "5px 11px",
                                                borderRadius: "9999px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                fontSize: "11px",
                                                fontWeight: 700,
                                                color: "#FFF",
                                                zIndex: 10,
                                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: "6px",
                                                    height: "6px",
                                                    borderRadius: "50%",
                                                    backgroundColor: "#2DD4BF",
                                                    display: "inline-block",
                                                }}
                                            />
                                            Target: {selectedSide === "left" ? "Left Arm" : "Right Arm"}
                                        </div>
                                    )}

                                    {/* Countdown Timer Overlay */}
                                    {countdown !== null && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                backgroundColor: "rgba(0, 0, 0, 0.4)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                zIndex: 20,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: "84px",
                                                    fontWeight: 800,
                                                    color: "#FFF",
                                                    animation: "fadeIn 0.2s ease-out",
                                                    textShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                                }}
                                            >
                                                {countdown}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Action Footer */}
                        <div
                            style={{
                                padding: "16px 20px",
                                borderTop: "1px solid var(--color-border)",
                                display: "flex",
                                justifyContent: "center",
                                gap: "12px",
                                backgroundColor: "var(--color-surface)",
                            }}
                        >
                            {error ? (
                                <button className="btn btn-secondary" onClick={startCamera}>
                                    Try Again
                                </button>
                            ) : evaluationScore !== null ? (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        handleClose();
                                        window.location.reload();
                                    }}
                                    style={{ minWidth: "140px" }}
                                >
                                    Done
                                </button>
                            ) : recordedUrl ? (
                                <>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setRecordedUrl(null);
                                            startCamera();
                                        }}
                                        disabled={isEvaluating}
                                    >
                                        Record Again
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleEvaluate}
                                        disabled={isEvaluating}
                                        style={{ minWidth: "140px" }}
                                    >
                                        {isEvaluating ? "Evaluating..." : "Evaluate"}
                                    </button>
                                </>
                            ) : countdown !== null ? (
                                <button className="btn btn-primary" disabled style={{ minWidth: "140px" }}>
                                    Starting in {countdown}s...
                                </button>
                            ) : isRecording ? (
                                <button
                                    className="btn btn-danger"
                                    onClick={stopRecording}
                                    style={{
                                        minWidth: "140px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <span
                                        style={{
                                            width: "10px",
                                            height: "10px",
                                            backgroundColor: "#FFF",
                                            borderRadius: "2px",
                                            display: "inline-block",
                                        }}
                                    />
                                    Stop Recording
                                </button>
                            ) : (
                                <button
                                    className="btn btn-primary"
                                    onClick={initiateCountdown}
                                    disabled={!stream}
                                    style={{
                                        minWidth: "140px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <span
                                        style={{
                                            width: "12px",
                                            height: "12px",
                                            backgroundColor: "#FFF",
                                            borderRadius: "50%",
                                            display: "inline-block",
                                        }}
                                    />
                                    Start Recording
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isCheckInOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.45)",
                        backdropFilter: "blur(3px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10000,
                        padding: "20px",
                    }}
                    onClick={handleCloseCheckIn}
                >
                    <div
                        className="card animate-slide-up"
                        style={{
                            width: "100%",
                            maxWidth: "640px",
                            backgroundColor: "#FFFFFF",
                            borderRadius: "20px",
                            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.16)",
                            border: "1px solid rgba(226, 232, 240, 0.9)",
                            overflow: "hidden",
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div style={{ padding: "22px 22px 18px 22px", borderBottom: "1px solid var(--color-border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "6px" }}>
                                        Post Exercise Check-in
                                    </div>
                                    <h3 style={{ fontSize: "20px", fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                                        How did that session feel?
                                    </h3>
                                    <p style={{ margin: "8px 0 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                                        Share a quick self-report for your doctor after scoring {formatScore(evaluationScore)}/100.
                                    </p>
                                    {qualificationReason && <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "10px", background: "#FEF3C7", color: "#92400E", fontSize: "13px" }}>Recorded for your doctor, but not counted toward adherence: {qualificationReason}</div>}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCloseCheckIn}
                                    className="btn btn-secondary"
                                    style={{ height: "36px", width: "36px", padding: 0, minWidth: 0 }}
                                    aria-label="Close check-in"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: "20px 22px 22px 22px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                                {[
                                    {
                                        key: "painLevel",
                                        label: "Pain",
                                        value: checkIn.painLevel,
                                        helper: "0 = none, 10 = severe",
                                    },
                                    {
                                        key: "difficultyLevel",
                                        label: "Difficulty",
                                        value: checkIn.difficultyLevel,
                                        helper: "How hard the movement felt",
                                    },
                                    {
                                        key: "confidenceLevel",
                                        label: "Confidence",
                                        value: checkIn.confidenceLevel,
                                        helper: "How ready you feel to repeat it",
                                    },
                                ].map((item) => (
                                    <label key={item.key} style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                                            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{item.label}</span>
                                            <span className="badge badge-blue">{item.value}/10</span>
                                        </div>
                                        <input
                                            className="input"
                                            type="range"
                                            min={0}
                                            max={10}
                                            value={item.value}
                                            onChange={(event) => updateCheckInField(item.key as "painLevel" | "difficultyLevel" | "confidenceLevel", Number(event.target.value))}
                                            style={{ height: "28px", padding: 0, background: "transparent" }}
                                        />
                                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.3 }}>
                                            {item.helper}
                                        </div>
                                    </label>
                                ))}
                            </div>

                            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                                    <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Notes for your doctor</span>
                                    <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Optional</span>
                                </div>
                                <textarea
                                    className="input"
                                    value={checkIn.note}
                                    onChange={(event) => setCheckIn((current) => ({ ...current, note: event.target.value }))}
                                    placeholder="Any pain, stiffness, or issues you want your doctor to know?"
                                    style={{ minHeight: "86px", resize: "vertical", paddingTop: "10px", width: "100%", minWidth: 0 }}
                                />
                            </label>

                            {error && (
                                <div style={{ padding: "10px 12px", borderRadius: "12px", backgroundColor: "#FEE2E2", color: "#991B1B", fontSize: "13px" }}>
                                    {error}
                                </div>
                            )}

                            {checkInMessage && (
                                <div style={{ padding: "10px 12px", borderRadius: "12px", backgroundColor: "#DCFCE7", color: "#166534", fontSize: "13px" }}>
                                    {checkInMessage}
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
                                <button className="btn btn-secondary" type="button" onClick={handleCloseCheckIn}>
                                    Close
                                </button>
                                <button className="btn btn-primary" onClick={handleSubmitCheckIn} disabled={isSubmittingCheckIn} style={{ minWidth: "150px", height: "40px" }}>
                                    {isSubmittingCheckIn ? "Saving..." : "Submit Check-in"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function speakLiveCoaching(message: string): void {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));
}

function stopLiveCoachingPlayback(): void {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
}

function formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getPreferredMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
        "video/webm;codecs=vp8",
        "video/webm;codecs=vp9",
        "video/webm",
        "video/mp4",
    ];
    for (const candidate of candidates) {
        if (MediaRecorder.isTypeSupported(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSideArmsRaiseGuidance } from "@/hooks/use-side-arms-raise-guidance";
import { supportsSideArmsRaiseGuidance } from "@/lib/pose/side-arms-raise-guidance";
import { ExerciseKeyPointFigure } from "./exercise-key-point-figure";
import { formatScore } from "@/lib/score";
import { Button } from "@/components/ui/button";
import {
    Camera,
    CheckCircle2,
    CircleStop,
    Clock3,
    LoaderCircle,
    RotateCcw,
    Sparkles,
    Video,
    X,
} from "lucide-react";

interface CameraRecorderProps {
    exerciseName?: string;
    exerciseId: string;
    assignmentId?: string;
    targetDurationSeconds?: number | null;
    minimumDurationSeconds?: number | null;
    onSave?: (blob: Blob) => void;
}

const MAX_RECORDING_SECONDS = 20;
const LIVE_COACHING_COOLDOWN_MS = 7_000;
const GUIDANCE_MESSAGES_TO_SKIP = new Set([
    "Preparing live guidance...",
    "Preparing live guidance…",
]);

export function CameraRecorder({ exerciseName = "Exercise", exerciseId, assignmentId, targetDurationSeconds, minimumDurationSeconds, onSave}: CameraRecorderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
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

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const blobRef = useRef<Blob | null>(null);
    const recordingStartedAtRef = useRef(0);
    const recordingDurationSecondsRef = useRef(0);
    const clientSessionIdRef = useRef("");
    const liveGuidanceFeedbackRef = useRef<string[]>([]);
    const isRecordingRef = useRef(false);
    const lastLiveCoachingAtRef = useRef(0);
    const liveCoachingRequestIdRef = useRef(0);
    const liveGuidanceEnabled =
        isOpen &&
        Boolean(stream) &&
        !recordedUrl &&
        supportsSideArmsRaiseGuidance(exerciseName);
    const liveGuidance = useSideArmsRaiseGuidance(
        liveGuidanceEnabled,
        videoRef,
    );
    const recordingLimitSeconds = Math.min(300, Math.max(MAX_RECORDING_SECONDS, targetDurationSeconds ?? 0, minimumDurationSeconds ?? 0));

    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
        if (!isRecording) return;

        recordingTimerRef.current = setInterval(() => {
            setRecordingElapsedSeconds(
                Math.min(
                    recordingLimitSeconds,
                    Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)),
                ),
            );
        }, 250);

        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        };
    }, [isRecording, recordingLimitSeconds]);

    useEffect(() => {
        return () => {
            if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        };
    }, [recordedUrl]);

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
    }, [isRecording, liveGuidance.message, liveGuidance.status]);

    useEffect(() => {
        if (!isRecording || !assignmentId || liveGuidance.status !== "ready") {
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

        api.requestLiveCoaching(exerciseId, assignmentId, event)
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
                speakLiveCoaching(response.message);
            })
            .catch((coachingError: unknown) => {
                console.warn(
                    "Failed to load live coaching:",
                    getErrorMessage(coachingError, "Unknown error"),
                );
            });
    }, [
        assignmentId,
        exerciseId,
        isRecording,
        liveGuidance.justCompletedRepetition,
        liveGuidance.resolvedIssues,
        liveGuidance.status,
    ]);

    // Clean up streams on unmount or close
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
            }
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        };
    }, [stream]);

    const startCamera = async () => {
        setError(null);
        setRecordedUrl(null);
        setIsCameraStarting(true);
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
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err: unknown) {
            console.error("Error accessing camera:", err);
            setError(
                "Could not access your front camera. Please check your camera permissions and ensure no other application is using it."
            );
        } finally {
            setIsCameraStarting(false);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
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
        setCountdown(null);
        setIsRecording(false);
        setIsCameraStarting(false);
        setRecordingElapsedSeconds(0);
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
        if (!stream) return;
        chunksRef.current = [];
        setRecordingElapsedSeconds(0);
        liveGuidanceFeedbackRef.current = [];
        setLiveCoachingMessage(null);
        liveCoachingRequestIdRef.current += 1;
        lastLiveCoachingAtRef.current = 0;

        try {
            const options = { mimeType: "video/webm;codecs=vp9" };
            let recorder: MediaRecorder;
            try {
                recorder = new MediaRecorder(stream, options);
            } catch {
                // Fallback for browsers that don't support VP9
                recorder = new MediaRecorder(stream);
            }

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                if (assignmentId) {
                    void api.stopExerciseActivity(assignmentId).catch(() => undefined);
                }
                if (recordingTimeoutRef.current) {
                    clearTimeout(recordingTimeoutRef.current);
                    recordingTimeoutRef.current = null;
                }
                const mimeType = recorder.mimeType || "video/webm";
                recordingDurationSecondsRef.current = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
                setRecordingElapsedSeconds(recordingDurationSecondsRef.current);
                const blob = new Blob(chunksRef.current, { type: mimeType });
                blobRef.current = blob;
                const url = URL.createObjectURL(blob);
                setRecordedUrl(url);
                stopCamera();
                if (onSave) {
                    onSave(blob);
                }
            };

            mediaRecorderRef.current = recorder;
            recordingStartedAtRef.current = Date.now();
            clientSessionIdRef.current = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            recorder.start(); // Start recording without timeslice for maximum stability
            setIsRecording(true);
            if (assignmentId) {
                void api.startExerciseActivity(assignmentId).catch(() => undefined);
            }
            recordingTimeoutRef.current = setTimeout(() => {
                if (recorder.state === "recording") {
                    liveCoachingRequestIdRef.current += 1;
                    recorder.stop();
                    setIsRecording(false);
                }
            }, recordingLimitSeconds * 1000);
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
        if (mediaRecorderRef.current && isRecording) {
            liveCoachingRequestIdRef.current += 1;
            stopLiveCoachingPlayback();
            mediaRecorderRef.current.stop();
            setIsRecording(false);
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
            const res = await api.evaluateExercise(exerciseId, assignmentId, blobRef.current, recordingDurationSecondsRef.current, clientSessionIdRef.current);
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

    const recorderPhase = error
        ? "Camera unavailable"
        : isEvaluating
          ? "Analyzing movement"
          : recordedUrl
            ? "Ready to review"
            : countdown !== null
              ? `Starting in ${countdown}`
              : isRecording
                ? "Recording in progress"
                : isCameraStarting
                  ? "Starting camera"
                  : stream
                    ? "Camera ready"
                    : "Waiting for camera";
    const recorderPhaseTone = error
        ? "error"
        : isRecording
          ? "recording"
          : recordedUrl
            ? "review"
            : "ready";
    const recordingProgress = Math.min(
        100,
        (recordingElapsedSeconds / recordingLimitSeconds) * 100,
    );

    return (
        <>
            <Button onClick={handleOpen} size="lg" className="camera-launch-button">
                <Video data-icon="inline-start" />
                Start Exercise
            </Button>

            {isOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(3, 15, 14, 0.78)",
                        backdropFilter: "blur(10px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "clamp(10px, 2vw, 24px)",
                    }}
                    onClick={handleClose}
                >
                    <div
                        className="card animate-slide-up"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="exercise-recorder-title"
                        style={{
                            width: "100%",
                            maxWidth: "1080px",
                            height: "min(780px, calc(100dvh - 32px))",
                            maxHeight: "calc(100dvh - 20px)",
                            backgroundColor: "var(--color-surface)",
                            overflow: "hidden",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                            borderRadius: "20px",
                            border: "1px solid rgba(255, 255, 255, 0.28)",
                            boxShadow: "0 28px 90px rgba(3, 15, 14, 0.36)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            style={{
                                padding: "18px 20px",
                                borderBottom: "1px solid var(--color-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "16px",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                                <span className="recorder-header-icon" aria-hidden="true">
                                    <Video size={20} />
                                </span>
                                <div style={{ minWidth: 0 }}>
                                    <div className="recorder-eyebrow">Exercise recording</div>
                                    <h3 id="exercise-recorder-title" style={{ fontSize: "18px", fontWeight: 750, margin: 0, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {exerciseName}
                                    </h3>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                                <div className={`recorder-phase recorder-phase-${recorderPhaseTone}`} aria-live="polite">
                                    <span className="recorder-phase-dot" />
                                    {recorderPhase}
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleClose}
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Close recorder"
                                    disabled={isEvaluating}
                                >
                                    <X />
                                </Button>
                            </div>
                        </div>

                        <div className="recorder-prep-bar">
                            <span><Camera size={16} /> Keep your full body visible</span>
                            <span><Clock3 size={16} /> Up to {formatRecordingTime(recordingLimitSeconds)}</span>
                            <span><Sparkles size={16} /> Review before submitting</span>
                        </div>

                        {/* Video Feed Workspace */}
                        <div className={`recorder-workspace ${liveGuidanceEnabled ? "recorder-workspace-with-guidance" : ""}`}>
                            <div
                                className="recorder-video-stage"
                                style={{
                                    position: "relative",
                                    backgroundColor: "#061311",
                                    width: "100%",
                                    flex: "1 1 0",
                                    minHeight: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                            {error ? (
                                <div className="recorder-empty-state" role="alert">
                                    <span className="recorder-empty-icon recorder-empty-icon-error">
                                        <Camera size={28} />
                                    </span>
                                    <h4>We could not start your camera</h4>
                                    <p>{error}</p>
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
                                <div className="recorder-preview">
                                    <video
                                        src={recordedUrl}
                                        controls
                                        className="recorder-video"
                                    />
                                    <div className="recorder-preview-label">
                                        <CheckCircle2 size={15} />
                                        Captured · {formatRecordingTime(recordingElapsedSeconds)}
                                    </div>
                                    {isEvaluating && (
                                        <div className="recorder-analyzing-overlay">
                                            <LoaderCircle className="recorder-spin" size={38} />
                                            <div>
                                                <strong>Analyzing your movement</strong>
                                                <span>This can take a moment. Keep this window open.</span>
                                            </div>
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
                                        className="recorder-video"
                                    />
                                    <div className="recorder-frame-guide" aria-hidden="true">
                                        <span />
                                        <span />
                                        <span />
                                        <span />
                                    </div>

                                    {isCameraStarting && (
                                        <div className="recorder-analyzing-overlay">
                                            <LoaderCircle className="recorder-spin" size={34} />
                                            <div>
                                                <strong>Starting your camera</strong>
                                                <span>Approve camera access if your browser asks.</span>
                                            </div>
                                        </div>
                                    )}

                                    {liveGuidanceEnabled && (
                                        <>
                                            <div className="live-guidance-pill">
                                                <span
                                                    className={`live-guidance-status live-guidance-status-${liveGuidance.status}`}
                                                />
                                                Live guidance
                                            </div>
                                            {liveCoachingMessage && (
                                                <div
                                                    aria-live="polite"
                                                    className="live-coaching-message"
                                                >
                                                    {liveCoachingMessage}
                                                </div>
                                            )}
                                            <div
                                                aria-live="polite"
                                                className={`live-guidance-cue ${liveGuidance.justCompletedRepetition ? "live-guidance-cue-complete" : ""}`}
                                            >
                                                <div>{liveGuidance.message}</div>
                                                {liveGuidance.status === "ready" && (
                                                    <div className="live-guidance-repetitions">
                                                        Detected repetitions: {liveGuidance.repetitions}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* Recording Status Overlay */}
                                    {isRecording && (
                                        <div className="recorder-live-badge">
                                            <span className="recorder-live-dot" />
                                            REC&nbsp;&nbsp;{formatRecordingTime(recordingElapsedSeconds)} / {formatRecordingTime(recordingLimitSeconds)}
                                        </div>
                                    )}

                                    {/* Countdown Timer Overlay */}
                                    {countdown !== null && (
                                        <div className="recorder-countdown">
                                            <div key={countdown}>{countdown}</div>
                                            <span>Get ready</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Action Footer */}
                        <div className="recorder-progress" aria-hidden={!isRecording}>
                            <span style={{ width: `${isRecording ? recordingProgress : 0}%` }} />
                            </div>
                            {liveGuidanceEnabled && (
                                <aside className="recorder-guidance-sidebar" aria-label="Live body position guidance">
                                    <ExerciseKeyPointFigure points={liveGuidance.keyPoints} />
                                </aside>
                            )}
                        </div>

                        <div className="recorder-actions">
                            <div className="recorder-action-copy">
                                <strong>
                                    {error
                                        ? "Camera access is needed"
                                        : recordedUrl
                                          ? "Review before sending"
                                          : isRecording
                                            ? "Your session is recording"
                                            : countdown !== null
                                              ? "Move into position"
                                              : "Ready when you are"}
                                </strong>
                                <span>
                                    {error
                                        ? "Check browser permission, then try again."
                                        : recordedUrl
                                          ? "Replay the video or record another attempt."
                                          : isRecording
                                            ? "Move naturally and follow the live guidance."
                                            : countdown !== null
                                              ? "Recording begins automatically after the countdown."
                                              : "A five-second countdown will begin first."}
                                </span>
                            </div>
                            <div className="recorder-action-buttons">
                            {error ? (
                                <Button variant="outline" onClick={startCamera} disabled={isCameraStarting}>
                                    {isCameraStarting ? <LoaderCircle className="recorder-spin" /> : <Camera />}
                                    Try Again
                                </Button>
                            ) : evaluationScore !== null ? (
                                <Button
                                    onClick={() => {
                                        handleClose();
                                        window.location.reload();
                                    }}
                                >
                                    Done
                                </Button>
                            ) : recordedUrl ? (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setRecordedUrl(null);
                                            startCamera();
                                        }}
                                        disabled={isEvaluating}
                                    >
                                        <RotateCcw />
                                        Record Again
                                    </Button>
                                    <Button
                                        onClick={handleEvaluate}
                                        disabled={isEvaluating}
                                    >
                                        {isEvaluating ? <LoaderCircle className="recorder-spin" /> : <Sparkles />}
                                        {isEvaluating ? "Evaluating..." : "Evaluate Session"}
                                    </Button>
                                </>
                            ) : countdown !== null ? (
                                <Button disabled>
                                    Starting in {countdown}s...
                                </Button>
                            ) : isRecording ? (
                                <Button
                                    onClick={stopRecording}
                                    className="recorder-stop-button"
                                >
                                    <CircleStop />
                                    Stop Recording
                                </Button>
                            ) : (
                                <Button
                                    onClick={initiateCountdown}
                                    disabled={!stream || isCameraStarting}
                                >
                                    <Video />
                                    Start Recording
                                </Button>
                            )}
                            </div>
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

function formatRecordingTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.max(0, Math.floor(totalSeconds % 60));
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

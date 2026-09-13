"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSideArmsRaiseGuidance } from "@/hooks/use-side-arms-raise-guidance";
import { getExerciseModelGuidanceConfig } from "@/lib/pose/exercise-model-config";
import { canRecordArm, canSwitchArm, getRecordingTimeState, resolveRecordingSide, type ArmSide } from "@/lib/camera-visit";
import { ExerciseKeyPointFigure } from "./exercise-key-point-figure";
import { formatScore } from "@/lib/score";
import { Button } from "@/components/ui/button";
import {
    Camera,
    CheckCircle2,
    CircleStop,
    LoaderCircle,
    RotateCcw,
    Sparkles,
    Video,
    Volume2,
    VolumeX,
} from "lucide-react";

interface CameraRecorderProps {
    exerciseName?: string;
    analysisModelKey?: string | null;
    exerciseId: string;
    assignmentId?: string;
    targetDurationSeconds?: number | null;
    minimumDurationSeconds?: number | null;
    onSave?: (blob: Blob) => void;
}

type RecordedClip = {
    side?: ArmSide;
    blob: Blob;
    url: string;
    durationSeconds: number;
    clientSessionId: string;
    guidanceFeedback: string[];
};
type ClipResult = { clientSessionId: string; side?: ArmSide; sessionId: string; score: number; adherenceQualified: boolean; qualificationReason?: string | null };

const LIVE_COACHING_COOLDOWN_MS = 7_000;
const LIVE_GUIDANCE_SPEECH_COOLDOWN_MS = 2_500;
const MAX_AI_COACHING_SPEECH_LATENCY_MS = 5_000;
const LIVE_VOICE_STORAGE_KEY = "medirehab-live-voice-enabled";
const GUIDANCE_MESSAGES_TO_SKIP = new Set([
    "Preparing live guidance...",
    "Preparing live guidance…",
]);

const currentTimeMs = () => Date.now();

type CameraAccessIssue =
    | "consent"
    | "permission"
    | "unavailable"
    | "verification"
    | null;

export function CameraRecorder({ exerciseName = "Exercise", analysisModelKey, exerciseId, assignmentId, targetDurationSeconds, minimumDurationSeconds, onSave}: CameraRecorderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [recordedClips, setRecordedClips] = useState<RecordedClip[]>([]);
    const [reviewClipKey, setReviewClipKey] = useState<string | null>(null);
    const [clipResults, setClipResults] = useState<ClipResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [cameraAccessIssue, setCameraAccessIssue] = useState<CameraAccessIssue>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evaluationScore, setEvaluationScore] = useState<number | null>(null);
    const [sessionIds, setSessionIds] = useState<string[]>([]);
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
    const [selectedSide, setSelectedSide] = useState<ArmSide | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const modelGuidance = getExerciseModelGuidanceConfig(analysisModelKey);
    const isSideSelectable = modelGuidance?.selectableSide ?? false;
    const targetSide = resolveRecordingSide(modelGuidance, selectedSide);
    const recordedUrl = recordedClips.find((clip) => (clip.side ?? "both") === reviewClipKey)?.url ?? null;
    const selectedReviewClip = recordedClips.find((clip) => (clip.side ?? "both") === reviewClipKey);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const clipUrlsRef = useRef<Set<string>>(new Set());
    const stopDispositionRef = useRef<"review" | "switch">("review");
    const discardRecordingRef = useRef(false);
    const recordingSideRef = useRef<ArmSide | undefined>(undefined);
    const visitIdRef = useRef<string | null>(null);
    const recordingStartedAtRef = useRef(0);
    const recordingDurationSecondsRef = useRef(0);
    const clientSessionIdRef = useRef("");
    const liveGuidanceFeedbackRef = useRef<string[]>([]);
    const isRecordingRef = useRef(false);
    const lastLiveCoachingAtRef = useRef(0);
    const liveCoachingRequestIdRef = useRef(0);
    const lastSpokenMessageRef = useRef("");
    const lastSpokenAtRef = useRef(0);
    const isVoiceEnabledRef = useRef(true);
    const isPreviewing = isOpen && Boolean(stream) && !isRecording && countdown === null && !recordedUrl;
    const liveGuidanceEnabled =
        isOpen &&
        Boolean(stream) &&
        !recordedUrl &&
        Boolean(modelGuidance) &&
        (!isSideSelectable || targetSide !== null);
    const liveGuidance = useSideArmsRaiseGuidance(
        liveGuidanceEnabled,
        videoRef,
        modelGuidance?.guidanceName ?? exerciseName,
        targetSide ?? "left",
        isRecording ? "exercise" : "framing",
    );

    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            try {
                const savedPreference = window.localStorage.getItem(LIVE_VOICE_STORAGE_KEY);
                if (savedPreference === "false") {
                    isVoiceEnabledRef.current = false;
                    setIsVoiceEnabled(false);
                }
            } catch {
                // Voice still works when browser storage is unavailable.
            }
        });

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => {
        if (
            (!isRecording && !isPreviewing) ||
            !isVoiceEnabled ||
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
            now - lastSpokenAtRef.current >= LIVE_GUIDANCE_SPEECH_COOLDOWN_MS
        ) {
            lastSpokenMessageRef.current = liveGuidance.message;
            lastSpokenAtRef.current = now;
            speakLiveCoaching(liveGuidance.message);
        }
    }, [isPreviewing, isRecording, isVoiceEnabled, liveGuidance.message, liveGuidance.status]);

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
        const requestedAt = Date.now();

        if (assignmentId) {
            api.requestLiveCoaching(exerciseId, assignmentId, event, targetSide ?? undefined)
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
                    if (
                        isVoiceEnabledRef.current &&
                        Date.now() - requestedAt <= MAX_AI_COACHING_SPEECH_LATENCY_MS &&
                        !isLiveCoachingPlaybackActive()
                    ) {
                        lastSpokenMessageRef.current = response.message;
                        lastSpokenAtRef.current = Date.now();
                        speakLiveCoaching(response.message);
                    }
                })
                .catch(() => {
                    if (liveCoachingRequestIdRef.current !== requestId || !isRecordingRef.current) return;
                    const fallbackMsg = event === "repetition_completed"
                        ? (targetSide ? `Great control on that repetition on your ${targetSide} arm.` : "Great control on that repetition.")
                        : "Nice adjustment. Keep moving with steady control.";
                    setLiveCoachingMessage(fallbackMsg);
                    if (isVoiceEnabledRef.current) {
                        lastSpokenMessageRef.current = fallbackMsg;
                        lastSpokenAtRef.current = Date.now();
                        speakLiveCoaching(fallbackMsg);
                    }
                });
        } else {
            const fallbackMsg = event === "repetition_completed"
                ? (targetSide ? `Great control on that repetition on your ${targetSide} arm.` : "Great control on that repetition.")
                : "Nice adjustment. Keep moving with steady control.";
            queueMicrotask(() => {
                if (!isRecordingRef.current) return;
                setLiveCoachingMessage(fallbackMsg);
                if (isVoiceEnabledRef.current) {
                    lastSpokenMessageRef.current = fallbackMsg;
                    lastSpokenAtRef.current = Date.now();
                    speakLiveCoaching(fallbackMsg);
                }
            });
        }
    }, [
        assignmentId,
        exerciseId,
        isRecording,
        targetSide,
        liveGuidance.justCompletedRepetition,
        liveGuidance.resolvedIssues,
        liveGuidance.status,
    ]);

    // Clean up resources only when the recorder unmounts. Tying this cleanup to
    // stream changes clears a newly started countdown as soon as the camera connects.
    useEffect(() => {
        const clipUrls = clipUrlsRef.current;
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
            if (elapsedIntervalRef.current) {
                clearInterval(elapsedIntervalRef.current);
            }
            for (const url of clipUrls) URL.revokeObjectURL(url);
            clipUrls.clear();
        };
    }, []);

    useEffect(() => {
        if (videoRef.current && stream && !error && !recordedUrl) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, error, recordedUrl]);

    const startCamera = async (): Promise<MediaStream | null> => {
        setError(null);
        setCameraAccessIssue(null);
        setReviewClipKey(null);
        setLiveCoachingMessage(null);
        setIsFinalizingRecording(false);
        setIsCameraStarting(true);
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraAccessIssue("unavailable");
                setError("Camera access is not available here. Open MediRehab on HTTPS or localhost in a browser that supports camera recording.");
                return null;
            }

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
            return mediaStream;
        } catch (err: unknown) {
            console.error("Error accessing camera:", err);
            const errorName = err instanceof DOMException ? err.name : "";

            if (errorName === "NotAllowedError" || errorName === "SecurityError") {
                setCameraAccessIssue("permission");
                setError("Camera access is blocked. Click reconnect and allow the browser prompt. If no prompt appears, use the camera or lock icon in the address bar to allow access for this site.");
            } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
                setCameraAccessIssue("unavailable");
                setError("No camera was found. Connect or enable a camera, then click reconnect.");
            } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
                setCameraAccessIssue("unavailable");
                setError("Your camera is busy or unavailable. Close other apps using it, then click reconnect.");
            } else {
                setCameraAccessIssue("unavailable");
                setError("Could not access your camera. Check the browser permission and make sure another application is not using it, then reconnect.");
            }
            return null;
        } finally {
            setIsCameraStarting(false);
        }
    };

    const handleStartCamera = async () => {
        if (isCameraStarting) return;
        if (streamRef.current?.getVideoTracks().some((track) => track.readyState === "live")) {
            setError(null);
            setCameraAccessIssue(null);
            return;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setStream(null);
        }

        setIsCameraStarting(true);
        setError(null);
        setCameraAccessIssue(null);
        try {
            const { consent } = await api.getMyConsent();
            if (!consent.privacyConsentAt || !consent.recordingConsentAt) {
                setCameraAccessIssue("consent");
                setError("Before using the camera, allow MediRehab to process your rehabilitation data and record exercises for evaluation. The camera starts in preview mode; recording begins only when you press Start Recording. You can revoke consent later in Profile.");
                return;
            }
            await startCamera();
        } catch {
            setCameraAccessIssue("verification");
            setError("Unable to verify camera consent. Please try again.");
        } finally {
            setIsCameraStarting(false);
        }
    };

    const handleCameraRecovery = async () => {
        if (isCameraStarting) return;
        if (cameraAccessIssue !== "consent") {
            await handleStartCamera();
            return;
        }

        setIsCameraStarting(true);
        setError(null);
        try {
            await api.updateMyConsent(true, true);
            await startCamera();
        } catch {
            setCameraAccessIssue("verification");
            setError("Unable to save camera consent. Please try again or update it in Profile.");
        } finally {
            setIsCameraStarting(false);
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

    const handleOpen = () => {
        setError(null);
        setCameraAccessIssue(null);
        discardRecordingRef.current = false;
        visitIdRef.current = crypto.randomUUID();
        setSelectedSide(null);
        setIsOpen(true);
    };

    const handleClose = () => {
        discardRecordingRef.current = true;
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
        isRecordingRef.current = false;
        stopCamera();
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
        if (elapsedIntervalRef.current) {
            clearInterval(elapsedIntervalRef.current);
            elapsedIntervalRef.current = null;
        }
        setElapsedSeconds(0);
        setCountdown(null);
        setIsRecording(false);
        setIsFinalizingRecording(false);
        setIsCameraStarting(false);
        setIsOpen(false);
        setError(null);
        setCameraAccessIssue(null);
        for (const url of clipUrlsRef.current) URL.revokeObjectURL(url);
        clipUrlsRef.current.clear();
        setRecordedClips([]);
        setReviewClipKey(null);
        setClipResults([]);
        setIsEvaluating(false);
        setEvaluationScore(null);
        setSessionIds([]);
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
        lastSpokenMessageRef.current = "";
        lastSpokenAtRef.current = 0;
        stopLiveCoachingPlayback();
        liveGuidanceFeedbackRef.current = [];
        visitIdRef.current = null;
    };

    const initiateCountdown = (cameraStream: MediaStream | null = stream) => {
        if (!cameraStream) return;
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        if (modelGuidance && isVoiceEnabledRef.current) {
            primeLiveCoachingVoice();
        }
        let remaining = 5;
        setCountdown(remaining);

        countdownIntervalRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                }
                setCountdown(null);
                startRecording();
                return;
            }
            setCountdown(remaining);
        }, 1000);
    };

    const handleStartRecording = () => {
        const activeStream = streamRef.current ?? stream;
        if (!activeStream || isCameraStarting || countdown !== null || isRecording) return;
        if (isSideSelectable && !targetSide) {
            setError("Choose the left or right arm before recording.");
            return;
        }
        if (!canRecordArm(modelGuidance, selectedSide, recordedClips.map((clip) => clip.side))) {
            setError("This arm is already recorded. Review or retake its clip first.");
            return;
        }
        setError(null);
        initiateCountdown(activeStream);
    };

    const startRecording = () => {
        const activeStream = streamRef.current || stream;
        if (!activeStream) return;
        chunksRef.current = [];
        setIsFinalizingRecording(false);
        liveGuidanceFeedbackRef.current = [];
        setLiveCoachingMessage(null);
        stopDispositionRef.current = "review";
        recordingSideRef.current = targetSide ?? undefined;
        liveCoachingRequestIdRef.current += 1;
        lastLiveCoachingAtRef.current = 0;
        lastSpokenMessageRef.current = "";
        lastSpokenAtRef.current = 0;

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
                    isRecordingRef.current = false;
                    liveCoachingRequestIdRef.current += 1;
                    stopLiveCoachingPlayback();
                    if (assignmentId) {
                        void api.stopExerciseActivity(assignmentId).catch(() => undefined);
                    }
                    if (elapsedIntervalRef.current) {
                        clearInterval(elapsedIntervalRef.current);
                        elapsedIntervalRef.current = null;
                    }
                    setIsRecording(false);
                    if (discardRecordingRef.current) return;
                    const mimeType = recorder.mimeType || "video/webm";
                    recordingDurationSecondsRef.current = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
                    setElapsedSeconds(recordingDurationSecondsRef.current);
                    const blob = new Blob(chunksRef.current, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    clipUrlsRef.current.add(url);
                    const clip: RecordedClip = {
                        side: recordingSideRef.current,
                        blob,
                        url,
                        durationSeconds: recordingDurationSecondsRef.current,
                        clientSessionId: clientSessionIdRef.current,
                        guidanceFeedback: [...liveGuidanceFeedbackRef.current],
                    };
                    setRecordedClips((current) => [...current, clip]);
                    setIsFinalizingRecording(false);
                    if (stopDispositionRef.current === "switch" && clip.side) {
                        setSelectedSide(clip.side === "left" ? "right" : "left");
                        setElapsedSeconds(0);
                        setLiveCoachingMessage(null);
                        lastSpokenMessageRef.current = "";
                        lastSpokenAtRef.current = 0;
                    } else {
                        setReviewClipKey(clip.side ?? "both");
                        stopCamera();
                    }
                    if (onSave) {
                        onSave(blob);
                    }
                } catch (err) {
                    console.error("Error finalizing recording:", err);
                    setError("Failed to finalize video recording.");
                    setIsFinalizingRecording(false);
                }
            };

            mediaRecorderRef.current = recorder;
            recordingStartedAtRef.current = currentTimeMs();
            setElapsedSeconds(0);
            if (elapsedIntervalRef.current) {
                clearInterval(elapsedIntervalRef.current);
            }
            elapsedIntervalRef.current = setInterval(() => {
                setElapsedSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
            }, 250);

            clientSessionIdRef.current = crypto.randomUUID();
            recorder.start(1000); // 1000ms timeslice to flush chunks periodically
            setIsRecording(true);
            if (assignmentId) {
                void api.startExerciseActivity(assignmentId).catch(() => undefined);
            }

        } catch (err) {
            console.error("Failed to start recording:", err);
            if (elapsedIntervalRef.current) {
                clearInterval(elapsedIntervalRef.current);
                elapsedIntervalRef.current = null;
            }
            setError("Failed to initialize video recording.");
        }
    };

    const stopRecording = () => {
        if (elapsedIntervalRef.current) {
            clearInterval(elapsedIntervalRef.current);
            elapsedIntervalRef.current = null;
        }
        liveCoachingRequestIdRef.current += 1;
        stopLiveCoachingPlayback();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try {
                setIsFinalizingRecording(true);
                mediaRecorderRef.current.stop();
            } catch (err) {
                console.error("Error stopping media recorder:", err);
                setIsFinalizingRecording(false);
            }
        }
    };

    const handleSwitchArm = () => {
        if (!isRecording || isFinalizingRecording || !canSwitchArm(modelGuidance, targetSide, recordedClips.map((clip) => clip.side))) return;
        stopDispositionRef.current = "switch";
        stopRecording();
    };

    const handleRetakeClip = async () => {
        if (!selectedReviewClip || clipResults.some((result) => result.clientSessionId === selectedReviewClip.clientSessionId)) return;
        URL.revokeObjectURL(selectedReviewClip.url);
        clipUrlsRef.current.delete(selectedReviewClip.url);
        setRecordedClips((current) => current.filter((clip) => clip.clientSessionId !== selectedReviewClip.clientSessionId));
        setSelectedSide(selectedReviewClip.side ?? null);
        setReviewClipKey(null);
        await handleStartCamera();
    };

    const handleReviewSavedClips = () => {
        const clip = recordedClips[0];
        if (!clip || isRecording || isFinalizingRecording) return;
        stopCamera();
        setReviewClipKey(clip.side ?? "both");
    };

    const handleEvaluate = async () => {
        if (recordedClips.length === 0) return;
        if (!assignmentId) {
            setError("No assignment ID provided to evaluate.");
            return;
        }
        setIsEvaluating(true);
        setError(null);
        try {
            const results = [...clipResults];
            for (const clip of recordedClips) {
                if (results.some((result) => result.clientSessionId === clip.clientSessionId)) continue;
                const res = await api.evaluateExercise(
                    exerciseId,
                    assignmentId,
                    clip.blob,
                    clip.durationSeconds,
                    clip.clientSessionId,
                    clip.side,
                    isSideSelectable ? visitIdRef.current ?? undefined : undefined,
                );
                if (!res.success) throw new Error(res.message || "Unable to evaluate this arm.");
                results.push({
                    clientSessionId: clip.clientSessionId,
                    side: clip.side,
                    sessionId: res.sessionId,
                    score: res.score,
                    adherenceQualified: res.adherenceQualified,
                    qualificationReason: res.qualificationReason,
                });
                setClipResults([...results]);
                const sessionFeedback = [
                    ...(res.feedback ?? []),
                    ...clip.guidanceFeedback,
                ].filter((message, index, messages) => messages.indexOf(message) === index);

                if (sessionFeedback.length > 0) {
                    try {
                        await api.updateSessionFeedback(res.sessionId, sessionFeedback);
                    } catch (feedbackError: unknown) {
                        console.warn(
                            "Failed to save live guidance feedback:",
                            getErrorMessage(feedbackError, "Unknown error"),
                        );
                    }
                }
            }
            setSessionIds(results.map((result) => result.sessionId));
            setEvaluationScore(results[0]?.score ?? null);
            setQualificationReason(results.some((result) => result.adherenceQualified)
                ? null
                : results.map((result) => result.qualificationReason).filter(Boolean).join(" ") || "This visit did not meet the prescribed qualification rules.");
            setIsOpen(false);
            setIsCheckInOpen(true);
        } catch (err: unknown) {
            const message = getErrorMessage(err, "An error occurred during evaluation. Saved arm results will not be sent again; please retry.");
            console.warn("Evaluation request failed:", message);
            setError(message);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleSubmitCheckIn = async () => {
        if (sessionIds.length === 0) {
            setError("No session was created for this exercise.");
            return;
        }

        setIsSubmittingCheckIn(true);
        setError(null);

        try {
            for (const id of sessionIds) await api.submitCheckIn(id, checkIn);
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
        handleClose();
        window.location.reload();
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

    const handleVoiceToggle = () => {
        const nextValue = !isVoiceEnabled;
        isVoiceEnabledRef.current = nextValue;
        setIsVoiceEnabled(nextValue);

        try {
            window.localStorage.setItem(LIVE_VOICE_STORAGE_KEY, String(nextValue));
        } catch {
            // Keep the in-memory preference when browser storage is unavailable.
        }

        if (nextValue) {
            speakLiveCoaching("Voice coaching is on.");
        } else {
            stopLiveCoachingPlayback();
        }
    };

    const recordingTime = getRecordingTimeState(elapsedSeconds, targetDurationSeconds, minimumDurationSeconds);
    const recordingProgress = recordingTime.progress;

    return (
        <>
            <Button onClick={handleOpen} size="lg" className="camera-launch-button" disabled={!modelGuidance}>
                <Video data-icon="inline-start" />
                Start Exercise
            </Button>
            {!modelGuidance && (
                <span role="status" className="camera-model-unavailable">
                    Video evaluation is not available for this exercise. Ask your doctor for help.
                </span>
            )}

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
                                padding: "14px 20px",
                                borderBottom: "1px solid var(--color-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                                flexWrap: "wrap",
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
                                            aria-pressed={selectedSide === "left"}
                                            disabled={isRecording || isEvaluating || isFinalizingRecording || countdown !== null || Boolean(recordedUrl) || recordedClips.some((clip) => clip.side === "left")}
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
                                            aria-pressed={selectedSide === "right"}
                                            disabled={isRecording || isEvaluating || isFinalizingRecording || countdown !== null || Boolean(recordedUrl) || recordedClips.some((clip) => clip.side === "right")}
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

                                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                                    {targetDurationSeconds ? `Time goal: ${formatTime(targetDurationSeconds)}${isSideSelectable ? " per arm" : ""}` : "No prescribed time goal"}
                                    {minimumDurationSeconds ? ` · Minimum to count: ${formatTime(minimumDurationSeconds)}` : ""}
                                </span>

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
                            {error && cameraAccessIssue ? (
                                <div className="recorder-empty-state" role="alert">
                                    <button
                                        type="button"
                                        className="recorder-camera-reconnect"
                                        onClick={handleCameraRecovery}
                                        disabled={isCameraStarting}
                                        aria-label={cameraAccessIssue === "consent" ? "Agree and allow camera access" : "Reconnect camera"}
                                    >
                                        <span className="recorder-empty-icon recorder-empty-icon-error">
                                            {isCameraStarting
                                                ? <LoaderCircle className="recorder-spin" size={28} />
                                                : <Camera size={28} />}
                                        </span>
                                        <h4>{cameraAccessIssue === "consent" ? "Allow camera access" : "We could not start your camera"}</h4>
                                        <p>{error}</p>
                                        <span className="recorder-reconnect-label">
                                            {cameraAccessIssue === "consent" ? "I agree — turn on camera" : "Reconnect camera"}
                                        </span>
                                    </button>
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
                                        {selectedReviewClip?.side ? `${selectedReviewClip.side === "left" ? "Left" : "Right"} arm · ` : ""}Captured · {formatRecordingTime(selectedReviewClip?.durationSeconds ?? 0)}
                                    </div>
                                    {minimumDurationSeconds && selectedReviewClip && selectedReviewClip.durationSeconds < minimumDurationSeconds && (
                                        <div className="recorder-review-warning" role="status">
                                            Shorter than the {formatTime(minimumDurationSeconds)} minimum; this arm may not count.
                                        </div>
                                    )}
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

                                    {!stream && !isRecording && countdown === null && !isCameraStarting && (
                                        <button
                                            type="button"
                                            className="recorder-center-start"
                                            onClick={handleStartCamera}
                                            aria-label="Turn on camera to preview your position"
                                        >
                                            <span className="recorder-start-orb" aria-hidden="true">
                                                <Camera size={34} strokeWidth={1.8} />
                                            </span>
                                            <span className="recorder-start-label">Turn on camera</span>
                                            <span className="recorder-start-helper">Check your position before recording</span>
                                        </button>
                                    )}

                                    {stream && !isRecording && countdown === null && (
                                        <div className="recorder-camera-preview-badge" role="status">
                                            Preview only · Not recording
                                        </div>
                                    )}

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
                                            <button
                                                type="button"
                                                className={`live-guidance-pill ${isVoiceEnabled ? "" : "live-guidance-pill-muted"}`}
                                                onClick={handleVoiceToggle}
                                                aria-pressed={isVoiceEnabled}
                                                aria-label={isVoiceEnabled ? "Mute live voice coaching" : "Enable live voice coaching"}
                                            >
                                                <span
                                                    className={`live-guidance-status live-guidance-status-${liveGuidance.status}`}
                                                />
                                                {isVoiceEnabled ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
                                                {isVoiceEnabled ? "Voice on" : "Voice muted"}
                                            </button>
                                            {isRecording && liveCoachingMessage && (
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
                                                {liveGuidance.status === "ready" && !isPreviewing && (
                                                    <div className="live-guidance-repetitions">
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
                                            {targetDurationSeconds ? (
                                                <span>REC · {formatTime(elapsedSeconds)} / {formatTime(targetDurationSeconds)}</span>
                                            ) : (
                                                <span>REC · {formatTime(elapsedSeconds)}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Arm selection indicator on video feed */}
                                    {targetSide && (
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
                                            {targetSide === "left" ? "Left Arm" : "Right Arm"}
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

                            {liveGuidanceEnabled && (
                                <aside className="recorder-guidance-sidebar" aria-label="Live body position guidance">
                                    <ExerciseKeyPointFigure points={liveGuidance.keyPoints} />
                                </aside>
                            )}

                        {/* Action Footer */}
                        {recordedUrl && recordedClips.length > 1 && (
                            <div className="recorder-clip-tabs" aria-label="Recorded arm clips">
                                {recordedClips.map((clip) => (
                                    <button
                                        type="button"
                                        key={clip.clientSessionId}
                                        className={(clip.side ?? "both") === reviewClipKey ? "recorder-clip-tab-active" : ""}
                                        onClick={() => setReviewClipKey(clip.side ?? "both")}
                                    >
                                        {clip.side === "left" ? "Left arm" : clip.side === "right" ? "Right arm" : "Exercise"} · {formatTime(clip.durationSeconds)}
                                        {clipResults.some((result) => result.clientSessionId === clip.clientSessionId) ? " · Saved" : ""}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="recorder-progress" aria-hidden={!isRecording}>
                            <span style={{ width: `${isRecording ? recordingProgress : 0}%` }} />
                        </div>

                        <div className="recorder-actions">
                            <div className="recorder-action-copy">
                                <strong>
                                    {error && cameraAccessIssue
                                        ? "Camera access is needed"
                                        : recordedUrl
                                          ? "Review before sending"
                                          : isFinalizingRecording
                                            ? "Finishing your recording"
                                            : isRecording
                                            ? "Your session is recording"
                                            : countdown !== null
                                              ? "Move into position"
                                              : stream
                                                ? isSideSelectable && !targetSide ? "Choose an arm" : recordedClips.length > 0 && targetSide ? `${targetSide === "left" ? "Left" : "Right"} arm is next` : "Check your position"
                                              : "Ready when you are"}
                                </strong>
                                <span>
                                    {error && cameraAccessIssue
                                        ? "Check browser permission, then try again."
                                        : recordedUrl
                                          ? "Review each arm before sending. You can retake an unsent clip."
                                          : isFinalizingRecording
                                            ? "Your video will be ready to review shortly."
                                          : isRecording
                                            ? recordingTime.belowMinimum
                                                ? `Minimum to count: ${formatTime(minimumDurationSeconds ?? 0)}. You may stop earlier, but this arm may not count.`
                                                : recordingTime.goalReached
                                                    ? "Time goal reached. Stop when you are ready."
                                                    : "Move naturally and follow the live guidance."
                                            : countdown !== null
                                              ? "Recording begins automatically after the countdown."
                                              : stream
                                                ? isSideSelectable && !targetSide ? "Select Left arm or Right arm above before recording." : recordedClips.length > 0 && targetSide ? "The other arm is saved. Reposition, then tap Start recording—or review the saved arm." : "Make sure your body is visible, then start recording."
                                                : "Turn on your camera to see yourself first."}
                                </span>
                            </div>
                            {error && !cameraAccessIssue && <div role="alert" className="recorder-inline-error">{error}</div>}
                            <div className="recorder-action-buttons">
                            {error && cameraAccessIssue ? (
                                <Button variant="outline" onClick={handleCameraRecovery} disabled={isCameraStarting}>
                                    {isCameraStarting ? <LoaderCircle className="recorder-spin" /> : <Camera />}
                                    {cameraAccessIssue === "consent" ? "Allow Camera" : "Reconnect"}
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
                                        onClick={handleRetakeClip}
                                        disabled={isEvaluating || clipResults.some((result) => result.clientSessionId === selectedReviewClip?.clientSessionId)}
                                    >
                                        <RotateCcw />
                                        Retake This Arm
                                    </Button>
                                    <Button
                                        onClick={handleEvaluate}
                                        disabled={isEvaluating}
                                    >
                                        {isEvaluating ? <LoaderCircle className="recorder-spin" /> : <Sparkles />}
                                        {isEvaluating ? "Evaluating..." : recordedClips.length > 1 ? "Evaluate Both Arms" : "Evaluate Session"}
                                    </Button>
                                </>
                            ) : isFinalizingRecording ? (
                                <Button disabled>
                                    <LoaderCircle className="recorder-spin" />
                                    Finishing...
                                </Button>
                            ) : countdown !== null ? (
                                <Button disabled>
                                    Starting in {countdown}s...
                                </Button>
                            ) : isRecording ? (
                                <>
                                {canSwitchArm(modelGuidance, targetSide, recordedClips.map((clip) => clip.side)) && (
                                    <Button variant="outline" onClick={handleSwitchArm} disabled={isFinalizingRecording}>
                                        Switch arm
                                    </Button>
                                )}
                                <Button
                                    onClick={stopRecording}
                                    className="recorder-stop-button"
                                >
                                    <CircleStop />
                                    Stop Recording
                                </Button>
                                </>
                            ) : stream ? (
                                <>
                                    {recordedClips.length > 0 && (
                                        <Button variant="outline" onClick={handleReviewSavedClips}>
                                            Review saved arm
                                        </Button>
                                    )}
                                    <Button onClick={handleStartRecording} disabled={isSideSelectable && !targetSide}>
                                        <Video />
                                        Start Recording
                                    </Button>
                                </>
                            ) : null}
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
                                        Share a quick self-report for your doctor. {clipResults.map((result) => `${result.side ? `${result.side === "left" ? "Left" : "Right"} arm` : "Exercise"}: ${formatScore(result.score)}/100`).join(" · ")}
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

    const speech = window.speechSynthesis;
    const utterance = createCoachingUtterance(message);
    speech.cancel();
    speech.resume();
    speech.speak(utterance);
}

function primeLiveCoachingVoice(): void {
    if (!("speechSynthesis" in window)) return;

    const speech = window.speechSynthesis;
    speech.cancel();
    speech.resume();
    speech.speak(createCoachingUtterance("Voice coaching is ready."));
}

function createCoachingUtterance(message: string): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "en-US";
    utterance.rate = 1.02;
    utterance.pitch = 1;
    utterance.volume = 1;
    return utterance;
}

function isLiveCoachingPlaybackActive(): boolean {
    return "speechSynthesis" in window
        && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
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

"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSideArmsRaiseGuidance } from "@/hooks/use-side-arms-raise-guidance";
import { getExerciseModelGuidanceConfig } from "@/lib/pose/exercise-model-config";
import { canRecordArm, canSwitchArm, getRecordingTimeState, resolveRecordingSide, type ArmSide } from "@/lib/camera-visit";
import { ExerciseKeyPointFigure } from "./exercise-key-point-figure";
import { RoboticSkeletonOverlay } from "./robotic-skeleton-overlay";
import { FollowAlongVideo } from "./follow-along-video";
import { formatScore } from "@/lib/score";
import { Button } from "@/components/ui/button";
import {
    Camera,
    Check,
    CheckCircle2,
    ChevronDown,
    CircleStop,
    LoaderCircle,
    RotateCcw,
    Scan,
    Sparkles,
    Timer,
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

export function CameraRecorder({ exerciseName = "Exercise", analysisModelKey, exerciseId, assignmentId, targetDurationSeconds, minimumDurationSeconds, onSave }: CameraRecorderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
    const [isSkeletonVisible, setIsSkeletonVisible] = useState(true);
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
    const [selectedTargetDuration, setSelectedTargetDuration] = useState<number | null>(targetDurationSeconds ?? null);
    const [isTimerDropdownOpen, setIsTimerDropdownOpen] = useState(false);
    const [customDurationInput, setCustomDurationInput] = useState<string>(
        targetDurationSeconds && ![20, 30, 60].includes(targetDurationSeconds)
            ? String(targetDurationSeconds)
            : "45",
    );
    const timerDropdownRef = useRef<HTMLDivElement>(null);
    const selectedTargetDurationRef = useRef<number | null>(selectedTargetDuration);

    useEffect(() => {
        selectedTargetDurationRef.current = selectedTargetDuration;
    }, [selectedTargetDuration]);

    useEffect(() => {
        if (targetDurationSeconds !== undefined) {
            setSelectedTargetDuration(targetDurationSeconds);
            if (targetDurationSeconds !== null && ![20, 30, 60].includes(targetDurationSeconds)) {
                setCustomDurationInput(String(targetDurationSeconds));
            }
        }
    }, [targetDurationSeconds]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (timerDropdownRef.current && !timerDropdownRef.current.contains(e.target as Node)) {
                setIsTimerDropdownOpen(false);
            }
        };
        if (isTimerDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isTimerDropdownOpen]);

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
        const resolvedIssueId = liveGuidance.resolvedIssues[0]?.id;
        const now = Date.now();

        if (!event || now - lastLiveCoachingAtRef.current < LIVE_COACHING_COOLDOWN_MS) {
            return;
        }

        lastLiveCoachingAtRef.current = now;
        const requestId = liveCoachingRequestIdRef.current + 1;
        liveCoachingRequestIdRef.current = requestId;
        const requestedAt = Date.now();

        if (assignmentId) {
            api.requestLiveCoaching(exerciseId, assignmentId, event, targetSide ?? undefined, resolvedIssueId)
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
                        : (resolvedIssueId === "torso-leaning" || resolvedIssueId === "chest-sway"
                            ? "Great posture adjustment. Keeping your chest steady helps isolate the shoulder."
                            : "Nice adjustment. Keep moving with steady control.");
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
    }, [stream, error, recordedUrl, isOpen]);

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
        void handleStartCamera();
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
                    const rawMimeType = recorder.mimeType || preferredMimeType || "video/webm";
                    const cleanMimeType = rawMimeType.split(";")[0]?.trim() || "video/webm";
                    recordingDurationSecondsRef.current = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
                    setElapsedSeconds(recordingDurationSecondsRef.current);
                    const blob = new Blob(chunksRef.current, { type: cleanMimeType });
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
                const currentElapsed = Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
                setElapsedSeconds(currentElapsed);

                if (selectedTargetDurationRef.current !== null && currentElapsed >= selectedTargetDurationRef.current) {
                    if (elapsedIntervalRef.current) {
                        clearInterval(elapsedIntervalRef.current);
                        elapsedIntervalRef.current = null;
                    }
                    stopRecording();
                }
            }, 250);

            clientSessionIdRef.current = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            recorder.start(1000);
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
                setIsRecording(false);
            }
        } else {
            setIsRecording(false);
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

    const recordingTime = getRecordingTimeState(elapsedSeconds, selectedTargetDuration, minimumDurationSeconds);
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
                    className="recorder-fullscreen-container animate-fade-in"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="exercise-recorder-title"
                >
                    {/* Full-Screen Video Background Stage */}
                    <div className="recorder-fullscreen-stage">
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
                        ) : recordedUrl ? (
                            /* Post-Recording Preview */
                            <div className="recorder-preview">
                                <video
                                    key={recordedUrl}
                                    src={recordedUrl}
                                    controls
                                    playsInline
                                    preload="auto"
                                    style={{ width: "100%", height: "100%", objectFit: "contain", transform: "scaleX(-1)" }}
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

                                {stream && (
                                    <RoboticSkeletonOverlay
                                        videoRef={videoRef}
                                        landmarks={liveGuidance.landmarks}
                                        selectedSide={targetSide}
                                        exerciseName={exerciseName}
                                        enabled={isSkeletonVisible && !recordedUrl}
                                        hasReliablePose={liveGuidance.hasReliablePose}
                                    />
                                )}

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
                                        Not recording
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

                    {/* Floating Top Header Bar */}
                    <header className="recorder-floating-header">
                        <div className="recorder-floating-top-left">
                            <div className="recorder-floating-title-badge">
                                <Video size={18} style={{ color: "#2dd4bf" }} />
                                <h3 id="exercise-recorder-title">{exerciseName}</h3>
                            </div>

                            {/* Floating Follow-Along Guide (Directly below exercise title) */}
                            {stream && !recordedUrl && (
                                <FollowAlongVideo
                                    exerciseName={exerciseName}
                                    selectedSide={targetSide}
                                    analysisModelKey={analysisModelKey}
                                    isRecording={isRecording}
                                />
                            )}
                        </div>

                        <div className="recorder-floating-header-controls">
                            {targetSide && !recordedUrl && (
                                <span className="recorder-active-arm" aria-live="polite">
                                    {isRecording ? "Recording" : recordedClips.length > 0 ? "Next" : "Start with"}: {targetSide === "left" ? "Left arm" : "Right arm"}
                                </span>
                            )}

                            {!recordedUrl && (
                                <div className="recorder-timer-dropdown-container" ref={timerDropdownRef}>
                                    <button
                                        type="button"
                                        className="recorder-timer-dropdown-trigger"
                                        onClick={() => setIsTimerDropdownOpen((prev) => !prev)}
                                        disabled={isRecording || isFinalizingRecording}
                                        aria-haspopup="true"
                                        aria-expanded={isTimerDropdownOpen}
                                        title="Choose recording duration timer"
                                    >
                                        <Timer size={14} style={{ color: "var(--color-primary, #0f766e)" }} />
                                        <span>
                                            Timer: {selectedTargetDuration === null
                                                ? "No timer"
                                                : selectedTargetDuration === 20
                                                    ? "20s"
                                                    : selectedTargetDuration === 30
                                                        ? "30s"
                                                        : selectedTargetDuration === 60
                                                            ? "1 min"
                                                            : `${selectedTargetDuration}s`}
                                        </span>
                                        <ChevronDown size={13} style={{ color: "#64748b", marginLeft: "2px" }} />
                                    </button>

                                    {isTimerDropdownOpen && (
                                        <div className="recorder-timer-dropdown-menu" role="menu">
                                            <div className="recorder-timer-dropdown-header">Auto-Stop Timer</div>
                                            <button
                                                type="button"
                                                className={`recorder-timer-dropdown-item ${selectedTargetDuration === null ? "recorder-timer-dropdown-item-active" : ""}`}
                                                onClick={() => {
                                                    setSelectedTargetDuration(null);
                                                    setIsTimerDropdownOpen(false);
                                                }}
                                                role="menuitem"
                                            >
                                                <span>No timer (Manual stop)</span>
                                                {selectedTargetDuration === null && <Check size={14} />}
                                            </button>
                                            <button
                                                type="button"
                                                className={`recorder-timer-dropdown-item ${selectedTargetDuration === 20 ? "recorder-timer-dropdown-item-active" : ""}`}
                                                onClick={() => {
                                                    setSelectedTargetDuration(20);
                                                    setIsTimerDropdownOpen(false);
                                                }}
                                                role="menuitem"
                                            >
                                                <span>20 seconds</span>
                                                {selectedTargetDuration === 20 && <Check size={14} />}
                                            </button>
                                            <button
                                                type="button"
                                                className={`recorder-timer-dropdown-item ${selectedTargetDuration === 30 ? "recorder-timer-dropdown-item-active" : ""}`}
                                                onClick={() => {
                                                    setSelectedTargetDuration(30);
                                                    setIsTimerDropdownOpen(false);
                                                }}
                                                role="menuitem"
                                            >
                                                <span>30 seconds</span>
                                                {selectedTargetDuration === 30 && <Check size={14} />}
                                            </button>
                                            <button
                                                type="button"
                                                className={`recorder-timer-dropdown-item ${selectedTargetDuration === 60 ? "recorder-timer-dropdown-item-active" : ""}`}
                                                onClick={() => {
                                                    setSelectedTargetDuration(60);
                                                    setIsTimerDropdownOpen(false);
                                                }}
                                                role="menuitem"
                                            >
                                                <span>1 minute (60s)</span>
                                                {selectedTargetDuration === 60 && <Check size={14} />}
                                            </button>
                                            <div className="recorder-timer-dropdown-custom">
                                                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                    Custom seconds
                                                </div>
                                                <form
                                                    className="recorder-timer-custom-form"
                                                    onSubmit={(e) => {
                                                        e.preventDefault();
                                                        const parsed = parseInt(customDurationInput, 10);
                                                        if (!isNaN(parsed) && parsed > 0) {
                                                            setSelectedTargetDuration(parsed);
                                                            setIsTimerDropdownOpen(false);
                                                        }
                                                    }}
                                                >
                                                    <input
                                                        type="number"
                                                        min="5"
                                                        max="600"
                                                        step="1"
                                                        placeholder="Secs"
                                                        value={customDurationInput}
                                                        onChange={(e) => setCustomDurationInput(e.target.value)}
                                                        aria-label="Custom seconds"
                                                    />
                                                    <button type="submit">Set</button>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {minimumDurationSeconds ? (
                                <span className="recorder-min-duration-badge" title={`Minimum duration to count: ${formatTime(minimumDurationSeconds)}`}>
                                    Min: {formatTime(minimumDurationSeconds)}
                                </span>
                            ) : null}

                            <button
                                onClick={handleClose}
                                className="recorder-floating-close-btn"
                                aria-label="Close recorder"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </header>

                    {/* Floating Bottom-Right Controls (Skeleton HUD & Voice) */}
                    {liveGuidanceEnabled && (
                        <div className="recorder-bottom-right-pills">
                            <button
                                type="button"
                                className={`live-guidance-pill ${isSkeletonVisible ? "" : "live-guidance-pill-muted"}`}
                                onClick={() => setIsSkeletonVisible((prev) => !prev)}
                                aria-pressed={isSkeletonVisible}
                                aria-label={isSkeletonVisible ? "Disable robotic skeleton tracking" : "Enable robotic skeleton tracking"}
                                title="Skeleton HUD"
                            >
                                <Scan size={14} aria-hidden="true" />
                                {isSkeletonVisible ? "Skeleton HUD" : "HUD Off"}
                            </button>

                            <button
                                type="button"
                                className={`live-guidance-pill ${isVoiceEnabled ? "" : "live-guidance-pill-muted"}`}
                                onClick={handleVoiceToggle}
                                aria-pressed={isVoiceEnabled}
                                aria-label={isVoiceEnabled ? "Mute live voice coaching" : "Enable live voice coaching"}
                            >
                                {isVoiceEnabled ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
                                {isVoiceEnabled ? "Voice on" : "Voice muted"}
                            </button>
                        </div>
                    )}

                    {/* Floating Center Feedback & Cues */}
                    <div className="recorder-center-cue-container">
                        {isRecording && (
                            <div
                                style={{
                                    backgroundColor: "rgba(0, 0, 0, 0.75)",
                                    padding: "6px 14px",
                                    borderRadius: "9999px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "#FFF",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    backdropFilter: "blur(10px)",
                                }}
                            >
                                <span
                                    className="animate-pulse-subtle"
                                    style={{
                                        width: "9px",
                                        height: "9px",
                                        borderRadius: "50%",
                                        backgroundColor: "#EF4444",
                                        display: "inline-block",
                                    }}
                                />
                                {selectedTargetDuration ? (
                                    <span>REC · {formatTime(elapsedSeconds)} / {formatTime(selectedTargetDuration)}</span>
                                ) : (
                                    <span>REC · {formatTime(elapsedSeconds)}</span>
                                )}
                            </div>
                        )}

                        {liveGuidanceEnabled && isRecording && liveCoachingMessage && (
                            <div
                                aria-live="polite"
                                className="live-coaching-message"
                            >
                                {liveCoachingMessage}
                            </div>
                        )}

                        {liveGuidanceEnabled && (
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
                        )}
                    </div>

                    {/* Floating Body Visibility Panel (Top-Right) */}
                    {liveGuidanceEnabled && (
                        <aside className="recorder-floating-guidance" aria-label="Live body position guidance">
                            <ExerciseKeyPointFigure points={liveGuidance.keyPoints} />
                        </aside>
                    )}

                    {/* Floating Bottom Action Footer */}
                    <footer className="recorder-floating-footer">
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

                        {/* Top progress bar if recording */}
                        <div className="recorder-progress" style={{ width: "min(600px, 90%)", borderRadius: "999px", overflow: "hidden" }} aria-hidden={!isRecording}>
                            <span style={{ width: `${isRecording ? recordingProgress : 0}%` }} />
                        </div>

                        <div className="recorder-footer-status-pill">
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
                                                        ? recordedClips.length > 0 && targetSide ? "The other arm is saved. Reposition, then tap Start recording—or review the saved arm." : "Make sure your body is visible, then start recording."
                                                        : "Turn on your camera to see yourself first."}
                            </span>
                        </div>

                        {error && !cameraAccessIssue && <div role="alert" className="recorder-inline-error" style={{ color: "#f87171" }}>{error}</div>}

                        <div className="recorder-floating-action-bar">
                            {error && cameraAccessIssue ? (
                                <Button variant="outline" size="lg" className="recorder-primary-action-btn" onClick={handleCameraRecovery} disabled={isCameraStarting}>
                                    {isCameraStarting ? <LoaderCircle className="recorder-spin" /> : <Camera />}
                                    {cameraAccessIssue === "consent" ? "Allow Camera" : "Reconnect"}
                                </Button>
                            ) : recordedUrl ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        onClick={handleRetakeClip}
                                        disabled={isEvaluating || clipResults.some((result) => result.clientSessionId === selectedReviewClip?.clientSessionId)}
                                    >
                                        <RotateCcw />
                                        Retake This Arm
                                    </Button>
                                    <Button
                                        size="lg"
                                        className="recorder-primary-action-btn"
                                        onClick={handleEvaluate}
                                        disabled={isEvaluating}
                                    >
                                        {isEvaluating ? <LoaderCircle className="recorder-spin" /> : <Sparkles />}
                                        {isEvaluating ? "Evaluating..." : recordedClips.length > 1 ? "Evaluate Both Arms" : "Evaluate Session"}
                                    </Button>
                                </>
                            ) : isFinalizingRecording ? (
                                <Button size="lg" disabled>
                                    <LoaderCircle className="recorder-spin" />
                                    Finishing...
                                </Button>
                            ) : countdown !== null ? (
                                <Button size="lg" disabled>
                                    Starting in {countdown}s...
                                </Button>
                            ) : isRecording ? (
                                <>
                                    {canSwitchArm(modelGuidance, targetSide, recordedClips.map((clip) => clip.side)) && (
                                        <Button variant="outline" size="lg" onClick={handleSwitchArm} disabled={isFinalizingRecording}>
                                            Switch arm
                                        </Button>
                                    )}
                                    <Button
                                        size="lg"
                                        onClick={stopRecording}
                                        className="recorder-stop-action-btn"
                                    >
                                        <CircleStop />
                                        Stop Recording
                                    </Button>
                                </>
                            ) : stream ? (
                                <>
                                    {recordedClips.length > 0 && (
                                        <Button variant="outline" size="lg" onClick={handleReviewSavedClips}>
                                            Review saved arm
                                        </Button>
                                    )}
                                    <Button size="lg" className="recorder-primary-action-btn" onClick={handleStartRecording}>
                                        <Video />
                                        Start Recording
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    </footer>

                    {/* Centered Modal Overlay for Evaluation Result */}
                    {evaluationScore !== null && (
                        <div className="recorder-centered-card-overlay animate-fade-in">
                            <div className="card" style={{ maxWidth: "480px", width: "100%", padding: "40px 24px", textAlign: "center", background: "#ffffff", borderRadius: "20px" }}>
                                <div style={{
                                    width: "80px",
                                    height: "80px",
                                    borderRadius: "50%",
                                    backgroundColor: "rgba(22, 163, 74, 0.15)",
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
                                <h4 style={{ fontSize: "22px", fontWeight: 750, margin: "0 0 8px 0", color: "var(--color-text-primary)" }}>Evaluation Complete!</h4>
                                <p style={{ color: "var(--color-text-secondary)", margin: "0 0 16px 0", fontSize: "14px" }}>
                                    Your exercise performance has been evaluated.
                                </p>
                                <div style={{ fontSize: "52px", fontWeight: 800, color: "#16A34A", margin: "16px 0" }}>
                                    {formatScore(evaluationScore)} <span style={{ fontSize: "20px", fontWeight: 500, color: "var(--color-text-muted)" }}>/ 100</span>
                                </div>
                                <Button
                                    size="lg"
                                    style={{ width: "100%", marginTop: "12px" }}
                                    onClick={() => {
                                        handleClose();
                                        window.location.reload();
                                    }}
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    )}
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
        "video/mp4",
        "video/webm;codecs=vp8",
        "video/webm;codecs=vp9",
        "video/webm",
    ];
    for (const candidate of candidates) {
        if (MediaRecorder.isTypeSupported(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

"use client";

import { useEffect, useState, type ReactEventHandler } from "react";

const DEMO_VIDEOS: Record<string, string> = {
  shoulder_abduction: "/exercises/videos/left_shoulder_abduction.mp4",
  shoulder_flexion: "/exercises/videos/left_shoulder_flexion.mp4",
  side_arms_raise_v1: "/exercises/videos/side_arms_raise.mp4",
};

export function ExerciseThumbnail({
  imagePath,
  alt,
  modelKey,
  onImageError,
}: {
  imagePath: string;
  alt: string;
  modelKey?: string | null;
  onImageError?: ReactEventHandler<HTMLImageElement>;
}) {
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoPath = modelKey ? DEMO_VIDEOS[modelKey] : undefined;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  return (
    <>
      {/* Exercise image URLs may also be supplied by an administrator. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="exercise-thumbnail-still" src={imagePath} alt={alt} onError={onImageError} />
      {videoPath && motionAllowed && !videoFailed && (
        <video
          className="exercise-thumbnail-video"
          src={videoPath}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          style={{ opacity: playing ? 1 : 0 }}
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setVideoFailed(true)}
        />
      )}
    </>
  );
}

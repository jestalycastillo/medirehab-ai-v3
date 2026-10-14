"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { getExerciseImageUrl, resolveMediaUrl, type ApiExercise } from "@/lib/api";

export function DoctorExerciseImage({ exercise, name, className = "" }: {
  exercise?: ApiExercise;
  name: string;
  className?: string;
}) {
  const path = getExerciseImageUrl(exercise ?? { name, images: [] })
    ?? (name === "Side Arms Raise" ? "/exercises/arms_raise.jpg" : null);
  const source = path?.startsWith("/exercises/") ? path : resolveMediaUrl(path);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  return (
    <div className={`doctor-exercise-image ${className}`}>
      {source && source !== failedSource ? (
        // Catalog images may include administrator-provided URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt={`${name} illustration`} loading="lazy" onError={() => setFailedSource(source)} />
      ) : (
        <div className="doctor-exercise-image-fallback"><Dumbbell aria-hidden="true" /><span>Exercise preview</span></div>
      )}
    </div>
  );
}

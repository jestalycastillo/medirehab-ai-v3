"use client";

import { type ReactEventHandler } from "react";

export function ExerciseThumbnail({
  imagePath,
  alt,
  onImageError,
}: {
  imagePath: string;
  alt: string;
  onImageError?: ReactEventHandler<HTMLImageElement>;
}) {
  return (
    // Exercise image URLs may also be supplied by an administrator.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="exercise-thumbnail-still" src={imagePath} alt={alt} onError={onImageError} />
  );
}

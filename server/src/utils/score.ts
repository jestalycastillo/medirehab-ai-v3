export const roundScore = (score: number): number =>
    Math.round((score + Number.EPSILON) * 100) / 100;

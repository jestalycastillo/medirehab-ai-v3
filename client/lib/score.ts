export function formatScore(score?: number | null): string {
  return Number.isFinite(score) ? Number(score).toFixed(2) : "0.00";
}

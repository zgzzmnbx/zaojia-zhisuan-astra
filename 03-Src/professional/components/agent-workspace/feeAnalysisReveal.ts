export const FEE_ANALYSIS_REVEAL_DELAYS_MS = [
  180,
  520,
  820,
  1080,
  1340,
  1680,
  2280,
  2780,
] as const;

export const FEE_ANALYSIS_REVEAL_STAGE_COUNT = FEE_ANALYSIS_REVEAL_DELAYS_MS.length;

export function feeAnalysisRevealStageAt(elapsedMs: number) {
  return FEE_ANALYSIS_REVEAL_DELAYS_MS.filter((delay) => elapsedMs >= delay).length;
}

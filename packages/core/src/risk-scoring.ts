/**
 * NH-ERM risk assessment engine (§8).
 *
 * Pure functions, no I/O. All methodology numbers come from a `Methodology`
 * config (defaults in `methodology.ts`), so the official matrices can be swapped
 * without touching this logic.
 */

import type {
  ControlAdequacy,
  ImpactScore,
  InherentBand,
  Likelihood,
  Priority,
  ResidualLevel,
  RiskAssessmentInput,
  RiskAssessmentResult,
} from './types.ts';
import { CONTROL_ADEQUACY_LEVELS, INHERENT_BANDS } from './types.ts';
import { DEFAULT_METHODOLOGY, type Methodology } from './methodology.ts';

/** §8.2 — collapse per-domain impact scores into one aggregated impact. */
export function aggregateImpact(
  impacts: Partial<Record<string, ImpactScore>>,
  methodology: Methodology = DEFAULT_METHODOLOGY,
): number {
  const scores = Object.values(impacts).filter(
    (v): v is ImpactScore => typeof v === 'number' && v >= 1 && v <= 5,
  );
  if (scores.length === 0) return 0;

  switch (methodology.impactAggregation) {
    case 'max':
      return Math.max(...scores);
    case 'average':
      return round1(scores.reduce((a, b) => a + b, 0) / scores.length);
    case 'sum_capped':
      return Math.min(5, scores.reduce((a, b) => a + b, 0));
    default:
      return Math.max(...scores);
  }
}

/** §8.3 — map an inherent score (likelihood×impact) to its band. */
export function bandForInherentScore(
  score: number,
  methodology: Methodology = DEFAULT_METHODOLOGY,
): InherentBand {
  for (const b of methodology.inherentBands) {
    if (score >= b.min && score <= b.max) return b.band;
  }
  // Out of modelled range: clamp to nearest end.
  const first = methodology.inherentBands[0];
  const last = methodology.inherentBands[methodology.inherentBands.length - 1];
  return score < first.min ? first.band : last.band;
}

/** §8.3 — inherent score and band from likelihood and aggregated impact. */
export function computeInherent(
  likelihood: Likelihood,
  aggregatedImpact: number,
  methodology: Methodology = DEFAULT_METHODOLOGY,
): { score: number; band: InherentBand } {
  const score = likelihood * aggregatedImpact;
  return { score, band: bandForInherentScore(score, methodology) };
}

/** §8.4 — control-environment adequacy from the 4 yes/no answers. */
export function controlAdequacyFromAnswers(
  answers: readonly boolean[],
  methodology: Methodology = DEFAULT_METHODOLOGY,
): ControlAdequacy {
  const yesCount = answers.filter(Boolean).length;
  const idx = Math.max(0, Math.min(4, yesCount));
  return methodology.controlAdequacyByYesCount[idx];
}

/** §8.5 — residual priority (1..25) from inherent band × control adequacy. */
export function residualPriority(
  band: InherentBand,
  adequacy: ControlAdequacy,
  methodology: Methodology = DEFAULT_METHODOLOGY,
): Priority {
  const row = INHERENT_BANDS.indexOf(band);
  const col = CONTROL_ADEQUACY_LEVELS.indexOf(adequacy);
  return methodology.priorityGrid[row][col];
}

/** §8.5 — map a priority (1..25) to its final residual level (1..5). */
export function levelForPriority(
  priority: Priority,
  methodology: Methodology = DEFAULT_METHODOLOGY,
): ResidualLevel {
  for (const r of methodology.levelRanges) {
    if (priority >= r.min && priority <= r.max) return r.level;
  }
  return 5;
}

/** §4 / §8.6 — Top Risks inclusion test. */
export function isTopRisk(
  priority: Priority,
  methodology: Methodology = DEFAULT_METHODOLOGY,
): boolean {
  return priority <= methodology.topRiskMaxPriority;
}

/**
 * Full assessment: runs the whole chain (§8.2 → §8.6) and returns every
 * intermediate value plus the Top-Risks flag.
 */
export function assessRisk(
  input: RiskAssessmentInput,
  methodology: Methodology = DEFAULT_METHODOLOGY,
): RiskAssessmentResult {
  const aggregatedImpact = aggregateImpact(input.impacts, methodology);
  const { score: inherentScore, band: inherentBand } = computeInherent(
    input.likelihood,
    aggregatedImpact,
    methodology,
  );
  const controlAdequacy = controlAdequacyFromAnswers(input.controlAnswers, methodology);
  const priority = residualPriority(inherentBand, controlAdequacy, methodology);
  const residualLevel = levelForPriority(priority, methodology);

  return {
    likelihood: input.likelihood,
    aggregatedImpact,
    inherentScore,
    inherentBand,
    controlAdequacy,
    residualPriority: priority,
    residualLevel,
    isTopRisk: isTopRisk(priority, methodology),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

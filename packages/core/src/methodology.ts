/**
 * NH-ERM methodology configuration (§8).
 *
 * EVERYTHING in this file is data, not hardcoded logic, because the client
 * requires the methodology to stay "configurable for the future if the official
 * methodology changes" (قابلة للتهيئة مستقبلاً). In production this object is
 * loaded from the DB (`methodology_config` table) and seeded from `DEFAULT_METHODOLOGY`.
 *
 * Values marked `⚠ VERIFY` are documented defaults standing in for official-matrix
 * cells that were not machine-readable from the source files. Confirm each against
 * the "المعايير / Standards" Excel sheet + methodology PDF before go-live.
 */

import type {
  ControlAdequacy,
  InherentBand,
  ResidualLevel,
} from './types.ts';
import { CONTROL_ADEQUACY_LEVELS, INHERENT_BANDS } from './types.ts';

/** How the 24 per-domain impact scores collapse into one aggregated impact. */
export type ImpactAggregation = 'max' | 'average' | 'sum_capped';

/** A contiguous numeric range for an inherent band (inclusive). */
export interface InherentBandRange {
  band: InherentBand;
  /** Inclusive lower bound of likelihood×impact (1..25). */
  min: number;
  /** Inclusive upper bound. */
  max: number;
  /** Semantic color token (resolved to a hex in the theme layer). */
  colorKey: 'band_very_low' | 'band_low' | 'band_medium' | 'band_high' | 'band_critical';
}

/** A priority range that maps to a final residual level. */
export interface LevelRange {
  level: ResidualLevel;
  min: number;
  max: number;
  colorKey: 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'level_5';
}

export interface Methodology {
  /** §8.2 — aggregation rule. ⚠ VERIFY (default: worst-case max). */
  impactAggregation: ImpactAggregation;

  /** §8.3 — inherent band ranges over likelihood×impact (1..25). ⚠ VERIFY ranges. */
  inherentBands: readonly InherentBandRange[];

  /**
   * §8.4 — control adequacy from the 4 yes/no answers.
   * `byYesCount[n]` = adequacy when exactly `n` of the 4 answers are "yes".
   * Index 0..4. ⚠ VERIFY mapping.
   */
  controlAdequacyByYesCount: readonly ControlAdequacy[];

  /**
   * §8.5 — the 5×5 → priority(1..25) grid. ⚠ VERIFY grid.
   * `priorityGrid[inherentIndex][controlIndex]` where:
   *   inherentIndex follows INHERENT_BANDS  (very_low..critical)
   *   controlIndex  follows CONTROL_ADEQUACY_LEVELS (excellent..weak)
   * 1 = most urgent, 25 = least urgent.
   */
  priorityGrid: readonly (readonly number[])[];

  /** §8.5 — priority→level grouping. Taken VERBATIM from the doc (not a guess). */
  levelRanges: readonly LevelRange[];

  /** §4 / §8.6 — a risk is a Top Risk when residualPriority <= this. Confirmed = 7. */
  topRiskMaxPriority: number;
}

/**
 * ⚠ VERIFY — default inherent band ranges.
 * Contiguous, monotonic cover of 1..25. Replace cut-offs with the official matrix.
 */
const DEFAULT_INHERENT_BANDS: readonly InherentBandRange[] = [
  { band: 'very_low', min: 1, max: 3, colorKey: 'band_very_low' },
  { band: 'low', min: 4, max: 6, colorKey: 'band_low' },
  { band: 'medium', min: 7, max: 12, colorKey: 'band_medium' },
  { band: 'high', min: 13, max: 19, colorKey: 'band_high' },
  { band: 'critical', min: 20, max: 25, colorKey: 'band_critical' },
];

/**
 * ⚠ VERIFY — default control adequacy by "yes" count.
 * 4 yes → excellent … 0 yes → weak (monotonic).
 */
const DEFAULT_CONTROL_ADEQUACY_BY_YES_COUNT: readonly ControlAdequacy[] = [
  'weak', // 0 yes
  'unacceptable', // 1
  'neutral', // 2
  'acceptable', // 3
  'excellent', // 4
];

/**
 * ⚠ VERIFY — default 5×5 priority grid.
 * Monotonic placeholder: priority = 25 − (inherentIndex*5 + controlIndex).
 * Rows = inherent (very_low..critical); cols = control (excellent..weak).
 * Worst cell (critical × weak) = 1; best cell (very_low × excellent) = 25.
 */
const DEFAULT_PRIORITY_GRID: readonly (readonly number[])[] = [
  [25, 24, 23, 22, 21], // very_low
  [20, 19, 18, 17, 16], // low
  [15, 14, 13, 12, 11], // medium
  [10, 9, 8, 7, 6], //    high
  [5, 4, 3, 2, 1], //     critical
];

/** §8.5 — EXPLICIT in the doc (red/orange/yellow/green/light-green). */
const DEFAULT_LEVEL_RANGES: readonly LevelRange[] = [
  { level: 1, min: 1, max: 3, colorKey: 'level_1' }, // red
  { level: 2, min: 4, max: 7, colorKey: 'level_2' }, // orange
  { level: 3, min: 8, max: 12, colorKey: 'level_3' }, // yellow
  { level: 4, min: 13, max: 17, colorKey: 'level_4' }, // green
  { level: 5, min: 18, max: 25, colorKey: 'level_5' }, // light green
];

export const DEFAULT_METHODOLOGY: Methodology = {
  impactAggregation: 'max',
  inherentBands: DEFAULT_INHERENT_BANDS,
  controlAdequacyByYesCount: DEFAULT_CONTROL_ADEQUACY_BY_YES_COUNT,
  priorityGrid: DEFAULT_PRIORITY_GRID,
  levelRanges: DEFAULT_LEVEL_RANGES,
  topRiskMaxPriority: 7,
};

/**
 * Cell values that are "empty-equivalent" on import (§3): formula errors and
 * leftover template placeholders are treated as a blank cell, never stored as
 * literal text. Comparison is case-insensitive and trimmed.
 */
export const EMPTY_EQUIVALENT_VALUES: readonly string[] = [
  '#REF!',
  '#NAME?',
  '#VALUE!',
  '#DIV/0!',
  '#N/A',
  '#NULL!',
  '#NUM!',
  'unidentified',
  'خطأ في التقييم', // "evaluation error"
  'غير محدد', // "unspecified"
];

/** Validate that a methodology config is internally consistent. Throws on error. */
export function validateMethodology(m: Methodology): void {
  if (m.inherentBands.length !== INHERENT_BANDS.length) {
    throw new Error(`inherentBands must have ${INHERENT_BANDS.length} entries`);
  }
  if (m.controlAdequacyByYesCount.length !== 5) {
    throw new Error('controlAdequacyByYesCount must have 5 entries (0..4 yes)');
  }
  if (m.priorityGrid.length !== INHERENT_BANDS.length) {
    throw new Error('priorityGrid must have one row per inherent band');
  }
  for (const row of m.priorityGrid) {
    if (row.length !== CONTROL_ADEQUACY_LEVELS.length) {
      throw new Error('each priorityGrid row must have one cell per control level');
    }
  }
  // Priority grid must be a permutation of 1..25.
  const flat = m.priorityGrid.flat().slice().sort((a, b) => a - b);
  for (let i = 0; i < flat.length; i++) {
    if (flat[i] !== i + 1) {
      throw new Error('priorityGrid must contain each value 1..25 exactly once');
    }
  }
  if (m.levelRanges.length !== 5) {
    throw new Error('levelRanges must have 5 entries');
  }
}

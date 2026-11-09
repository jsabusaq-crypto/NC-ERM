/**
 * NH-ERM Register ↔ Top-Risks synchronization (§4).
 *
 * The main register is the source of truth; a risk is *projected* into the Top
 * Risks sheet only while its residual priority qualifies. A risk is NEVER
 * removed from the main register by this logic, and its prior Top-Risks
 * membership history is always retained (the caller persists the returned event).
 */

import type { Priority } from './types.ts';
import { DEFAULT_METHODOLOGY, type Methodology } from './methodology.ts';
import { isTopRisk } from './risk-scoring.ts';

export type TopRiskTransition =
  | 'added' // crossed into Level 1/2 → now appears in Top Risks
  | 'removed' // dropped out of Level 1/2 → hidden from next export, history kept
  | 'unchanged_present' // still a top risk
  | 'unchanged_absent'; // still not a top risk

export interface TopRiskSyncResult {
  transition: TopRiskTransition;
  /** Whether the risk should appear in the Top Risks sheet of the *next* export. */
  isTopRiskNow: boolean;
  /** True when a history record (added/removed at timestamp) must be written. */
  recordHistory: boolean;
}

/**
 * Decide the Top-Risks action from the previous and current residual priority.
 *
 * @param previousPriority priority before the change, or `null` for a brand-new risk.
 * @param currentPriority  priority after the change.
 */
export function syncTopRisk(
  previousPriority: Priority | null,
  currentPriority: Priority,
  methodology: Methodology = DEFAULT_METHODOLOGY,
): TopRiskSyncResult {
  const wasTop = previousPriority !== null && isTopRisk(previousPriority, methodology);
  const isTop = isTopRisk(currentPriority, methodology);

  let transition: TopRiskTransition;
  if (!wasTop && isTop) transition = 'added';
  else if (wasTop && !isTop) transition = 'removed';
  else if (wasTop && isTop) transition = 'unchanged_present';
  else transition = 'unchanged_absent';

  return {
    transition,
    isTopRiskNow: isTop,
    recordHistory: transition === 'added' || transition === 'removed',
  };
}

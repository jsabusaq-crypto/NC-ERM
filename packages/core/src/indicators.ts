/**
 * NH-ERM indicators engine (§9) — KRIs (treatment-plan tracking) and KPIs
 * (department performance). Rules confirmed by the client:
 *
 *  KRIs:
 *   - "approaching deadline" alert fires 30 days before the due date
 *   - once overdue, a reminder repeats weekly until the plan is closed
 *   - completion % is computed from sub-tasks (not entered manually)
 *   - alerts go out via email + in-platform together (§9)
 *
 *  KPIs (per department):
 *   - the register is updated on a quarterly cycle (and on demand)
 *   - a risk counts as "on-time" if updated within the first week (7 days) of the quarter
 *   - adherence % = on-time / total; delay % = late / total
 *   - RAG target bands: ≥90% green, 70–<90% yellow, <70% red
 *   - the same RAG bands are reused in reports and mitigation plans
 *
 * All thresholds live in `IndicatorsConfig` so they stay configurable.
 */

export interface IndicatorsConfig {
  /** Days before due date when the "approaching" KRI alert starts. */
  kriApproachingDays: number;
  /** Reminder cadence once overdue. */
  kriOverdueReminder: 'daily' | 'weekly';
  /** Register update cycle for KPI adherence. */
  kpiCycle: 'monthly' | 'quarterly';
  /** On-time window: days from the cycle start within which an update counts as on-time. */
  kpiOnTimeWindowDays: number;
  /** RAG target thresholds (percent). value ≥ green → green; ≥ yellow → yellow; else red. */
  ragGreen: number;
  ragYellow: number;
  /** Who receives KRI alerts. */
  alertRecipients: ('plan_owner' | 'department_manager' | 'erm_manager')[];
}

export const DEFAULT_INDICATORS: IndicatorsConfig = {
  kriApproachingDays: 30,
  kriOverdueReminder: 'weekly',
  kpiCycle: 'quarterly',
  kpiOnTimeWindowDays: 7,
  ragGreen: 90,
  ragYellow: 70,
  // ⚠ recipients not explicitly specified — sensible default, configurable.
  alertRecipients: ['plan_owner', 'department_manager', 'erm_manager'],
};

export type Rag = 'green' | 'yellow' | 'red';

/** RAG band for a percentage, per the confirmed targets. Reused in dashboard, reports, plans. */
export function ragBand(pct: number, cfg: IndicatorsConfig = DEFAULT_INDICATORS): Rag {
  if (pct >= cfg.ragGreen) return 'green';
  if (pct >= cfg.ragYellow) return 'yellow';
  return 'red';
}

// ── KRIs ─────────────────────────────────────────────────────────────────────

export interface Subtask {
  done: boolean;
  weight?: number; // optional weighting; defaults to 1
}

/** Completion % computed from sub-tasks (weighted). Empty → 0. */
export function completionFromSubtasks(subtasks: readonly Subtask[]): number {
  if (subtasks.length === 0) return 0;
  let total = 0;
  let done = 0;
  for (const s of subtasks) {
    const w = s.weight ?? 1;
    total += w;
    if (s.done) done += w;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export type KriStatus = 'done' | 'overdue' | 'approaching' | 'on_track';

export interface KriState {
  status: KriStatus;
  completionPct: number;
  daysToDue: number; // negative when overdue
  /** Whether an alert should be sent now, and why. */
  alert: null | 'approaching' | 'overdue';
}

const DAY = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

/**
 * Evaluate one treatment plan's KRI state.
 * @param dueDate plan deadline
 * @param completionPct completion (from sub-tasks)
 * @param now current time
 * @param lastAlertAt when the last overdue reminder was sent (for weekly cadence)
 */
export function kriState(
  dueDate: Date,
  completionPct: number,
  now: Date = new Date(),
  lastAlertAt: Date | null = null,
  cfg: IndicatorsConfig = DEFAULT_INDICATORS,
): KriState {
  const daysToDue = daysBetween(now, dueDate);
  if (completionPct >= 100) {
    return { status: 'done', completionPct, daysToDue, alert: null };
  }
  if (daysToDue < 0) {
    // overdue — remind on the configured cadence
    const cadence = cfg.kriOverdueReminder === 'daily' ? 1 : 7;
    const due = lastAlertAt === null || daysBetween(lastAlertAt, now) >= cadence;
    return { status: 'overdue', completionPct, daysToDue, alert: due ? 'overdue' : null };
  }
  if (daysToDue <= cfg.kriApproachingDays) {
    // approaching — single alert when first crossing the threshold
    const already = lastAlertAt !== null && daysBetween(lastAlertAt, now) < cfg.kriApproachingDays;
    return { status: 'approaching', completionPct, daysToDue, alert: already ? null : 'approaching' };
  }
  return { status: 'on_track', completionPct, daysToDue, alert: null };
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

/** Start of the cycle (quarter/month) that contains `d`. */
export function cycleStart(d: Date, cfg: IndicatorsConfig = DEFAULT_INDICATORS): Date {
  const y = d.getUTCFullYear();
  if (cfg.kpiCycle === 'monthly') return new Date(Date.UTC(y, d.getUTCMonth(), 1));
  const q = Math.floor(d.getUTCMonth() / 3); // 0..3
  return new Date(Date.UTC(y, q * 3, 1));
}

/** True if an update date falls within the on-time window of its cycle. */
export function isOnTime(updateDate: Date, cfg: IndicatorsConfig = DEFAULT_INDICATORS): boolean {
  const start = cycleStart(updateDate, cfg);
  return daysBetween(start, updateDate) < cfg.kpiOnTimeWindowDays;
}

export interface DepartmentKpi {
  department: string;
  total: number;
  onTime: number;
  late: number;
  adherencePct: number;
  delayPct: number;
  rag: Rag;
}

export interface RiskUpdate {
  department: string;
  updateDate: Date | null;
}

/** Compute per-department adherence KPIs from register update dates (§9). */
export function departmentKpis(
  risks: readonly RiskUpdate[],
  cfg: IndicatorsConfig = DEFAULT_INDICATORS,
): DepartmentKpi[] {
  const byDept = new Map<string, { total: number; onTime: number }>();
  for (const r of risks) {
    const d = byDept.get(r.department) ?? { total: 0, onTime: 0 };
    d.total++;
    if (r.updateDate && isOnTime(r.updateDate, cfg)) d.onTime++;
    byDept.set(r.department, d);
  }
  return [...byDept.entries()]
    .map(([department, v]) => {
      const adherencePct = v.total === 0 ? 0 : Math.round((v.onTime / v.total) * 100);
      return {
        department,
        total: v.total,
        onTime: v.onTime,
        late: v.total - v.onTime,
        adherencePct,
        delayPct: 100 - adherencePct,
        rag: ragBand(adherencePct, cfg),
      };
    })
    .sort((a, b) => a.adherencePct - b.adherencePct);
}

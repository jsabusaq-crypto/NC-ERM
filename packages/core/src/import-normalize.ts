/**
 * NH-ERM import value normalization (§3).
 *
 * Any cell carrying a formula-error string or a leftover template placeholder is
 * "empty-equivalent": it must be treated as a blank cell and NEVER stored as
 * literal text in the database.
 */

import { EMPTY_EQUIVALENT_VALUES } from './methodology.ts';

const EMPTY_SET = new Set(EMPTY_EQUIVALENT_VALUES.map((v) => v.trim().toLowerCase()));

/** True if a raw cell value should be treated as an empty cell on import. */
export function isEmptyEquivalent(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') return true;
    if (EMPTY_SET.has(t.toLowerCase())) return true;
  }
  // exceljs surfaces formula errors as `{ error: '#REF!' }`.
  if (typeof value === 'object' && value !== null && 'error' in (value as Record<string, unknown>)) {
    const err = String((value as Record<string, unknown>).error).trim().toLowerCase();
    return EMPTY_SET.has(err) || err.startsWith('#');
  }
  return false;
}

/** Return the stored value for a raw cell: `null` when empty-equivalent, else the value. */
export function normalizeCell<T>(value: T): T | null {
  return isEmptyEquivalent(value) ? null : value;
}

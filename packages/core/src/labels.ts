/**
 * NH-ERM Arabic scale-label mappings (§8), confirmed from the real official file.
 *
 * The register stores likelihood, impact, inherent rating, and control adequacy
 * as Arabic TEXT labels (not numbers), with spelling/diacritic variants and even
 * Arabic-Indic digits. These tables map every observed spelling to the canonical
 * 1–5 scale / enum so the engine and UI can read and re-export the official file.
 *
 * Matching is done on the normalized form (see `normalizeLabel`): trimmed,
 * whitespace-collapsed, Arabic diacritics/tatweel removed, Arabic-Indic digits
 * folded to ASCII. Extend the alias arrays as new spellings appear.
 */

import type { ControlAdequacy, ControlType, InherentBand } from './types.ts';

/** Fold Arabic-Indic digits (٠-٩ and ۰-۹) to ASCII and strip tatweel/diacritics. */
export function normalizeLabel(s: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const extended = '۰۱۲۳۴۵۶۷۸۹';
  let out = '';
  for (const ch of s) {
    const ai = arabicIndic.indexOf(ch);
    const ex = extended.indexOf(ch);
    if (ai >= 0) out += String(ai);
    else if (ex >= 0) out += String(ex);
    else out += ch;
  }
  return out
    .replace(/[ً-ْـ]/g, '') // harakat + tatweel
    .replace(/[أإآٱ]/g, 'ا') // alef variants → bare alef
    .replace(/ة/g, 'ه') // teh marbuta → heh
    .replace(/ى/g, 'ي') // alef maqsura → yeh
    .replace(/\s+/g, ' ')
    .trim();
}

function lookup<T>(table: Record<string, T>, label: unknown): T | null {
  if (label == null) return null;
  const key = normalizeLabel(String(label));
  return key in table ? table[key] : null;
}

/** Likelihood label → 1..5. */
const LIKELIHOOD: Record<string, 1 | 2 | 3 | 4 | 5> = {
  'مستبعد حدوثه': 1, 'مستبعد': 1,
  'نادر': 2,
  'محتمل': 3,
  'غالبا': 4,
  'شبه مؤكد': 5,
};

/** Impact label → 1..5. */
const IMPACT: Record<string, 1 | 2 | 3 | 4 | 5> = {
  'ضئيل': 1,
  'قليل': 2,
  'متوسط': 3,
  'مرتفع': 4,
  'مرتفع جدا': 5,
};

/** Inherent rating label → band. */
const INHERENT: Record<string, InherentBand> = {
  'منخفض جدا': 'very_low',
  'منخفض': 'low',
  'متوسط': 'medium',
  'عالي': 'high',
  'حرج': 'critical',
};

/** Control-environment adequacy label → enum. */
const ADEQUACY: Record<string, ControlAdequacy> = {
  'ممتاز': 'excellent',
  'مقبول': 'acceptable',
  'محايد': 'neutral',
  'غير مقبول': 'unacceptable',
  'ضعيف': 'weak',
};

/** Control type label → enum. */
const CONTROL_TYPE: Record<string, ControlType> = {
  'وقائي': 'preventive',
  'كشفي': 'detective',
  'تصحيحي': 'corrective',
  'توجيهي': 'directive',
  'لا يوجد': 'none',
  'لايوجد': 'none',
};

/** yes/no label (نعم/لا) → boolean|null. */
export function parseYesNo(label: unknown): boolean | null {
  if (label == null) return null;
  const k = normalizeLabel(String(label));
  if (k === 'نعم') return true;
  if (k === 'لا' || k === 'لايوجد') return false;
  return null;
}

export const likelihoodFromLabel = (l: unknown) => lookup(LIKELIHOOD, l);
export const impactFromLabel = (l: unknown) => lookup(IMPACT, l);
export const inherentBandFromLabel = (l: unknown) => lookup(INHERENT, l);
export const controlAdequacyFromLabel = (l: unknown) => lookup(ADEQUACY, l);
export const controlTypeFromLabel = (l: unknown) => lookup(CONTROL_TYPE, l);

/** Extract the integer from labels like "أولوية 14" / "مستوى ٤" / "اولويه 4". */
export function extractNumber(label: unknown): number | null {
  if (label == null) return null;
  const m = normalizeLabel(String(label)).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Reverse maps for export (number/enum → canonical Arabic label). */
export const LIKELIHOOD_LABELS_AR = ['', 'مستبعد حدوثه', 'نادر', 'محتمل', 'غالباً', 'شبه مؤكد'];
export const IMPACT_LABELS_AR = ['', 'ضئيل', 'قليل', 'متوسط', 'مرتفع', 'مرتفع جداً'];
export const INHERENT_LABELS_AR: Record<InherentBand, string> = {
  very_low: 'منخفض جداً', low: 'منخفض', medium: 'متوسط', high: 'عالي', critical: 'حرج',
};
export const ADEQUACY_LABELS_AR: Record<ControlAdequacy, string> = {
  excellent: 'ممتاز', acceptable: 'مقبول', neutral: 'محايد', unacceptable: 'غير مقبول', weak: 'ضعيف',
};

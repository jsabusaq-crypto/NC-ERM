/**
 * NH-ERM Risk Register column map (§3).
 *
 * The official register has 57 columns. We match columns by HEADER TEXT (AR or
 * EN), not by fixed index, because RTL sheets and template revisions move indices.
 * `aliases` lists every header spelling seen in the source files; extend it as new
 * template versions arrive rather than hardcoding positions.
 *
 * Column order here mirrors the official order described in REQUIREMENTS.md §3:
 *   identification → 24 impact domains → likelihood/impact/inherent →
 *   4 controls → control adequacy → residual priority/level → last update.
 *
 * ⚠ The exact official header strings must be confirmed against file `562be583`
 *   (current data) / `695a1150` (template). Values below are the best-known labels.
 */

import { IMPACT_DOMAINS } from '@nh-erm/core';

export type FieldKind = 'identification' | 'impact' | 'assessment' | 'control' | 'residual' | 'meta';

export interface ColumnDef {
  /** Stable field key used in code/DB. */
  field: string;
  kind: FieldKind;
  /** Header spellings to match (case-insensitive, trimmed). First is canonical. */
  aliases: string[];
  /** Whether a missing value in this column counts toward the "missing fields" report. */
  requiredForImport?: boolean;
}

/** The 24 impact-domain columns, generated from the canonical domain list. */
const impactColumns: ColumnDef[] = IMPACT_DOMAINS.map((d) => ({
  field: `impact:${d.key}`,
  kind: 'impact' as const,
  aliases: [d.ar, d.en],
}));

export const RISK_REGISTER_COLUMNS: ColumnDef[] = [
  // ── Identification ──────────────────────────────────────────────────────
  { field: 'cluster', kind: 'identification', aliases: ['التجمع', 'Cluster'] },
  { field: 'department', kind: 'identification', aliases: ['الإدارة', 'اسم الإدارة/القسم/الوحدة', 'Department'], requiredForImport: true },
  { field: 'owner', kind: 'identification', aliases: ['المالك', 'مالك الخطر', 'Risk owner', 'Owner'] },
  { field: 'code', kind: 'identification', aliases: ['رمز الخطر', 'Risk code', 'Code'], requiredForImport: true },
  { field: 'title', kind: 'identification', aliases: ['الخطر', 'وصف الخطر', 'Risk', 'Risk title'], requiredForImport: true },

  // ── 24 impact domains ───────────────────────────────────────────────────
  ...impactColumns,

  // ── Assessment ──────────────────────────────────────────────────────────
  { field: 'likelihood', kind: 'assessment', aliases: ['الاحتمالية', 'Likelihood'] },
  { field: 'aggregatedImpact', kind: 'assessment', aliases: ['الأثر', 'الأثر المجمع', 'Impact'] },
  { field: 'inherentScore', kind: 'assessment', aliases: ['التقييم الكامن', 'Inherent', 'Inherent risk'] },

  // ── 4 control questions ─────────────────────────────────────────────────
  { field: 'controlActivated', kind: 'control', aliases: ['تفعيل/اعتماد الضوابط', 'Controls activated'] },
  { field: 'controlShared', kind: 'control', aliases: ['مشاركتها وتطبيقها', 'Controls shared'] },
  { field: 'controlComplied', kind: 'control', aliases: ['الالتزام الكامل بتنفيذها', 'Compliance'] },
  { field: 'controlEffective', kind: 'control', aliases: ['فعاليتها دون حالات فشل', 'Effectiveness'] },

  // ── Control environment & residual ──────────────────────────────────────
  { field: 'controlAdequacy', kind: 'control', aliases: ['كفاية البيئة الرقابية', 'Control adequacy'] },
  { field: 'residualPriority', kind: 'residual', aliases: ['الأولوية', 'أولوية المخاطر المتبقية', 'Residual priority', 'Priority'] },
  { field: 'residualLevel', kind: 'residual', aliases: ['مستوى المخاطر المتبقية', 'Residual level', 'Level'] },

  // ── Meta ────────────────────────────────────────────────────────────────
  { field: 'lastUpdateDate', kind: 'meta', aliases: ['تاريخ آخر تحديث', 'Last update date'] },
  { field: 'lastUpdateDetails', kind: 'meta', aliases: ['تفاصيل آخر تحديث', 'Last update details'] },
];

/** Build a header → ColumnDef lookup (normalized). */
export function buildHeaderIndex(columns: ColumnDef[] = RISK_REGISTER_COLUMNS): Map<string, ColumnDef> {
  const map = new Map<string, ColumnDef>();
  for (const col of columns) {
    for (const alias of col.aliases) {
      map.set(normalizeHeader(alias), col);
    }
  }
  return map;
}

export function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, ' ').trim().toLowerCase();
}

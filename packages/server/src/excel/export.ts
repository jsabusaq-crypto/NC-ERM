/**
 * NH-ERM Excel export (§5).
 *
 * Fidelity-first strategy: LOAD the official empty template workbook and write
 * ONLY data cells into the existing "سجل المخاطر" sheet, leaving sheet/column
 * names & order, styles, colors, logo, formulas, dropdowns, data validation and
 * RTL untouched. We never rebuild the workbook from scratch — that is the single
 * hardest, non-negotiable requirement (§17.1: "no change to appearance").
 *
 * Top Risks (§4): only risks with isTopRisk=true are projected into that sheet.
 */

import ExcelJS from 'exceljs';
import {
  RISK_REGISTER_COLUMNS,
  buildHeaderIndex,
  normalizeHeader,
  type ColumnDef,
} from './column-map.ts';

export interface ExportRisk {
  /** field → value, keyed by ColumnDef.field (incl. `impact:<domain>`). */
  values: Record<string, unknown>;
  isTopRisk: boolean;
  deletedAt?: Date | null; // soft-deleted rows are excluded from the current export (§6)
}

export type ExportOption =
  | 'all'
  | 'top'
  | 'by_department'
  | 'by_level'
  | 'by_period'
  | 'full_after_update';

export interface ExportFilter {
  option: ExportOption;
  departmentId?: string;
  level?: number;
  from?: Date;
  to?: Date;
}

export interface ExportResult {
  buffer: Buffer;
  writtenRows: number;
  topRiskRows: number;
}

/**
 * Produce an export workbook from the official template.
 *
 * @param templatePath path to the official empty template (`695a1150`).
 * @param risks        active risks to write (caller already applied filters/soft-delete).
 * @param options.firstDataRow 1-based row where data starts in the template (default 2).
 */
export async function exportToTemplate(
  templatePath: string,
  risks: ExportRisk[],
  options: {
    registerSheet?: string;
    topRisksSheet?: string;
    firstDataRow?: number;
    columns?: ColumnDef[];
  } = {},
): Promise<ExportResult> {
  const {
    registerSheet = 'سجل المخاطر',
    topRisksSheet = 'أهم المخاطر',
    firstDataRow = 2,
    columns = RISK_REGISTER_COLUMNS,
  } = options;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath); // preserves ALL template formatting

  const active = risks.filter((r) => !r.deletedAt); // §6 current export excludes soft-deleted

  const register = wb.getWorksheet(registerSheet);
  if (!register) throw new Error(`Register sheet "${registerSheet}" not found in template`);
  const writtenRows = writeRows(register, active, firstDataRow, columns);

  // §4: Top Risks sheet gets only qualifying risks, in the same identity.
  const top = wb.getWorksheet(topRisksSheet);
  let topRiskRows = 0;
  if (top) {
    const topRisks = active.filter((r) => r.isTopRisk);
    topRiskRows = writeRows(top, topRisks, firstDataRow, columns);
  }

  const buffer = (await wb.xlsx.writeBuffer()) as Buffer;
  return { buffer, writtenRows, topRiskRows };
}

/**
 * Write data rows into an existing sheet without disturbing its header/styles.
 * Matches target columns by header text so we honor the template's own order.
 */
function writeRows(
  sheet: ExcelJS.Worksheet,
  risks: ExportRisk[],
  firstDataRow: number,
  columns: ColumnDef[],
): number {
  const headerIndex = buildHeaderIndex(columns);
  const fieldToCol = new Map<string, number>();

  // Discover the header row by scanning row 1 (template header).
  sheet.getRow(firstDataRow - 1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = cellTextOf(cell.value);
    const def = text ? headerIndex.get(normalizeHeader(text)) : undefined;
    if (def) fieldToCol.set(def.field, colNumber);
  });

  let written = 0;
  risks.forEach((risk, i) => {
    const targetRow = sheet.getRow(firstDataRow + i);
    for (const [field, colNumber] of fieldToCol) {
      const value = risk.values[field];
      if (value !== undefined) {
        const cell = targetRow.getCell(colNumber);
        // Only set value; style stays as the template defined it for that cell.
        cell.value = value as ExcelJS.CellValue;
      }
    }
    targetRow.commit?.();
    written++;
  });
  return written;
}

function cellTextOf(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('text' in o) return String(o.text);
    if ('result' in o) return String(o.result);
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((t) => t.text).join('');
    }
  }
  return String(v);
}

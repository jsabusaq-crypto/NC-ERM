/**
 * NH-ERM Excel import (§3).
 *
 * Reads the official Risk Register sheet, normalizes empty-equivalent cells
 * (formula errors / placeholders → blank), caps at MAX_ROWS_PER_SHEET, detects
 * duplicates by risk code, and returns a review report (§3 "after import").
 *
 * This does NOT write to the DB — it returns parsed rows + a report for the
 * caller to persist as an ImportBatch (pending_review) before final approval.
 */

import ExcelJS from 'exceljs';
import { normalizeCell } from '@nh-erm/core';
import {
  RISK_REGISTER_COLUMNS,
  buildHeaderIndex,
  normalizeHeader,
  type ColumnDef,
} from './column-map.ts';

export const MAX_ROWS_PER_SHEET = 200; // §3 confirmed cap

export interface ParsedRow {
  rowNumber: number;
  values: Record<string, unknown>; // field → normalized value (null when empty-equivalent)
}

export interface ImportIssue {
  rowNumber: number;
  code: string | null;
  type: 'duplicate' | 'missing_field' | 'error_cell' | 'over_limit';
  detail: string;
}

export interface ImportReport {
  sheetName: string;
  totalDataRows: number;
  importedCount: number;
  duplicateCount: number;
  missingFieldCount: number;
  errorCount: number;
  overLimitCount: number;
  issues: ImportIssue[];
}

export interface ImportResult {
  rows: ParsedRow[];
  report: ImportReport;
  /** Unmatched header texts, so template drift is visible to reviewers. */
  unmatchedHeaders: string[];
}

/**
 * Parse one Risk Register worksheet.
 * @param sheet exceljs worksheet (the official "سجل المخاطر" sheet).
 * @param headerRow 1-based header row index (default 1).
 */
export function parseRiskRegisterSheet(
  sheet: ExcelJS.Worksheet,
  headerRow = 1,
  columns: ColumnDef[] = RISK_REGISTER_COLUMNS,
): ImportResult {
  const headerIndex = buildHeaderIndex(columns);
  const colByNumber = new Map<number, ColumnDef>();
  const unmatchedHeaders: string[] = [];

  const header = sheet.getRow(headerRow);
  header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = cellText(cell.value);
    if (!text) return;
    const def = headerIndex.get(normalizeHeader(text));
    if (def) colByNumber.set(colNumber, def);
    else unmatchedHeaders.push(text);
  });

  const requiredFields = columns.filter((c) => c.requiredForImport).map((c) => c.field);

  const rows: ParsedRow[] = [];
  const issues: ImportIssue[] = [];
  const seenCodes = new Set<string>();
  let duplicateCount = 0;
  let missingFieldCount = 0;
  let errorCount = 0;
  let overLimitCount = 0;
  let totalDataRows = 0;

  const lastRow = sheet.rowCount;
  for (let r = headerRow + 1; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    if (isRowEmpty(row, colByNumber)) continue;
    totalDataRows++;

    if (rows.length >= MAX_ROWS_PER_SHEET) {
      overLimitCount++;
      issues.push({
        rowNumber: r,
        code: null,
        type: 'over_limit',
        detail: `Row ${r} exceeds the ${MAX_ROWS_PER_SHEET}-row/sheet cap and was skipped.`,
      });
      continue;
    }

    const values: Record<string, unknown> = {};
    colByNumber.forEach((def, colNumber) => {
      const raw = row.getCell(colNumber).value;
      // §3: formula errors + placeholders become blank, never literal text.
      if (isFormulaError(raw)) {
        errorCount++;
        issues.push({
          rowNumber: r,
          code: null,
          type: 'error_cell',
          detail: `Cell ${def.field} contained a formula error; treated as empty.`,
        });
      }
      values[def.field] = normalizeCell(unwrap(raw));
    });

    const code = values.code == null ? null : String(values.code);

    // Duplicate detection by risk code (§4 unique code).
    if (code) {
      if (seenCodes.has(code)) {
        duplicateCount++;
        issues.push({ rowNumber: r, code, type: 'duplicate', detail: `Duplicate risk code "${code}".` });
      } else {
        seenCodes.add(code);
      }
    }

    // Missing required fields.
    for (const f of requiredFields) {
      if (values[f] == null) {
        missingFieldCount++;
        issues.push({ rowNumber: r, code, type: 'missing_field', detail: `Missing required field "${f}".` });
      }
    }

    rows.push({ rowNumber: r, values });
  }

  return {
    rows,
    unmatchedHeaders,
    report: {
      sheetName: sheet.name,
      totalDataRows,
      importedCount: rows.length,
      duplicateCount,
      missingFieldCount,
      errorCount,
      overLimitCount,
      issues,
    },
  };
}

/** Load a workbook from a file path and parse its Risk Register sheet. */
export async function importRiskRegisterFile(
  filePath: string,
  sheetName = 'سجل المخاطر',
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet(sheetName) ?? wb.worksheets[0];
  if (!sheet) throw new Error(`Worksheet "${sheetName}" not found`);
  return parseRiskRegisterSheet(sheet);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isFormulaError(v: unknown): boolean {
  return typeof v === 'object' && v !== null && 'error' in (v as Record<string, unknown>);
}

/** exceljs rich values → primitive. */
function unwrap(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('error' in o) return o.error; // normalizeCell will blank it
    if ('result' in o) return o.result; // formula → computed result
    if ('text' in o) return o.text; // rich text / hyperlink
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((t) => t.text).join('');
    }
  }
  return v;
}

function cellText(v: unknown): string {
  const u = unwrap(v);
  return u == null ? '' : String(u);
}

function isRowEmpty(row: ExcelJS.Row, cols: Map<number, ColumnDef>): boolean {
  for (const colNumber of cols.keys()) {
    const t = cellText(row.getCell(colNumber).value);
    if (t.trim() !== '') return false;
  }
  return true;
}

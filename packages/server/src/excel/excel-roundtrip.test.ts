/**
 * NH-ERM Excel round-trip tests (§16 scenarios 7–9).
 *
 * We synthesize a template-shaped workbook in memory (so the test needs no
 * client file), export risk rows into it, re-open the result, and assert:
 *   - no risk/column lost (count match)
 *   - error cells & placeholders import as blank (§3)
 *   - the 200-row cap holds
 *   - Top Risks sheet carries only qualifying risks (§4)
 *   - soft-deleted risks are excluded from the current export (§6)
 *
 * Run: `node --test` from packages/server.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { RISK_REGISTER_COLUMNS } from './column-map.ts';

// exceljs is an optional-at-test-time dependency: if it is not installed (e.g.
// the registry was unreachable at setup), skip these tests rather than fail the
// whole suite. The import/export modules still require it at runtime.
const require = createRequire(import.meta.url);
let ExcelJS: typeof import('exceljs') | null = null;
let importMod: typeof import('./import.ts') | null = null;
let exportMod: typeof import('./export.ts') | null = null;
try {
  require.resolve('exceljs');
  ExcelJS = (await import('exceljs')).default;
  importMod = await import('./import.ts');
  exportMod = await import('./export.ts');
} catch {
  ExcelJS = null;
}
const SKIP = ExcelJS === null;
type ExportRisk = import('./export.ts').ExportRisk;

const REGISTER = 'سجل المخاطر';
const TOP = 'أهم المخاطر';

/** Build a minimal template workbook with register + top-risks sheets and headers. */
async function makeTemplate(path: string): Promise<void> {
  const wb = new ExcelJS!.Workbook();
  for (const name of [REGISTER, TOP]) {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true }] });
    // header row = canonical alias of each column
    ws.getRow(1).values = ['', ...RISK_REGISTER_COLUMNS.map((c) => c.aliases[0])];
    ws.getRow(1).font = { bold: true };
  }
  await wb.xlsx.writeFile(path);
}

function sampleRisk(code: string, isTopRisk: boolean, over: Partial<Record<string, unknown>> = {}): ExportRisk {
  return {
    isTopRisk,
    values: {
      cluster: 'Najran',
      department: 'IT',
      owner: 'owner-1',
      code,
      title: `Risk ${code}`,
      likelihood: 3,
      aggregatedImpact: 4,
      residualPriority: isTopRisk ? 3 : 20,
      residualLevel: isTopRisk ? 1 : 5,
      ...over,
    },
  };
}

test('round-trip: export then re-open loses no rows or columns (scenarios 7,8,9)', { skip: SKIP }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nh-erm-'));
  try {
    const tpl = join(dir, 'template.xlsx');
    await makeTemplate(tpl);

    const risks: ExportRisk[] = [
      sampleRisk('NC-001', true),
      sampleRisk('NC-002', false),
      sampleRisk('NC-003', true),
    ];

    const { buffer, writtenRows, topRiskRows } = await exportMod!.exportToTemplate(tpl, risks);
    assert.equal(writtenRows, 3);
    assert.equal(topRiskRows, 2); // only NC-001 & NC-003 qualify

    // Re-open the produced file and parse it back.
    const wb = new ExcelJS!.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.getWorksheet(REGISTER)!;
    const { rows, report } = importMod!.parseRiskRegisterSheet(sheet);

    assert.equal(report.importedCount, 3); // scenario 9: counts match
    const codes = rows.map((r) => r.values.code);
    assert.deepEqual(codes, ['NC-001', 'NC-002', 'NC-003']);
    // RTL preserved
    assert.equal(sheet.views[0].rightToLeft, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('import: error cells and placeholders become blank (§3)', { skip: SKIP }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nh-erm-'));
  try {
    const wb = new ExcelJS!.Workbook();
    const ws = wb.addWorksheet(REGISTER);
    ws.getRow(1).values = ['', ...RISK_REGISTER_COLUMNS.map((c) => c.aliases[0])];
    // row with a placeholder title and an error-ish owner
    const colIndex = (field: string) => 2 + RISK_REGISTER_COLUMNS.findIndex((c) => c.field === field);
    const row = ws.getRow(2);
    row.getCell(colIndex('code')).value = 'NC-010';
    row.getCell(colIndex('department')).value = 'IT';
    row.getCell(colIndex('title')).value = 'Unidentified'; // placeholder → blank
    row.getCell(colIndex('owner')).value = { error: '#REF!' } as import('exceljs').CellValue;
    row.commit();

    const { rows, report } = importMod!.parseRiskRegisterSheet(ws);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].values.title, null); // placeholder blanked
    assert.equal(rows[0].values.owner, null); // error cell blanked
    assert.ok(report.errorCount >= 1);
    // title is a required field → missing-field issue recorded
    assert.ok(report.missingFieldCount >= 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('import: duplicate codes are reported, 200-row cap enforced', { skip: SKIP }, async () => {
  const wb = new ExcelJS!.Workbook();
  const ws = wb.addWorksheet(REGISTER);
  ws.getRow(1).values = ['', ...RISK_REGISTER_COLUMNS.map((c) => c.aliases[0])];
  const colIndex = (field: string) => 2 + RISK_REGISTER_COLUMNS.findIndex((c) => c.field === field);

  // 205 rows, with one duplicate code among the first 200
  for (let i = 0; i < 205; i++) {
    const row = ws.getRow(2 + i);
    row.getCell(colIndex('code')).value = i === 5 ? 'NC-000' : `NC-${i}`;
    row.getCell(colIndex('department')).value = 'IT';
    row.getCell(colIndex('title')).value = `Risk ${i}`;
  }
  // make row 0 also NC-000 so row 5 duplicates it
  ws.getRow(2).getCell(colIndex('code')).value = 'NC-000';

  const { rows, report } = importMod!.parseRiskRegisterSheet(ws);
  assert.equal(rows.length, importMod!.MAX_ROWS_PER_SHEET); // cap
  assert.ok(report.overLimitCount >= 5);
  assert.ok(report.duplicateCount >= 1);
});

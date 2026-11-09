/**
 * NH-ERM core domain tests.
 * Run: `node --test` (Node ≥ 22 strips types natively — no build step).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateImpact,
  assessRisk,
  inherentBandFor,
  computeInherent,
  controlAdequacyFromAnswers,
  isTopRisk,
  levelForPriority,
  residualPriority,
} from '../src/risk-scoring.ts';
import {
  DEFAULT_METHODOLOGY,
  validateMethodology,
  type Methodology,
} from '../src/methodology.ts';
import { syncTopRisk } from '../src/top-risks-sync.ts';
import { isEmptyEquivalent, normalizeCell } from '../src/import-normalize.ts';

// ─────────────────────────────────────────────────────────────────────────────
// §8.2 impact aggregation
// ─────────────────────────────────────────────────────────────────────────────
test('aggregateImpact: default = max of applicable domains', () => {
  assert.equal(aggregateImpact({ a: 2, b: 5, c: 3 }), 5);
});

test('aggregateImpact: ignores omitted domains', () => {
  assert.equal(aggregateImpact({ a: 1 }), 1);
});

test('aggregateImpact: no applicable domains → 0', () => {
  assert.equal(aggregateImpact({}), 0);
});

test('aggregateImpact: average mode', () => {
  const m: Methodology = { ...DEFAULT_METHODOLOGY, impactAggregation: 'average' };
  assert.equal(aggregateImpact({ a: 2, b: 5 }, m), 3.5);
});

test('aggregateImpact: sum_capped mode caps at 5', () => {
  const m: Methodology = { ...DEFAULT_METHODOLOGY, impactAggregation: 'sum_capped' };
  assert.equal(aggregateImpact({ a: 3, b: 4, c: 5 }, m), 5);
});

// ─────────────────────────────────────────────────────────────────────────────
// §8.3 inherent band
// ─────────────────────────────────────────────────────────────────────────────
test('inherentBandFor: official heat map corners & edges', () => {
  assert.equal(inherentBandFor(1, 1), 'very_low'); // مستبعد × ضئيل
  assert.equal(inherentBandFor(1, 2), 'low'); //      مستبعد × قليل
  assert.equal(inherentBandFor(2, 1), 'low'); //      نادر × ضئيل
  assert.equal(inherentBandFor(3, 3), 'medium'); //   محتمل × متوسط
  assert.equal(inherentBandFor(5, 2), 'high'); //     شبه مؤكد × قليل (=10 → high)
  assert.equal(inherentBandFor(2, 4), 'medium'); //   نادر × مرتفع (=8 → medium)
  assert.equal(inherentBandFor(5, 4), 'critical'); // شبه مؤكد × مرتفع (=20 → critical)
  assert.equal(inherentBandFor(5, 5), 'critical');
});

test('computeInherent: score = likelihood × impact, band from heat map', () => {
  assert.deepEqual(computeInherent(5, 5), { score: 25, band: 'critical' });
  assert.deepEqual(computeInherent(1, 1), { score: 1, band: 'very_low' });
  assert.deepEqual(computeInherent(3, 3), { score: 9, band: 'medium' });
  assert.deepEqual(computeInherent(4, 5), { score: 20, band: 'critical' });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8.4 control adequacy
// ─────────────────────────────────────────────────────────────────────────────
test('controlAdequacyFromAnswers: yes-count → adequacy (default)', () => {
  assert.equal(controlAdequacyFromAnswers([true, true, true, true]), 'excellent');
  assert.equal(controlAdequacyFromAnswers([true, true, true, false]), 'acceptable');
  assert.equal(controlAdequacyFromAnswers([true, true, false, false]), 'neutral');
  assert.equal(controlAdequacyFromAnswers([true, false, false, false]), 'unacceptable');
  assert.equal(controlAdequacyFromAnswers([false, false, false, false]), 'weak');
});

// ─────────────────────────────────────────────────────────────────────────────
// §8.5 residual priority + level
// ─────────────────────────────────────────────────────────────────────────────
test('residualPriority: official grid cells', () => {
  assert.equal(residualPriority('very_low', 'excellent'), 25); // best
  assert.equal(residualPriority('critical', 'weak'), 1); //      worst
  assert.equal(residualPriority('critical', 'excellent'), 8); // critical row, best control
  assert.equal(residualPriority('high', 'neutral'), 7);
  assert.equal(residualPriority('high', 'unacceptable'), 6);
  assert.equal(residualPriority('medium', 'excellent'), 18);
  assert.equal(residualPriority('low', 'neutral'), 17);
});

test('levelForPriority: explicit groupings from the doc', () => {
  assert.equal(levelForPriority(1), 1);
  assert.equal(levelForPriority(3), 1);
  assert.equal(levelForPriority(4), 2);
  assert.equal(levelForPriority(7), 2);
  assert.equal(levelForPriority(8), 3);
  assert.equal(levelForPriority(12), 3);
  assert.equal(levelForPriority(13), 4);
  assert.equal(levelForPriority(17), 4);
  assert.equal(levelForPriority(18), 5);
  assert.equal(levelForPriority(25), 5);
});

test('isTopRisk: priority ≤ 7 (levels 1 & 2)', () => {
  for (let p = 1; p <= 7; p++) assert.equal(isTopRisk(p), true, `p=${p}`);
  for (let p = 8; p <= 25; p++) assert.equal(isTopRisk(p), false, `p=${p}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// methodology integrity
// ─────────────────────────────────────────────────────────────────────────────
test('validateMethodology: default config is valid', () => {
  assert.doesNotThrow(() => validateMethodology(DEFAULT_METHODOLOGY));
});

test('validateMethodology: rejects a grid that is not a 1..25 permutation', () => {
  const bad: Methodology = {
    ...DEFAULT_METHODOLOGY,
    priorityGrid: [
      [1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2],
      [3, 3, 3, 3, 3],
      [4, 4, 4, 4, 4],
      [5, 5, 5, 5, 5],
    ],
  };
  assert.throws(() => validateMethodology(bad), /1\.\.25/);
});

// ─────────────────────────────────────────────────────────────────────────────
// §16 Mandatory acceptance scenarios (scoring portion)
// ─────────────────────────────────────────────────────────────────────────────
test('Scenario 1: an ordinary risk stays out of Top Risks', () => {
  // low likelihood, low impact, strong controls
  const r = assessRisk({
    likelihood: 1,
    impacts: { business_continuity: 2 },
    controlAnswers: [true, true, true, true],
  });
  assert.equal(r.inherentBand, 'low'); // L1 × I2 = low (official heat map)
  assert.equal(r.isTopRisk, false);
  assert.ok(r.residualLevel >= 3);
});

test('Scenario 2: a high/critical risk appears in both register and Top Risks', () => {
  const r = assessRisk({
    likelihood: 5,
    impacts: { care_quality: 5 },
    controlAnswers: [false, false, false, false], // weak controls
  });
  assert.equal(r.inherentBand, 'critical');
  assert.equal(r.isTopRisk, true);
  assert.ok(r.residualLevel <= 2);
});

test('Scenario 3: raising an ordinary risk auto-adds it to Top Risks', () => {
  const before = assessRisk({
    likelihood: 1,
    impacts: { governance: 2 },
    controlAnswers: [true, true, true, true],
  });
  const after = assessRisk({
    likelihood: 5,
    impacts: { governance: 5 },
    controlAnswers: [false, false, false, false],
  });
  const sync = syncTopRisk(before.residualPriority, after.residualPriority);
  assert.equal(before.isTopRisk, false);
  assert.equal(after.isTopRisk, true);
  assert.equal(sync.transition, 'added');
  assert.equal(sync.recordHistory, true);
  assert.equal(sync.isTopRiskNow, true);
});

test('Scenario 4: lowering a high risk removes it from Top Risks (still in register)', () => {
  const before = assessRisk({
    likelihood: 5,
    impacts: { care_quality: 5 },
    controlAnswers: [false, false, false, false],
  });
  const after = assessRisk({
    likelihood: 1,
    impacts: { care_quality: 1 },
    controlAnswers: [true, true, true, true],
  });
  const sync = syncTopRisk(before.residualPriority, after.residualPriority);
  assert.equal(before.isTopRisk, true);
  assert.equal(after.isTopRisk, false);
  assert.equal(sync.transition, 'removed');
  assert.equal(sync.recordHistory, true);
  // The caller keeps the risk in the register; sync only hides it from Top Risks.
  assert.equal(sync.isTopRiskNow, false);
});

test('syncTopRisk: brand-new high risk is "added"', () => {
  const r = assessRisk({
    likelihood: 5,
    impacts: { cybersecurity: 5 },
    controlAnswers: [false, false, false, false],
  });
  const sync = syncTopRisk(null, r.residualPriority);
  assert.equal(sync.transition, 'added');
});

test('syncTopRisk: staying a top risk records no new history', () => {
  const sync = syncTopRisk(2, 3); // both ≤ 7
  assert.equal(sync.transition, 'unchanged_present');
  assert.equal(sync.recordHistory, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 import normalization
// ─────────────────────────────────────────────────────────────────────────────
test('isEmptyEquivalent: formula errors and placeholders are empty', () => {
  assert.equal(isEmptyEquivalent('#REF!'), true);
  assert.equal(isEmptyEquivalent('#NAME?'), true);
  assert.equal(isEmptyEquivalent(' Unidentified '), true);
  assert.equal(isEmptyEquivalent('خطأ في التقييم'), true);
  assert.equal(isEmptyEquivalent(''), true);
  assert.equal(isEmptyEquivalent('   '), true);
  assert.equal(isEmptyEquivalent(null), true);
  assert.equal(isEmptyEquivalent(undefined), true);
  assert.equal(isEmptyEquivalent({ error: '#REF!' }), true); // exceljs shape
});

test('isEmptyEquivalent: real values are kept', () => {
  assert.equal(isEmptyEquivalent('Patient safety risk'), false);
  assert.equal(isEmptyEquivalent(0), false);
  assert.equal(isEmptyEquivalent(42), false);
  assert.equal(isEmptyEquivalent('NC-001'), false);
});

test('normalizeCell: empty-equivalent → null, real → unchanged', () => {
  assert.equal(normalizeCell('#REF!'), null);
  assert.equal(normalizeCell('Unidentified'), null);
  assert.equal(normalizeCell('NC-001'), 'NC-001');
  assert.equal(normalizeCell(3), 3);
});

/** Indicators (KRI/KPI) tests — confirmed rules (§9). Run: `node --test`. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  completionFromSubtasks,
  cycleStart,
  departmentKpis,
  isOnTime,
  kriState,
  ragBand,
} from '../src/indicators.ts';

const d = (s: string) => new Date(s + 'T00:00:00Z');

// ── RAG bands (≥90 green, 70–<90 yellow, <70 red) ────────────────────────────
test('ragBand: confirmed targets', () => {
  assert.equal(ragBand(100), 'green');
  assert.equal(ragBand(90), 'green');
  assert.equal(ragBand(89), 'yellow');
  assert.equal(ragBand(70), 'yellow');
  assert.equal(ragBand(69), 'red');
  assert.equal(ragBand(0), 'red');
});

// ── Completion from sub-tasks ────────────────────────────────────────────────
test('completionFromSubtasks: unweighted and weighted', () => {
  assert.equal(completionFromSubtasks([]), 0);
  assert.equal(completionFromSubtasks([{ done: true }, { done: false }]), 50);
  assert.equal(completionFromSubtasks([{ done: true }, { done: true }]), 100);
  assert.equal(completionFromSubtasks([{ done: true, weight: 3 }, { done: false, weight: 1 }]), 75);
});

// ── KRI state: 30-day approaching, weekly overdue reminder ───────────────────
test('kriState: on_track beyond 30 days', () => {
  const s = kriState(d('2026-12-31'), 40, d('2026-11-01'));
  assert.equal(s.status, 'on_track');
  assert.equal(s.alert, null);
});

test('kriState: approaching within 30 days fires one alert', () => {
  const s = kriState(d('2026-11-20'), 40, d('2026-11-01')); // 19 days out
  assert.equal(s.status, 'approaching');
  assert.equal(s.alert, 'approaching');
});

test('kriState: overdue reminds weekly', () => {
  const due = d('2026-11-01');
  const now = d('2026-11-20'); // 19 days overdue
  // no prior alert → remind now
  assert.equal(kriState(due, 50, now, null).alert, 'overdue');
  // alerted 3 days ago → not yet (weekly)
  assert.equal(kriState(due, 50, now, d('2026-11-17')).alert, null);
  // alerted 8 days ago → remind again
  assert.equal(kriState(due, 50, now, d('2026-11-12')).alert, 'overdue');
});

test('kriState: done when complete, no alert even if past due', () => {
  const s = kriState(d('2026-01-01'), 100, d('2026-11-01'));
  assert.equal(s.status, 'done');
  assert.equal(s.alert, null);
});

// ── KPI: quarterly cycle, on-time within first week ──────────────────────────
test('cycleStart: quarterly', () => {
  assert.equal(cycleStart(d('2026-11-09')).toISOString().slice(0, 10), '2026-10-01'); // Q4
  assert.equal(cycleStart(d('2026-02-15')).toISOString().slice(0, 10), '2026-01-01'); // Q1
});

test('isOnTime: within first 7 days of the quarter', () => {
  assert.equal(isOnTime(d('2026-10-03')), true); // day 3 of Q4
  assert.equal(isOnTime(d('2026-10-07')), true); // day 7 (< 7 days after start → index 6)
  assert.equal(isOnTime(d('2026-10-20')), false); // late
});

test('departmentKpis: adherence, delay, RAG per department', () => {
  const risks = [
    { department: 'IT', updateDate: d('2026-10-02') }, // on-time
    { department: 'IT', updateDate: d('2026-10-03') }, // on-time
    { department: 'IT', updateDate: d('2026-11-01') }, // late
    { department: 'Finance', updateDate: d('2026-11-01') }, // late
    { department: 'Finance', updateDate: null }, // late (never updated)
  ];
  const kpis = departmentKpis(risks);
  const it = kpis.find((k) => k.department === 'IT')!;
  const fin = kpis.find((k) => k.department === 'Finance')!;
  assert.equal(it.total, 3);
  assert.equal(it.onTime, 2);
  assert.equal(it.adherencePct, 67);
  assert.equal(it.delayPct, 33);
  assert.equal(it.rag, 'red'); // 67 < 70
  assert.equal(fin.adherencePct, 0);
  assert.equal(fin.rag, 'red');
  // sorted worst-first
  assert.ok(kpis[0].adherencePct <= kpis[kpis.length - 1].adherencePct);
});

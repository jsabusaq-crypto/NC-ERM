/** Arabic scale-label parsing tests (confirmed against the real file). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  likelihoodFromLabel,
  impactFromLabel,
  inherentBandFromLabel,
  controlAdequacyFromLabel,
  controlTypeFromLabel,
  parseYesNo,
  extractNumber,
  normalizeLabel,
} from '../src/labels.ts';

test('likelihood labels map to 1..5', () => {
  assert.equal(likelihoodFromLabel('نادر'), 2);
  assert.equal(likelihoodFromLabel('محتمل'), 3);
  assert.equal(likelihoodFromLabel('غالبا'), 4);
  assert.equal(likelihoodFromLabel('شبه مؤكد'), 5);
  assert.equal(likelihoodFromLabel('شبة مؤكد'), 5); // diacritic variant
});

test('impact labels map to 1..5 incl. very-high variants', () => {
  assert.equal(impactFromLabel('ضئيل'), 1);
  assert.equal(impactFromLabel('مرتفع'), 4);
  assert.equal(impactFromLabel('مرتفع جدا'), 5);
  assert.equal(impactFromLabel('مرتفع جداً'), 5); // tanwin variant
});

test('inherent + adequacy + control-type labels map to enums', () => {
  assert.equal(inherentBandFromLabel('عالي'), 'high');
  assert.equal(inherentBandFromLabel('حرج'), 'critical');
  assert.equal(controlAdequacyFromLabel('ممتاز'), 'excellent');
  assert.equal(controlAdequacyFromLabel('غير مقبول'), 'unacceptable');
  assert.equal(controlTypeFromLabel('وقائي'), 'preventive');
  assert.equal(controlTypeFromLabel('لايوجد'), 'none');
});

test('yes/no parsing', () => {
  assert.equal(parseYesNo('نعم'), true);
  assert.equal(parseYesNo('لا'), false);
  assert.equal(parseYesNo('#REF!'), null);
});

test('extractNumber handles variants and Arabic-Indic digits', () => {
  assert.equal(extractNumber('أولوية 14'), 14);
  assert.equal(extractNumber('اولويه 4'), 4);
  assert.equal(extractNumber('اولوية20'), 20);
  assert.equal(extractNumber('مستوى ٤'), 4); // Arabic-Indic 4
  assert.equal(extractNumber('مستوى ٥'), 5);
  assert.equal(extractNumber('#REF!'), null);
});

test('normalizeLabel folds digits, diacritics, and letter variants', () => {
  assert.equal(normalizeLabel('مستوى ٣'), 'مستوي 3'); // ى→ي, ٣→3
  assert.equal(normalizeLabel('مرتفع جداً'), 'مرتفع جدا'); // tanwin stripped
  assert.equal(normalizeLabel('حدوثة'), 'حدوثه'); // ة→ه
});

test('unknown labels return null', () => {
  assert.equal(likelihoodFromLabel('غير معروف'), null);
  assert.equal(impactFromLabel(''), null);
  assert.equal(inherentBandFromLabel(null), null);
});

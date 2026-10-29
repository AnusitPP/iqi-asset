import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editedValues } from '../../frontend/public/js/features/recordDetails/formValues.js';
test('unchanged multiline displayed values keep original CRLF so formulas are not overwritten', () => {
  const original = ['Formula result\r\nsecond line', 'old note', 'unchanged\rvalue'];
  const baseline = ['Formula result\nsecond line', 'old note', 'unchanged\nvalue'];
  const current = ['Formula result\nsecond line', 'new note', 'unchanged\nvalue'];
  assert.deepEqual(editedValues(original, baseline, current), [
    'Formula result\r\nsecond line',
    'new note',
    'unchanged\rvalue',
  ]);
});

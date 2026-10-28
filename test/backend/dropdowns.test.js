import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDropdowns, validateDropdownChanges } from '../../backend/src/services/dropdowns.js';
test('reads row-specific list rules and preserves exact option casing', async () => {
  const cells = [
    {
      dataValidation: {
        condition: {
          type: 'ONE_OF_LIST',
          values: [
            { userEnteredValue: 'ดี' },
            { userEnteredValue: 'ชำรุด' },
            { userEnteredValue: 'ดี' },
          ],
        },
        strict: true,
      },
    },
    {},
    {
      dataValidation: {
        condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] },
      },
    },
  ];
  const result = await readDropdowns(cells, 4, async () => []);
  assert.deepEqual(result, [{ options: ['ดี', 'ชำรุด'], strict: true }, null, null, null]);
});
test('resolves dropdowns from sheet ranges and handles non-strict suggestions', async () => {
  const cells = [
    {
      dataValidation: {
        condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: "='Lists'!A2:A" }] },
        strict: false,
      },
    },
  ];
  const result = await readDropdowns(cells, 1, async (range) => {
    assert.equal(range, "'Lists'!A2:A");
    return [['HP'], [''], ['Dell'], ['HP']];
  });
  assert.deepEqual(result, [{ options: ['HP', 'Dell'], strict: false }]);
});
test('validates changed strict fields but permits clearing and unchanged legacy values', () => {
  const rules = [
    { options: ['ดี', 'ชำรุด'], strict: true },
    { options: ['HP'], strict: false },
  ];
  assert.throws(
    () => validateDropdownChanges([{ index: 0, value: 'เดาเอง' }], rules, ['สภาพ', 'ยี่ห้อ']),
    { status: 422 },
  );
  assert.doesNotThrow(() =>
    validateDropdownChanges(
      [
        { index: 0, value: '' },
        { index: 1, value: 'อื่น' },
      ],
      rules,
      ['สภาพ', 'ยี่ห้อ'],
    ),
  );
  assert.doesNotThrow(() => validateDropdownChanges([], rules, ['สภาพ', 'ยี่ห้อ']));
});

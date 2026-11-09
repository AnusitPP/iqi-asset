import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvalStatuses,
  requestStatusValue,
  requestStatusPresentation,
  REQUEST_STATUS_PRESENTATION,
} from '../../shared/features/lending/status.js';

test('approval options preserve stored values and exclude the removed status', () => {
  assert.deepEqual(approvalStatuses('คืน'), ['รอดำเนินการ', 'เสร็จสิ้น']);
  assert.ok(approvalStatuses('ยืม').includes('กำลังยืม'));
  for (const kind of ['ยืม', 'คืน']) {
    assert.ok(!approvalStatuses(kind).includes('กำลังดำเนินการ'));
    for (const status of approvalStatuses(kind)) assert.ok(REQUEST_STATUS_PRESENTATION[status]);
  }
});
test('legacy returns and completed loans share the same display rules', () => {
  assert.equal(requestStatusValue({ kind: 'คืน', status: 'รอรับคืน' }), 'รอดำเนินการ');
  assert.equal(requestStatusValue({ kind: 'คืน', status: 'รับคืนแล้ว' }), 'เสร็จสิ้น');
  assert.equal(
    requestStatusValue({ kind: 'คืน', status: 'รอดำเนินการ', completed: true }),
    'รอดำเนินการ',
  );
  assert.equal(
    requestStatusValue({ kind: 'ยืม', status: 'กำลังยืม', completed: true }),
    'เสร็จสิ้น',
  );
  assert.deepEqual(requestStatusPresentation('สถานะเก่า'), { label: 'สถานะเก่า', color: 'gray' });
});
test('editing presentation labels does not change saved status values or options', () => {
  const original = REQUEST_STATUS_PRESENTATION['กำลังยืม'].label;
  try {
    REQUEST_STATUS_PRESENTATION['กำลังยืม'].label = 'ยืมอยู่';
    assert.equal(requestStatusPresentation('กำลังยืม').label, 'ยืมอยู่');
    assert.equal(requestStatusValue({ kind: 'ยืม', status: 'กำลังยืม' }), 'กำลังยืม');
    assert.ok(approvalStatuses('ยืม').includes('กำลังยืม'));
  } finally {
    REQUEST_STATUS_PRESENTATION['กำลังยืม'].label = original;
  }
});

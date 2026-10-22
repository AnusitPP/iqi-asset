import { test } from 'node:test';
import assert from 'node:assert/strict';
test('dashboard status saves verify the row revision, stamp only changes and protect duplicate asset identities', async () => {
  const { dashboardData, DashboardEditor } = await import('../src/dashboard.js');
  const grid = [
    [
      'ผลตรวจ Apps Script',
      'สถานะการเทียบ',
      'เลขครุภัณฑ์ Apps Script',
      'S/N Apps Script',
      'อัปเดตสถานะล่าสุด',
    ],
    ['ยังไม่ตรวจ', 'ตรงกัน', '001', 'SN-A', ''],
    ['ดี', 'ตรงกัน', '001', 'SN-B', 'old'],
  ];
  let writes = 0;
  const adapter = {
    readDashboard: async () => structuredClone(grid),
    writeDashboardStatus: async (row, statusColumn, dateColumn, status, date) => {
      writes++;
      grid[row - 1][statusColumn] = status;
      grid[row - 1][dateColumn] = date;
    },
  };
  const editor = new DashboardEditor(adapter),
    record = dashboardData(grid).records[0];
  await assert.rejects(editor.save(2, { revision: record.revision, status: 'other' }), /สถานะ/);
  assert.equal(writes, 0);
  const result = await editor.save(2, { revision: record.revision, status: 'ชำรุด' });
  assert.equal(result.record.inspection, 'ชำรุด');
  assert.ok(result.record.updatedAt);
  assert.equal(grid[2][0], 'ดี');
  assert.equal(writes, 1);
  await assert.rejects(editor.save(2, { revision: record.revision, status: 'ดี' }), /เปลี่ยน|ใหม่/);
  const date = grid[1][4];
  const unchanged = await editor.save(2, { revision: result.record.revision, status: 'ชำรุด' });
  assert.equal(unchanged.unchanged, true);
  assert.equal(grid[1][4], date);
  assert.equal(writes, 1);
  const beforeSort = dashboardData(grid).records[0];
  [grid[1], grid[2]] = [grid[2], grid[1]];
  await assert.rejects(
    editor.save(2, { revision: beforeSort.revision, status: 'ดี' }),
    /เปลี่ยน|ใหม่/,
  );
  assert.equal(writes, 1);
});
test('dashboard progress counts inspection results, preserves duplicate assets and separates lookup failures', async () => {
  const { dashboardData } = await import('../src/dashboard.js');
  const data = dashboardData([
    [
      'ลำดับ',
      'ผลตรวจ Apps Script',
      'สถานะการเทียบ',
      'เลขครุภัณฑ์ Apps Script',
      'ชื่ออุปกรณ์ Apps Script',
      'S/N Apps Script',
    ],
    ['1', 'ดี', 'หาไม่เจอ', '001', 'Laptop', 'SN1'],
    ['2', 'ยังไม่ตรวจ', 'ตรงกัน', '002', 'Monitor', ''],
    ['3', 'ชำรุด', 'ข้อมูลไม่ตรง', '003', 'PC', 'SN3'],
    ['4', 'หาไม่เจอ', 'หาไม่เจอ', '001', 'Laptop', 'SN4'],
    ['5', '', 'หาไม่เจอ', '005', 'Printer', ''],
    [],
  ]);
  assert.equal(data.total, 5);
  assert.equal(data.completed, 3);
  assert.equal(data.percent, 60);
  assert.deepEqual(data.inspection, { ดี: 1, ชำรุด: 1, หาไม่เจอ: 1, ยังไม่ตรวจ: 1, ไม่ระบุ: 1 });
  assert.equal(data.comparison['หาไม่เจอ'], 3);
  assert.equal(data.records.filter((r) => r.asset === '001').length, 2);
  assert.equal(data.records[0].serial, 'SN1');
  assert.equal(data.records[4].inspection, 'ไม่ระบุ');
});
test('dashboard refuses missing inspection column instead of interpreting matching status as an inspection', async () => {
  const { dashboardData } = await import('../src/dashboard.js');
  assert.throws(
    () =>
      dashboardData([
        ['สถานะการเทียบ', 'เลขครุภัณฑ์ Apps Script'],
        ['ดี', '001'],
      ]),
    /ผลตรวจ Apps Script/,
  );
});

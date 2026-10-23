import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { dashboardData } from '../src/dashboard.js';

test('authenticated details API saves existing team and new notes without changing other cells', async (t) => {
  const grid = [
    [
      'ผลตรวจ Apps Script',
      'สถานะการเทียบ',
      'เลขครุภัณฑ์ Apps Script',
      'ทีม',
      'หมายเหตุ',
      'หมายเหตุเดิมในชีต',
      'รูป1',
    ],
    ['ดี', 'ตรงกัน', '001', 'IQI', '', 'original', 'photo'],
    ['ชำรุด', 'ตรงกัน', '002', 'IT', '', 'other', ''],
  ];
  const adapter = {
    readDashboard: async () => structuredClone(grid),
    writeDashboardDetails: async (row, changes) => {
      for (const c of changes) grid[row - 1][c.column] = c.value;
    },
  };
  const server = createApp({ adapter }, { host: '127.0.0.1' }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = await fetch(base + '/api/auth/session').then((r) => r.json());
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf },
    body: JSON.stringify({ password: '1234' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const revision = dashboardData(grid).records[0].revision;
  const put = (headers = {}) =>
    fetch(base + '/api/dashboard/2/details', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf, ...headers },
      body: JSON.stringify({ team: 'IT', notes: 'ย้ายไปทีม IT\nตรวจสอบแล้ว', revision }),
    });
  assert.equal((await put()).status, 401);
  const saved = await put({ Cookie: cookie });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).record.team, 'IT');
  assert.deepEqual(grid[1], [
    'ดี',
    'ตรงกัน',
    '001',
    'IT',
    'ย้ายไปทีม IT\nตรวจสอบแล้ว',
    'original',
    'photo',
  ]);
  assert.equal((await put({ Cookie: cookie })).status, 409);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApp } from '../../backend/src/http/app.js';
import { PhotoStore } from '../../backend/src/services/photos.js';
import { dashboardData } from '../../backend/src/services/dashboard.js';

test('HTTP sequential multi-photo upload fills three slots and rejects overflow without uploading', async (t) => {
  const grid = [
    ['ผลตรวจ Apps Script', 'สถานะการเทียบ', 'เลขครุภัณฑ์ Apps Script', 'รูป1', 'รูป2', 'รูป3'],
    ['ดี', 'ตรงกัน', '001', '', '', ''],
  ];
  let uploaded = 0;
  t.mock.method(PhotoStore.prototype, 'upload', async () => {
    const id = `http-${++uploaded}`;
    return { id, url: `https://drive.google.com/file/d/${id}/view` };
  });
  const adapter = {
    readDashboard: async () => structuredClone(grid),
    writeDashboardPhotoSlots: async (row, urls) => {
      grid[row - 1].splice(3, 3, ...urls);
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
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  let revision = dashboardData(grid).records[0].revision;
  for (let i = 0; i < 4; i++) {
    const response = await fetch(base + '/api/dashboard/2/photos', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/octet-stream',
        'X-IQI-Request': session.csrf,
        'X-Record-Revision': revision,
      },
      body: image,
    });
    const result = await response.json();
    assert.equal(response.status, i < 3 ? 200 : 400);
    if (i < 3) revision = result.revision;
    else assert.match(result.error, /3 รูป/);
  }
  assert.equal(uploaded, 3);
  assert.deepEqual(
    grid[1].slice(3),
    [1, 2, 3].map((i) => `https://drive.google.com/file/d/http-${i}/view`),
  );
});
